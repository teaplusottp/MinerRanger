import asyncio
import contextlib
import json
import os
import shutil
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path, override=False)

try:
    from chatbot.root_agent.agent import root_agent
    ROOT_AGENT_LOAD_ERROR: Optional[Exception] = None
except (ModuleNotFoundError, ImportError) as exc:
    root_agent = None  # type: ignore[assignment]
    ROOT_AGENT_LOAD_ERROR = exc
else:
    ROOT_AGENT_LOAD_ERROR = None

try:
    from google.adk.runners import InMemoryRunner
    from google.genai import types as genai_types
    RUNNER_IMPORT_ERROR: Optional[Exception] = None
except (ModuleNotFoundError, ImportError) as exc:
    InMemoryRunner = None  # type: ignore[assignment]
    genai_types = None  # type: ignore[assignment]
    RUNNER_IMPORT_ERROR = exc
else:
    RUNNER_IMPORT_ERROR = None

from process.WebSocketLogger import WebSocketLogger
from process.generate_cleaned import clean_and_save_logs
from process.generate_json import gen_report
from process.generate_store import build_store
from chatbot.chat_sessions import ChatHistoryManager
from chatbot.dataset_context import dataset_context
from chatbot.dataset_loader import load_dataset_artefacts
from process.__init__ import GEMINI_API_KEY

# ===================== App config =====================

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_ROOT = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "demo")

os.makedirs(UPLOAD_ROOT, exist_ok=True)

