import json
from google import genai
import numpy as np

client = genai.Client()

def get_embedding(text: str):
    """Hàm lấy embedding cho 1 đoạn text (nếu rỗng thì trả list rỗng)."""
    client = genai.Client()
    if not text.strip():
        return []
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values

def cosine_similarity(vec1, vec2):
    """Tính cosine similarity giữa 2 vector."""
    if not vec1 or not vec2:
        return 0.0
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

def semantic_search(path: str, question: str, top_k: int = 2):
    """
    Tìm kiếm ngữ nghĩa trong store.json dựa trên câu hỏi.

    Inputs:
        path (str): Đường dẫn thư mục chứa store.json.
        question (str): Câu hỏi cần tìm kiếm.
        top_k (int): Số kết quả gần nhất muốn lấy (mặc định = 3).

    Outputs:
        list[dict]: Danh sách các kết quả giống nhất, mỗi phần tử có:
            - section (str): Tên section trong báo cáo.
            - field (str): Trường trong section (description, data_embedding, insights_embedding, Q&A).
            - similarity (float): Điểm cosine similarity.
            - content (str): Nội dung gốc tương ứng.

    Purpose:
        Cho phép truy vấn ngữ nghĩa (semantic search) dựa trên embeddings 
        đã lưu trong store.json.
    """
    # Load dữ liệu store.json
    with open(path + "store.json", "r", encoding="utf-8") as f1:
        store = json.load(f1)

    # Sinh embedding cho câu hỏi
    query_embedding = get_embedding(question)

    result = []
    
    result.append({"field_name": "description", "similarity": cosine_similarity(query_embedding, store["description"])})
    result.append({"field_name": "dataset_overview", "similarity": cosine_similarity(query_embedding, store["dataset_overview"])})
    result.append({"field_name": "basic_statistic", "similarity": cosine_similarity(query_embedding, store["basic_statistics"])})
    result.append({"field_name": "process_discovery", "similarity": cosine_similarity(query_embedding, store["process_discovery"])})
    result.append({"field_name": "performance_analysis", "similarity": cosine_similarity(query_embedding, store["performance_analysis"])})
    result.append({"field_name": "conformance_checking", "similarity": cosine_similarity(query_embedding, store["conformance_checking"])})
    result.append({"field_name": "enhancement", "similarity": cosine_similarity(query_embedding, store["enhancement"])})
    # còn search cái Q&A nữa. CHƯA LÀM.

    # Sắp xếp theo similarity giảm dần
    result = sorted(result, key=lambda x: x["similarity"], reverse=True)
    with open(path + "report.json", "r", encoding="utf-8") as f2:
        data = json.load(f2)

    return data.get(result[0]["field_name"], {}), data.get(result[1]["field_name"], {})