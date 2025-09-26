import json
from google import genai
from .__init__ import *   # lấy GEMINI_API_KEY,...

# Tạo client
client = genai.Client(api_key=GEMINI_API_KEY_1)

def get_embedding(text: str):
    """
    Sinh embedding cho một đoạn văn bản bằng mô hình Gemini.

    Inputs:
        text (str): Nội dung văn bản cần sinh embedding.

    Outputs:
        list[float]: Vector embedding (list số thực). 
                     Nếu text rỗng thì trả về list rỗng.

    Purpose:
        Chuẩn hóa bước lấy embedding từ text để tái sử dụng trong toàn bộ pipeline.
    """
    if not text or not str(text).strip():
        return []
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=str(text)
    )
    return result.embeddings[0].values

def build_store(folder_path) -> dict:
    """
    Đọc report.json, sinh embeddings cho từng section, và lưu thành store.json.

    Inputs:
        folder_path (str): Đường dẫn thư mục chứa file report.json. 
                    (Hàm sẽ đọc <folder_path>/report.json và ghi <folder_path>/store.json).

    Cấu trúc store.json:
        dict: Cấu trúc dữ liệu đã sinh embedding.
        keys:
            - description (list[float])
            - dataset_overview (list[float])
            - basic_statistics (dict)
            - process_discovery (dict)
            - performance_analysis (dict)
            - conformance_checking (dict)
            - enhancement (dict)
            - Q&A (dict[str, dict])
                - Question (list[float])
                - Answer (list[float])
        
        Output: True: nếu tạo thành công

    Purpose:
        Tự động chuyển đổi nội dung báo cáo (report.json) thành vector embeddings 
        và lưu lại trong file store.json để dùng cho các tác vụ tìm kiếm, 
        so sánh cosine similarity hoặc truy vấn ngữ nghĩa.
    """
    with open(folder_path + 'report.json', "r", encoding="utf-8") as f:
        report = json.load(f)

    # Khung dữ liệu
    store = {
        "description": get_embedding(report.get("description", "")),
        "dataset_overview": "",
        "basic_statistics": "",
        "process_discovery": "",
        "performance_analysis": "",
        "conformance_checking": "",
        "enhancement": "",
        "Q&A": {}
    }

    # Xử lý các section
    # for key in ["description", "dataset_overview", "basic_statistics", "process_discovery", "performance_analysis", "conformance_checking", "enhancement"]:
    for key in ["dataset_overview", "basic_statistics", "process_discovery", "performance_analysis", "conformance_checking", "enhancement"]:
        if key == "dataset_overview":
            store[key] = get_embedding(str(report.get(key, "")))
        store[key] = get_embedding(str(report.get(key, "").get("insights", "")))
    
    # Lưu file
    with open(folder_path + "store.json", "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)

    return True