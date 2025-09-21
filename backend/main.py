from fastapi import FastAPI, UploadFile, File, Response, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
import subprocess
import graphviz
import uvicorn
import os
import json
from pydantic import BaseModel

from process.generate_cleaned import clean_and_save_logs 
from process.generate_json import gen_report
from process.__init__ import *

app = FastAPI()

# dữ liệu giả theo từng DB
stats_data = {
    "DB1": {
        "users": {"value": 26000, "change": -12.4, "data": [78, 81, 80, 45, 34, 12, 40, 85, 65, 23, 12, 98, 34, 84, 67, 82]},
        "income": {"value": 6200, "change": 40.9, "data": [1, 18, 9, 17, 34, 22, 11, 24, 16, 11, 19, 28, 34, 12, 20, 40]},
        "conversion": {"value": 2.49, "change": 84.7, "data": [65, 59, 84, 84, 51, 55, 40]},
        "sessions": {"value": 44000, "change": -23.6, "data": [78, 81, 80, 45, 34, 12, 40, 85, 65, 23, 12, 98, 34, 84, 67, 82]},
    },
    "DB2": {
        "users": {"value": 18000, "change": 5.2, "data": [20, 30, 50, 60, 80, 70]},
        "income": {"value": 3500, "change": -10.1, "data": [10, 20, 15, 25, 30]},
        "conversion": {"value": 1.1, "change": 15.4, "data": [10, 15, 20, 18, 25]},
        "sessions": {"value": 30000, "change": 3.5, "data": [40, 50, 60, 70, 80]},
    },
    # DB3, DB4 có thể add tiếp...
}

@app.get("/databases")
def get_databases():
    return {"databases": list(stats_data.keys())}

@app.get("/stats")
def get_stats(db: str = Query("DB1")):
    return stats_data.get(db, {})


UPLOAD_FOLDER = "./uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Bật CORS để frontend gọi API thoải mái
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # có thể fix thành ["http://localhost:5173"] nếu bạn chạy frontend ở Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/graph")
async def get_graph():
    report_path = os.path.join(os.path.dirname(__file__), "demo", "report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    note: str = Form(None)   # text nhập từ frontend
):
    if not file.filename.endswith(".xes") and not file.filename.endswith(".xes.gz"):
        return JSONResponse(status_code=400, content={"error": "Chỉ chấp nhận file .xes hoặc .xes.gz"})

    # Tạo folder con theo tên file (bỏ đuôi .xes)
    folder_name = os.path.splitext(file.filename)[0]
    save_dir = os.path.join(UPLOAD_FOLDER, folder_name)
    os.makedirs(save_dir, exist_ok=True)

    # Lưu file .xes
    save_path = os.path.join(save_dir, file.filename)
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # Nếu có note thì ghi vào README.txt
    if note:
        readme_path = os.path.join(save_dir, "README.txt")
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(note)

    # ✅ Gọi convert_xes sau khi upload xong
    try:
        generated_file = clean_and_save_logs(folder_path = UPLOAD_FOLDER + '/' + folder_name + '/', GEMINI_API_KEY=GEMINI_API_KEY)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Lỗi khi gen clean event logs: {str(e)}"})
    
    # ✅ Create report.json
    try:
        generated_report = gen_report(folder_path = UPLOAD_FOLDER + '/' + folder_name + '/', GEMINI_API_KEY=GEMINI_API_KEY)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Lỗi khi gen report file: {str(e)}"})

    return {
        "message": "✅ Upload + Gen thành công",
        "filename": file.filename,
        "folder": folder_name,
        "note": note or "",
        "generated_file": generated_file, # đường dẫn file cleaned
        "generate_report": generated_report # file report đã được tạo ra chưa? 
    }
@app.get("/api/sidebar")
def get_sidebar():
    return {
        "history": ["Cuộc trò chuyện 1", "Cuộc trò chuyện 2"],
        "groups": {
            "Datasets": ["Dataset 1", "Dataset 2", "Dataset 3"]
        },
    }


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
    chats[chat_counter] = [{"role": "bot", "text": "Xin chào 👋, bắt đầu chat mới nhé!"}]
    chat_counter += 1
    return {"id": chat_counter - 1, "name": f"Chat {chat_counter - 1}"}

@app.post("/chats/{chat_id}/send")
def send_message(chat_id: int, req: MessageRequest):
    if chat_id not in chats:
        return {"reply": "Chat không tồn tại."}
    chats[chat_id].append({"role": "user", "text": req.message})
    reply = f"Bot trả lời: {req.message}"
    chats[chat_id].append({"role": "bot", "text": reply})
    return {"reply": reply}

@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: int):
    if chat_id in chats:
        del chats[chat_id]
        return {"status": "deleted"}
    return {"status": "not_found"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
