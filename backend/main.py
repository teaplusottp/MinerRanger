from fastapi import FastAPI, UploadFile, File, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, UploadFile, File, Response, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import uvicorn
import os
import json
from pydantic import BaseModel



# Import các hàm xử lý riêng
from process.generate_cleaned import clean_and_save_logs 
from process.generate_json import gen_report
from process.__init__ import *   # lấy GEMINI_API_KEY,...


# ===================== App config =====================
app = FastAPI()

UPLOAD_FOLDER = "./uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Bật CORS để frontend gọi API thoải mái
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # có thể fix thành ["http://localhost:5173"] nếu chạy local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "demo")

if not os.path.exists(STATIC_DIR):
    raise RuntimeError(f"Folder static không tồn tại: {STATIC_DIR}")

# Chỉ mount thôi, không define thêm endpoint /static/{filename}
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")



# ===================== Utils =====================
def get_folder_name(filename: str) -> str:
    """
    Trả về tên folder dựa trên tên file:
    - Nếu file kết thúc bằng .xes.gz → bỏ cả .xes.gz
    - Nếu file kết thúc bằng .xes → bỏ .xes
    - Ngược lại → dùng tên không có extension
    """
    if filename.endswith(".xes.gz"):
        return filename[:-7]
    elif filename.endswith(".xes"):
        return filename[:-4]
    return os.path.splitext(filename)[0]


# ===================== APIs =====================
@app.get("/databases")
def get_databases():
    """Lấy danh sách folder trong uploads"""
    folders = [
        name for name in os.listdir(UPLOAD_FOLDER)
        if os.path.isdir(os.path.join(UPLOAD_FOLDER, name))
    ]
    return {"databases": folders}


@app.get("/graph")
async def get_graph():
    report_path = os.path.join(os.path.dirname(__file__), "demo", "report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "performance_analysis" in data:
        for key, val in data["performance_analysis"].items():
            if isinstance(val, dict) and "img_url" in val:
                filename = os.path.basename(val["img_url"])
                val["img_url"] = f"http://localhost:8000/static/{filename}"

    return JSONResponse(content=data)


@app.get("/stats")
def get_stats(db):
    """Trả về report của DB đã upload"""
    report_path = os.path.join(UPLOAD_FOLDER, db, "report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    note: str = Form(None)   # text nhập từ frontend
):
    """Upload file .xes/.xes.gz và xử lý"""
    # Validate file
    if not (file.filename.endswith(".xes") or file.filename.endswith(".xes.gz")):
        return JSONResponse(
            status_code=400, 
            content={"error": "Chỉ chấp nhận file .xes hoặc .xes.gz"}
        )

    # Tạo folder theo tên file
    folder_name = get_folder_name(file.filename)
    save_dir = os.path.join(UPLOAD_FOLDER, folder_name)
    os.makedirs(save_dir, exist_ok=True)

    # Lưu file gốc
    save_path = os.path.join(save_dir, file.filename)
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # Ghi note nếu có
    if note:
        readme_path = os.path.join(save_dir, "README.txt")
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(note)

    # Xử lý file: clean logs + gen report
    try:
        generated_file = clean_and_save_logs(
            folder_path=os.path.join(UPLOAD_FOLDER, folder_name) + "/",
            GEMINI_API_KEY=GEMINI_API_KEY
        )
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Lỗi khi gen clean event logs: {str(e)}"}
        )
    
    try:
        generated_report = gen_report(
            folder_path=os.path.join(UPLOAD_FOLDER, folder_name) + "/",
            GEMINI_API_KEY=GEMINI_API_KEY
        )
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Lỗi khi gen report file: {str(e)}"}
        )

    return {
        "message": "✅ Upload + Gen thành công",
        "filename": file.filename,
        "folder": folder_name,
        "note": note or "",
        "generated_file": generated_file, 
        "generate_report": generated_report
    }


@app.get("/api/sidebar")
def get_sidebar():
    """API cho sidebar frontend"""
    return {
        "history": ["Cuộc trò chuyện 1", "Cuộc trò chuyện 2"],
        "groups": {"Datasets": ["Dataset 1", "Dataset 2", "Dataset 3"]},
    }


# ===================== Chat APIs =====================
chats = {}
chat_counter = 1

class MessageRequest(BaseModel):
    message: str


@app.get("/chats")
def get_chats():
    """Lấy danh sách chat"""
    return [{"id": cid, "name": f"Chat {cid}"} for cid in chats]


@app.get("/chats/{chat_id}")
def get_chat(chat_id: int):
    """Lấy nội dung 1 chat"""
    return {"id": chat_id, "messages": chats.get(chat_id, [])}


@app.post("/chats")
def create_chat():
    """Tạo chat mới"""
    global chat_counter
    chats[chat_counter] = [{"role": "bot", "text": "Xin chào 👋, bắt đầu chat mới nhé!"}]
    chat_counter += 1
    return {"id": chat_counter - 1, "name": f"Chat {chat_counter - 1}"}


@app.post("/chats/{chat_id}/send")
def send_message(chat_id: int, req: MessageRequest):
    """Gửi tin nhắn trong chat"""
    if chat_id not in chats:
        return {"reply": "Chat không tồn tại."}
    
    chats[chat_id].append({"role": "user", "text": req.message})
    reply = f"Bot trả lời: {req.message}"
    chats[chat_id].append({"role": "bot", "text": reply})
    
    return {"reply": reply}


@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: int):
    """Xoá chat"""
    if chat_id in chats:
        del chats[chat_id]
        return {"status": "deleted"}
    return {"status": "not_found"}


# ===================== Run app =====================
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