if not os.path.exists(STATIC_DIR):
    raise RuntimeError(f"Static folder does not exist: {STATIC_DIR}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ===================== Config =====================

CHAT_MONGO_URI = os.getenv("CHAT_HISTORY_MONGO_URI") or os.getenv("MONGODB_URI")
JWT_SECRET = os.getenv("JWT_SECRET", "123456s")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
USER_SERVICE_BASE_URL = os.getenv(
    "USER_SERVICE_BASE_URL", "http://127.0.0.1:8080/api/users"
)
DATA_FOLDERS_ENDPOINT = f"{USER_SERVICE_BASE_URL}/data-folders"

AUTH_HEADER = "Authorization"

# ===================== In-memory job tracking =====================

class JobInfo(BaseModel):
    user_id: str
    token: str
    directory: str
    display_name: str
    original_filename: str
    created_at: str
    note: Optional[str] = ""


JOB_REGISTRY: Dict[str, JobInfo] = {}

# ===================== Helpers =====================

def get_folder_name(filename: str) -> str:
    if filename.endswith(".xes.gz"):
        return filename[:-7]
    if filename.endswith(".xes"):
        return filename[:-4]
    return os.path.splitext(filename)[0]

def extract_token(request: Request) -> str:
    auth_header = request.headers.get(AUTH_HEADER)
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return auth_header.split(" ", 1)[1].strip()

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def extract_user_id(claims: dict) -> Optional[str]:
    for key in ("id", "_id", "user_id", "userId"):
        value = claims.get(key)
        if isinstance(value, str) and value:
            return value
        if isinstance(value, dict):
            candidate = value.get("$oid") or value.get("value")
            if isinstance(candidate, str) and candidate:
                return candidate
    return None


def merge_chat_logs_metadata(existing: Optional[dict], session_entry: dict, *, folder: str) -> dict:
    base = existing or {}
    target_folder = (base.get("folder") or folder or "").strip('/')
    if target_folder:
        target_folder += '/'
    sessions = [item for item in base.get("sessions", []) if item.get("sessionId") != session_entry.get("sessionId")]
    sessions.append(session_entry)
    sessions.sort(key=lambda item: item.get("lastUpdated", ""), reverse=True)
    return {
        "folder": target_folder,
        "sessions": sessions,
    }
def build_dataset_payload(job_id: str, job: JobInfo, cleaned_filename: Optional[str], store_filename: Optional[str]) -> dict:
    folder = job.directory

    def file_entry(file_type: str, filename: str) -> Optional[dict]:
        if not filename:
            return None
        path = os.path.join(folder, filename)
        if not os.path.exists(path):
            return None
        return {
            "type": file_type,
            "name": filename,
            "path": path,
        }

    files = []
    raw_entry = file_entry("log_raw", job.original_filename)
    if raw_entry:
        files.append(raw_entry)

    if cleaned_filename:
        cleaned_entry = file_entry("log_cleaned", cleaned_filename)
        if cleaned_entry:
            files.append(cleaned_entry)

    description_entry = file_entry("description", "description.txt")
    if description_entry:
        files.append(description_entry)

    report_entry = file_entry("report", "report.json")
    if report_entry:
        files.append(report_entry)

    if store_filename:
        store_entry = file_entry("store", store_filename)
        if store_entry:
            files.append(store_entry)

    for chart_type, filename in (
        ("chart_dotted", "dotted_chart.png"),
        ("chart_throughput_time_density", "throughput_time_density.png"),
        ("chart_unwanted_activity_stats", "unwanted_activity_stats.png"),
    ):
        entry = file_entry(chart_type, filename)
        if entry:
            files.append(entry)

    bpmn_entry = file_entry("bpmn", "bpmn_model.bpmn")
    if bpmn_entry:
        files.append(bpmn_entry)

    if not files:
        raise RuntimeError("No artefacts generated for upload")

    return {
        "jobId": job_id,
        "displayName": job.display_name,
        "uploadedAt": job.created_at,
        "files": files,
    }

def map_file_urls(dataset: dict) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for file_info in dataset.get("files", []):
        name = file_info.get("name")
        url = file_info.get("url")
        if not name or not url:
            continue
        mapping[name] = url
        mapping[os.path.basename(name)] = url
    return mapping

def patch_report_media(report_data: dict, url_mapping: Dict[str, str]) -> None:
    if not isinstance(report_data, dict):
        return

    def patch_value(value):
        if isinstance(value, dict):
            if "img_url" in value and isinstance(value["img_url"], str):
                key = os.path.basename(value["img_url"])
                value["img_url"] = url_mapping.get(value["img_url"], url_mapping.get(key, value["img_url"]))
            for sub_key, sub_value in value.items():
                value[sub_key] = patch_value(sub_value)
            return value
        if isinstance(value, list):
            return [patch_value(item) for item in value]
        if isinstance(value, str):
            key = os.path.basename(value)
            return url_mapping.get(value, url_mapping.get(key, value))
        return value

    patch_value(report_data)

# ===================== External calls =====================

async def request_user_service(method: str, url: str, token: str, payload: Optional[dict] = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.request(method, url, headers=headers, json=payload)
    if response.status_code >= 400:
        detail = response.json().get("message") if response.headers.get("content-type", "").startswith("application/json") else response.text
        raise HTTPException(status_code=response.status_code, detail=detail or "User service error")
    return response.json()

# ===================== APIs =====================

@app.get("/databases")
async def get_databases(request: Request):
    token = extract_token(request)
    _ = decode_token(token)
    data = await request_user_service("GET", DATA_FOLDERS_ENDPOINT, token)
    return {"databases": data.get("folders", [])}

@app.get("/graph")
async def get_graph(request: Request, db: str = Query(..., description="Data ID")):
    token = extract_token(request)
    _ = decode_token(token)

    dataset = await request_user_service("GET", f"{DATA_FOLDERS_ENDPOINT}/{db}", token)
    folder = dataset.get("folder")
    if not folder:
        raise HTTPException(status_code=404, detail="Dataset not found")

    files = folder.get("files", [])
    report_file = next((f for f in files if f.get("type") == "report"), None)
    if not report_file:
        raise HTTPException(status_code=404, detail="Report not available")

    async with httpx.AsyncClient(timeout=60.0) as client:
        report_response = await client.get(report_file["url"])
        report_response.raise_for_status()
        report_data = report_response.json()

    url_mapping = map_file_urls(folder)
    patch_report_media(report_data, url_mapping)

    return JSONResponse(content=report_data)

@app.get("/stats")
async def get_stats(request: Request, db: str = Query(..., description="Data ID")):
    token = extract_token(request)
    _ = decode_token(token)

    dataset = await request_user_service("GET", f"{DATA_FOLDERS_ENDPOINT}/{db}", token)
    folder = dataset.get("folder")
    if not folder:
        raise HTTPException(status_code=404, detail="Dataset not found")

    stats_file = next((f for f in folder.get("files", []) if f.get("type") == "report"), None)
    if not stats_file:
        raise HTTPException(status_code=404, detail="Report not available")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(stats_file["url"])
        response.raise_for_status()
        return JSONResponse(content=response.json())

@app.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    note: str = Form(None),
):
    if not (file.filename.endswith(".xes") or file.filename.endswith(".xes.gz")):
        return JSONResponse(
            status_code=400,
            content={"error": "Only .xes or .xes.gz files are accepted"},
        )

    token = extract_token(request)
    payload = decode_token(token)
    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user id")

    job_id = str(uuid.uuid4())
    target_dir = os.path.join(UPLOAD_ROOT, job_id)
    os.makedirs(target_dir, exist_ok=True)

    file_path = os.path.join(target_dir, file.filename)
    file_bytes = await file.read()
    with open(file_path, "wb") as destination:
        destination.write(file_bytes)

    if note:
        with open(os.path.join(target_dir, "description.txt"), "w", encoding="utf-8") as description_file:
            description_file.write(note)

    display_name = get_folder_name(file.filename)

    job_info = JobInfo(
        user_id=user_id,
        token=token,
        directory=target_dir,
        display_name=display_name,
        original_filename=file.filename,
        created_at=datetime.utcnow().isoformat() + "Z",
        note=note or "",
    )
    JOB_REGISTRY[job_id] = job_info

    return {
        "message": "Upload sucessfully, starting processing",
        "filename": file.filename,
        "folder": job_id,
        "jobId": job_id,
        "displayName": display_name,
    }

# ===================== WebSocket stream log =====================

@app.websocket("/ws/upload")
async def ws_upload(ws: WebSocket):
    await ws.accept()

    job_id = ws.query_params.get("folder") or ws.query_params.get("jobId")
    if not job_id:
        await ws.send_text(json.dumps({"type": "error", "message": "Missing job identifier"}))
        await ws.close()
        return

    job_info = JOB_REGISTRY.get(job_id)
    if not job_info:
        await ws.send_text(json.dumps({"type": "error", "message": "Job not found or expired"}))
        await ws.close()
        return

    queue: asyncio.Queue = asyncio.Queue()
    old_stdout = sys.stdout
    sys.stdout = WebSocketLogger(queue)

    async def sender():
        try:
            while True:
                message = await queue.get()
                await ws.send_text(message)
        except asyncio.CancelledError:
            return

    sender_task = asyncio.create_task(sender())

    dataset_payload: Optional[dict] = None
    store_filename: Optional[str] = None

    try:
        folder_path = job_info.directory
        if not folder_path.endswith(os.sep):
            folder_path = folder_path + os.sep

        cleaned_filename = await clean_and_save_logs(folder_path, GEMINI_API_KEY)
        if not cleaned_filename:
            raise RuntimeError("Unable to preprocess logs")

        report_success = await gen_report(folder_path, GEMINI_API_KEY)
        if not report_success:
            raise RuntimeError("Failed to generate report")

        print("[i] Generating store.json from report")
        store_path = await asyncio.to_thread(build_store, folder_path)
        store_filename = os.path.basename(store_path)

        dataset_payload = build_dataset_payload(job_id, job_info, cleaned_filename, store_filename)
        dataset_record = await request_user_service(
            "POST",
            DATA_FOLDERS_ENDPOINT,
            job_info.token,
            dataset_payload,
        )

        await ws.send_text(
            json.dumps({"type": "dataset_saved", "data": dataset_record.get("folder")})
        )

    except HTTPException as http_exc:
        await ws.send_text(json.dumps({"type": "error", "message": http_exc.detail}))
    except Exception as exc:  # noqa: BLE001
        await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))
    finally:
        sys.stdout = old_stdout
        sender_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sender_task

        if job_id in JOB_REGISTRY:
            JOB_REGISTRY.pop(job_id, None)
        shutil.rmtree(job_info.directory, ignore_errors=True)

        await ws.close()

