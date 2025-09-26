import asyncio
import contextlib
import json
import os
import shutil
import sys
import uuid
from datetime import datetime
from typing import Dict, Optional

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

from process.WebSocketLogger import WebSocketLogger
from process.generate_cleaned import clean_and_save_logs
from process.generate_json import gen_report
from process.__init__ import GEMINI_API_KEY

# ===================== App config =====================

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_ROOT = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "demo")

os.makedirs(UPLOAD_ROOT, exist_ok=True)

if not os.path.exists(STATIC_DIR):
    raise RuntimeError(f"Folder static không t?n t?i: {STATIC_DIR}")

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

def build_dataset_payload(job_id: str, job: JobInfo, cleaned_filename: Optional[str]) -> dict:
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
async def get_graph(request: Request, db: str = Query(..., description="ID d? li?u")):
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
async def get_stats(request: Request, db: str = Query(..., description="ID d? li?u")):
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
            content={"error": "Ch? ch?p nh?n file .xes ho?c .xes.gz"},
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
        "message": "? Upload thành công, b?t d?u x? lý",
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

        dataset_payload = build_dataset_payload(job_id, job_info, cleaned_filename)
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
        "history": ["Cu?c trò chuy?n 1", "Cu?c trò chuy?n 2"],
        "groups": {"Datasets": ["Dataset 1", "Dataset 2", "Dataset 3"]},
    }

# ===================== Chat APIs =====================

chats = {}
chat_counter = 1

class MessageRequest(BaseModel):
    message: str

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
        {"role": "bot", "text": "Xin chào b?n, b?t d?u cu?c trò chuy?n m?i nhé!"}
    ]
    chat_counter += 1
    return {"id": chat_counter - 1, "name": f"Chat {chat_counter - 1}"}

@app.post("/chats/{chat_id}/send")
def send_message(chat_id: int, req: MessageRequest):
    if chat_id not in chats:
        return {"reply": "Chat không t?n t?i."}
    chats[chat_id].append({"role": "user", "text": req.message})
    reply = f"Bot tr? l?i: {req.message}"
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
