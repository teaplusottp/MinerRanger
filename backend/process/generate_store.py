import json
import os
from typing import Any, Dict

from google import genai

from .__init__ import GEMINI_API_KEY as DEFAULT_GEMINI_API_KEY

API_KEY = os.getenv("GEMINI_API_KEY", DEFAULT_GEMINI_API_KEY)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    if _client is None:
        _client = genai.Client(api_key=API_KEY)
    return _client


def _text_from_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "\n".join(map(str, value))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def get_embedding(text: str) -> list[float]:
    if not text or not text.strip():
        return []
    client = _get_client()
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
    )
    return result.embeddings[0].values


def build_store(folder_path: str) -> str:
    if not folder_path:
        raise ValueError("folder_path must be provided")
    report_path = os.path.join(folder_path, "report.json")
    if not os.path.isfile(report_path):
        raise FileNotFoundError(f"report.json not found in {folder_path}")

    with open(report_path, "r", encoding="utf-8") as f:
        report: Dict[str, Any] = json.load(f)

    store: Dict[str, Any] = {
        "description": get_embedding(_text_from_value(report.get("description"))),
        "dataset_overview": [],
        "basic_statistics": [],
        "process_discovery": [],
        "performance_analysis": [],
        "conformance_checking": [],
        "enhancement": [],
        "Q&A": {},
    }

    section_keys = [
        "dataset_overview",
        "basic_statistics",
        "process_discovery",
        "performance_analysis",
        "conformance_checking",
        "enhancement",
    ]

    for key in section_keys:
        section = report.get(key) or {}
        if key == "dataset_overview":
            store[key] = get_embedding(_text_from_value(section))
        else:
            insights_text = _text_from_value(section.get("insights")) if isinstance(section, dict) else _text_from_value(section)
            store[key] = get_embedding(insights_text)

    qa_section = report.get("Q&A") or {}
    if isinstance(qa_section, dict):
        for question, item in qa_section.items():
            if not isinstance(item, dict):
                continue
            question_text = _text_from_value(question)
            answer_text = _text_from_value(item.get("Answer"))
            store["Q&A"][question_text] = {
                "Question": get_embedding(question_text),
                "Answer": get_embedding(answer_text),
            }

    store_path = os.path.join(folder_path, "store.json")
    with open(store_path, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)

    return store_path