# ===================== Sidebar mock API =====================

@app.get("/api/sidebar")
def get_sidebar():
    return {
        "history": ["Conversation 1", "Conversation 2"],
        "groups": {"Datasets": ["Dataset 1", "Dataset 2", "Dataset 3"]},
    }

# ===================== Chat APIs =====================

chats = {}
chat_counter = 1

class MessageRequest(BaseModel):
    message: str

class ChatbotQueryRequest(BaseModel):
    question: str
    datasetId: str
    sessionId: Optional[str] = None
    summary: Optional[str] = None

def _extract_text_from_event(event: Any) -> str:
    content = getattr(event, "content", None)
    if not content or not getattr(content, "parts", None):
        return ""
    texts: list[str] = []
    for part in content.parts:
        text_value = getattr(part, "text", None)
        if isinstance(text_value, str) and text_value.strip():
            texts.append(text_value.strip())
    return '\n'.join(texts)


async def _execute_root_agent(question: str) -> Dict[str, Any]:
    if root_agent is None:
        raise RuntimeError("Root agent is not initialized")
    if InMemoryRunner is None or genai_types is None:
        raise RuntimeError("google-adk runtime is not available")

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=question)],
    )
    runner = InMemoryRunner(agent=root_agent)
    events: list[Any] = []

    async with runner:
        session_id = str(uuid.uuid4())
        await runner.session_service.create_session(
            app_name=runner.app_name,
            user_id="web-client",
            session_id=session_id,
        )
        async for event in runner.run_async(
            user_id="web-client",
            session_id=session_id,
            new_message=new_message,
        ):
            events.append(event)

    answer = ""
    for event in reversed(events):
        if getattr(event, "author", None) == "user":
            continue
        candidate = _extract_text_from_event(event)
        if candidate:
            answer = candidate
            break

    return {
        "answer": answer.strip(),
    }


