from fastapi import FastAPI, UploadFile, File, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import subprocess
import graphviz
import uvicorn
import os
import json
from pydantic import BaseModel

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

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "demo")

if not os.path.exists(STATIC_DIR):
    raise RuntimeError(f"Folder static không tồn tại: {STATIC_DIR}")

# Chỉ mount thôi, không define thêm endpoint /static/{filename}
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/graph")
async def get_graph():
    report_path = os.path.join(STATIC_DIR, "report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "performance_analysis" in data:
        for key, val in data["performance_analysis"].items():
            if isinstance(val, dict) and "img_url" in val:
                filename = os.path.basename(val["img_url"])
                val["img_url"] = f"/static/{filename}"  # frontend fetch đúng URL

    return JSONResponse(content=data)

# @app.get("/static/{filename}")
# def get_static_file(filename: str):
#     file_path = os.path.join(STATIC_DIR, filename)
#     if os.path.exists(file_path):
#         return FileResponse(file_path)
#     return JSONResponse(status_code=404, content={"error": "File not found"})

@app.post("/upload")   # ✅ FastAPI style
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".xes"):
        return JSONResponse(status_code=400, content={"error": "Chỉ chấp nhận file .xes"})

    save_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(save_path, "wb") as f:
        f.write(await file.read())

    return {"message": "Upload thành công", "filename": file.filename}

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
