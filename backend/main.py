from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
import graphviz
import uvicorn

app = FastAPI()

# Bật CORS để frontend gọi API thoải mái
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hoặc ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