def _serialize_agent_result(result: Any) -> Dict[str, Any]:
    if isinstance(result, dict):
        return result
    if result is None:
        return {"answer": ""}
    return {"answer": str(result)}


@app.post("/api/chatbot/query")
async def query_root_chatbot(request: Request, payload: ChatbotQueryRequest):
    if root_agent is None:
        detail = "Chatbot agent is not available."
        if ROOT_AGENT_LOAD_ERROR is not None:
            detail = f"{detail} ({ROOT_AGENT_LOAD_ERROR})"
        raise HTTPException(status_code=503, detail=detail)
    if InMemoryRunner is None or genai_types is None:
        detail = "Chatbot runtime is not configured."
        if RUNNER_IMPORT_ERROR is not None:
            detail = f"{detail} ({RUNNER_IMPORT_ERROR})"
        raise HTTPException(status_code=503, detail=detail)

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    token = extract_token(request)
    claims = decode_token(token)
    user_id = extract_user_id(claims)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user id")

    dataset_id = payload.datasetId.strip()
    if not dataset_id:
        raise HTTPException(status_code=400, detail="datasetId is required.")

    dataset_detail = await request_user_service(
        "GET",
        f"{DATA_FOLDERS_ENDPOINT}/{dataset_id}",
        token,
    )
    folder_meta = dataset_detail.get("folder") or dataset_detail

    artefacts = await load_dataset_artefacts(dataset_id, dataset_detail, user_id=user_id)

    chat_manager = ChatHistoryManager(
        bucket=artefacts.bucket,
        prefix=artefacts.gcs_prefix,
        folder=artefacts.chat_logs_folder,
        user_id=user_id,
        dataset_id=dataset_id,
        mongo_uri=CHAT_MONGO_URI,
    )

    session_id = payload.sessionId.strip() if payload.sessionId else None
    session = None
    if session_id:
        session = await chat_manager.load_session(session_id)
    if session is None:
        session = chat_manager.create_session(session_id)
    if payload.summary:
        session.summary = payload.summary.strip()

    session.append("user", question)

    with dataset_context(artefacts, session):
        try:
            result = await _execute_root_agent(question)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Chatbot agent error: {exc}") from exc

    response_payload = _serialize_agent_result(result)
    if not isinstance(response_payload, dict):
        response_payload = {"answer": response_payload}

    answer_value = response_payload.get("answer")
    if isinstance(answer_value, str):
        answer_text = answer_value.strip()
    else:
        answer_text = str(answer_value) if answer_value is not None else ""

    session.append("assistant", answer_text)

    await chat_manager.save_session(session)

    session_metadata = chat_manager.session_metadata(session)
    dataset_session_entry = {k: v for k, v in session_metadata.items() if k not in {"bucket", "folder"}}
    chat_logs_payload = merge_chat_logs_metadata(
        folder_meta.get("chatLogs") if isinstance(folder_meta, dict) else None,
        dataset_session_entry,
        folder=artefacts.chat_logs_folder,
    )

    try:
        await request_user_service(
            "PATCH",
            f"{DATA_FOLDERS_ENDPOINT}/{dataset_id}",
            token,
            {"chatLogs": chat_logs_payload},
        )
    except HTTPException:
        pass

    response_payload["answer"] = answer_text
    response_payload["sessionId"] = session.session_id
    response_payload["session"] = session_metadata
    return response_payload


@app.get("/chats")
def get_chats():
    return [{"id": cid, "name": f"Chat {cid}"} for cid in chats]

@app.get("/chats/{chat_id}")
def get_chat(chat_id: int):
    return {"id": chat_id, "messages": chats.get(chat_id, [])}

@app.post("/chats")
def create_chat():
    global chat_counter
    chats[chat_counter] = [
        {"role": "bot", "text": "Hello, let's start a new conversation!"}
    ]
    chat_counter += 1
    return {"id": chat_counter - 1, "name": f"Chat {chat_counter - 1}"}

@app.post("/chats/{chat_id}/send")
def send_message(chat_id: int, req: MessageRequest):
    if chat_id not in chats:
        return {"reply": "Chat does not exist."}
    chats[chat_id].append({"role": "user", "text": req.message})
    reply = f"Bot replied: {req.message}"
    chats[chat_id].append({"role": "bot", "text": reply})
    return {"reply": reply}

@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: int):
    if chat_id in chats:
        del chats[chat_id]
        return {"status": "deleted"}
    return {"status": "not_found"}

# ===================== Run app =====================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
