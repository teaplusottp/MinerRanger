from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import graphviz
import uvicorn
import os
from fastapi import FastAPI, Query

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

app = FastAPI()

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

@app.get("/databases")
def get_databases():
    return {"databases": ["MySQL", "PostgreSQL", "MongoDB", "SQLite"]}

@app.get("/graph")
async def generate_graph():
    # Tạo đồ thị demo
    dot = graphviz.Digraph(comment="Demo Graph")
    dot.node("A", "Start")
    dot.node("B", "Process")
    dot.node("C", "End")
    dot.edge("A", "B")
    dot.edge("B", "C")

    # Xuất ra PNG binary
    img_bytes = dot.pipe(format="png")
    return Response(content=img_bytes, media_type="image/png")

@app.post("/upload")   # ✅ FastAPI style
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".xes"):
        return JSONResponse(status_code=400, content={"error": "Chỉ chấp nhận file .xes"})

    save_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(save_path, "wb") as f:
        f.write(await file.read())

    return {"message": "Upload thành công", "filename": file.filename}

@app.get("/stats")
def get_stats():
    return {
        "users": {
            "value": 26000,
            "change": -12.4,
            "data": [78, 81, 80, 45, 34, 12, 40, 85, 65, 23, 12, 98, 34, 84, 67, 82],
        },
        "income": {
            "value": 6200,
            "change": 40.9,
            "data": [1, 18, 9, 17, 34, 22, 11, 24, 16, 11, 19, 28, 34, 12, 20, 40],
        },
        "conversion": {
            "value": 2.49,
            "change": 84.7,
            "data": [65, 59, 84, 84, 51, 55, 40],
        },
        "sessions": {
            "value": 44000,
            "change": -23.6,
            "data": [78, 81, 80, 45, 34, 12, 40, 85, 65, 23, 12, 98, 34, 84, 67, 82],
        },
    }

@app.get("/api/sidebar")
def get_sidebar():
    return {
        "history": ["Cuộc trò chuyện 1", "Cuộc trò chuyện 2"],
        "groups": {
            "Datasets": ["Dataset 1", "Dataset 2", "Dataset 3"]
        },
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
