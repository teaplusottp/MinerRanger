from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import httpx

CACHE_ROOT = Path(__file__).resolve().parent / "_cache"
CACHE_ROOT.mkdir(parents=True, exist_ok=True)


@dataclass(slots=True)
class DatasetFile:
    type: str
    name: str
    url: str

    @property
    def basename(self) -> str:
        return os.path.basename(self.name)


@dataclass(slots=True)
class DatasetArtefacts:
    dataset_id: str
    user_id: str
    store: dict
    report: dict
    files_by_type: Dict[str, DatasetFile]
    files_by_name: Dict[str, DatasetFile]
    bucket: str
    gcs_prefix: str
    chat_logs_folder: str
    local_dir: Path
    loaded_at: datetime = field(default_factory=lambda: datetime.utcnow())

    def ensure_local_file(self, identifier: str, *, file_type: Optional[str] = None) -> Path:
        """Return path to cached file by name or type, downloading if necessary."""

        file_info = None
        if file_type:
            file_info = self.files_by_type.get(file_type)
        if file_info is None:
            file_info = self.files_by_name.get(identifier)
        if file_info is None and file_type is None:
            # try fallback by type guessed from identifier
            file_info = self.files_by_type.get(identifier)
        if file_info is None:
            raise FileNotFoundError(f"Dataset file not found: {identifier}")

        target_path = self.local_dir / file_info.basename
        if not target_path.exists():
            target_path.parent.mkdir(parents=True, exist_ok=True)
            _download_file_sync(file_info.url, target_path)
        return target_path

    def register_local_file(self, path: Path) -> Path:
        """Record a newly generated local file so subsequent calls can resolve it."""

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.files_by_name[path.name] = DatasetFile(
            type=f"generated:{path.suffix.lstrip('.')}",
            name=path.name,
            url=str(path.as_posix()),
        )
        return path

    def to_metadata(self) -> dict:
        return {
            "datasetId": self.dataset_id,
            "bucket": self.bucket,
            "gcsPrefix": self.gcs_prefix,
            "chatLogsFolder": self.chat_logs_folder,
            "localDir": str(self.local_dir),
            "loadedAt": self.loaded_at.isoformat() + "Z",
        }


def _parse_gcs_url(url: str) -> Tuple[str, str]:
    if url.startswith("gs://"):
        without_scheme = url[5:]
        bucket, _, path = without_scheme.partition('/')
        if not path:
            raise ValueError(f"Invalid GCS url: {url}")
        return bucket, path

    parsed = urlparse(url)
    if parsed.netloc not in {"storage.googleapis.com", "storage.cloud.google.com"}:
        raise ValueError(f"Unsupported GCS HTTP url: {url}")
    path = parsed.path.lstrip('/')
    segments = path.split('/', 1)
    if len(segments) != 2:
        raise ValueError(f"Invalid GCS HTTP url: {url}")
    return segments[0], segments[1]


def _download_file_sync(url: str, target_path: Path) -> None:
    """Blocking helper used in threads to fetch remote artefacts."""

    target_path.parent.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=120.0) as client:
        response = client.get(url)
        response.raise_for_status()
        target_path.write_bytes(response.content)


async def _download_json(url: str) -> dict:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


def _materialize_files(files: Iterable[dict]) -> Tuple[Dict[str, DatasetFile], Dict[str, DatasetFile]]:
    files_by_type: Dict[str, DatasetFile] = {}
    files_by_name: Dict[str, DatasetFile] = {}
    for item in files:
        file_type = item.get("type")
        name = item.get("name")
        url = item.get("url")
        if not (file_type and name and url):
            continue
        dataset_file = DatasetFile(type=file_type, name=name, url=url)
        files_by_type[file_type] = dataset_file
        files_by_name[name] = dataset_file
        files_by_name[os.path.basename(name)] = dataset_file
    return files_by_type, files_by_name


def _determine_prefix(reference_url: str, suggested_folder: Optional[str]) -> Tuple[str, str, str]:
    bucket, path = _parse_gcs_url(reference_url)
    base_dir = path
    markers = ["/report/", "/store/", "/log/"]
    for marker in markers:
        marker_idx = path.lower().find(marker)
        if marker_idx != -1:
            base_dir = path[:marker_idx]
            break
    base_dir = base_dir.rstrip('/') + '/'
    chat_logs_folder = (suggested_folder or "chat_logs/").strip('/') + '/'
    return bucket, base_dir, chat_logs_folder


async def load_dataset_artefacts(
    dataset_id: str,
    dataset_payload: dict,
    *,
    user_id: str,
) -> DatasetArtefacts:
    folder = dataset_payload.get("folder") or dataset_payload
    files = folder.get("files", [])
    if not files:
        raise RuntimeError("Dataset payload does not include artefact files")

    files_by_type, files_by_name = _materialize_files(files)

    store_file = files_by_type.get("store")
    report_file = files_by_type.get("report")

    if store_file is None or report_file is None:
        raise RuntimeError("Dataset is missing store.json or report.json artefacts")

    store_data, report_data = await asyncio.gather(
        _download_json(store_file.url),
        _download_json(report_file.url),
    )

    suggested_chat_logs = None
    chat_logs_info = folder.get("chatLogs") or dataset_payload.get("chatLogs")
    if isinstance(chat_logs_info, dict):
        suggested_chat_logs = chat_logs_info.get("folder")

    bucket, prefix, chat_logs_folder = _determine_prefix(report_file.url, suggested_chat_logs)

    local_dir = CACHE_ROOT / user_id / dataset_id
    local_dir.mkdir(parents=True, exist_ok=True)

    # Persist store/report locally for debugging purposes
    (local_dir / "store.json").write_text(json.dumps(store_data, ensure_ascii=False, indent=2), encoding="utf-8")
    (local_dir / "report.json").write_text(json.dumps(report_data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Ensure cleaned log is cached if available
    log_file = files_by_type.get("log_cleaned") or files_by_type.get("log_raw")
    if log_file is not None:
        await asyncio.to_thread(_download_file_sync, log_file.url, local_dir / os.path.basename(log_file.name))

    artefacts = DatasetArtefacts(
        dataset_id=dataset_id,
        user_id=user_id,
        store=store_data,
        report=report_data,
        files_by_type=files_by_type,
        files_by_name=files_by_name,
        bucket=bucket,
        gcs_prefix=prefix,
        chat_logs_folder=chat_logs_folder,
        local_dir=local_dir,
    )

    return artefacts
