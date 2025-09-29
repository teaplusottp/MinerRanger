from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np
from google import genai

from chatbot.dataset_context import get_dataset_context

MODULE_DIR = Path(__file__).resolve().parent

_client = genai.Client()


def get_embedding(text: str):
    """Generate embedding vector for the provided text."""

    if not text or not text.strip():
        return []
    result = _client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
    )
    return result.embeddings[0].values


def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""

    if not vec1 or not vec2:
        return 0.0
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    denominator = float(np.linalg.norm(v1) * np.linalg.norm(v2))
    if denominator == 0:
        return 0.0
    return float(np.dot(v1, v2) / denominator)


def _scored_fields(store: Dict[str, Iterable[float]], query_embedding: List[float]) -> List[Tuple[str, float]]:
    mapping = [
        ("description", "description"),
        ("dataset_overview", "dataset_overview"),
        ("basic_statistics", "basic_statistics"),
        ("process_discovery", "process_discovery"),
        ("performance_analysis", "performance_analysis"),
        ("conformance_checking", "conformance_checking"),
        ("enhancement", "enhancement"),
    ]
    scored: List[Tuple[str, float]] = []
    for store_key, report_key in mapping:
        vector = store.get(store_key)
        if not vector:
            continue
        score = cosine_similarity(query_embedding, vector)
        scored.append((report_key, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored


def _fallback_store_and_report(base_dir: Path) -> Tuple[dict, dict]:
    store_path = base_dir / "store.json"
    report_path = base_dir / "report.json"
    if not store_path.exists() or not report_path.exists():
        raise FileNotFoundError("Missing store.json or report.json for semantic search fallback")
    with store_path.open("r", encoding="utf-8") as f_store:
        store = json.load(f_store)
    with report_path.open("r", encoding="utf-8") as f_report:
        report = json.load(f_report)
    return store, report


def semantic_search(path: str, question: str, top_k: int = 2):
    """Return report sections with the highest semantic similarity to the question."""

    dataset_ctx = get_dataset_context()
    store: Dict[str, Iterable[float]]
    report: dict
    if dataset_ctx and getattr(dataset_ctx, "artefacts", None):
        store = dataset_ctx.artefacts.store
        report = dataset_ctx.artefacts.report
    else:
        base_dir = Path(path)
        if base_dir.is_file():
            base_dir = base_dir.parent
        if not base_dir.exists():
            base_dir = MODULE_DIR
        store, report = _fallback_store_and_report(base_dir)

    query_embedding = get_embedding(question)
    scored = _scored_fields(store, query_embedding)
    if not scored:
        return ({},) * max(1, top_k)

    top_sections = []
    for field_name, _ in scored[: max(1, top_k)]:
        top_sections.append(report.get(field_name, {}))

    while len(top_sections) < top_k:
        top_sections.append({})

    return tuple(top_sections)
