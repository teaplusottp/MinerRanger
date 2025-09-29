from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from google.cloud import storage
try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:  # pragma: no cover - optional dependency
    AsyncIOMotorClient = None  # type: ignore

ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def _utcnow_iso() -> str:
    return datetime.utcnow().strftime(ISO_FORMAT)


@dataclass(slots=True)
class ChatMessage:
    role: str
    text: str
    timestamp: str = field(default_factory=_utcnow_iso)


@dataclass(slots=True)
class ChatSession:
    user_id: str
    dataset_id: str
    session_id: str
    gcs_folder: str
    gcs_prefix: str = ""
    messages: List[ChatMessage] = field(default_factory=list)
    started_at: str = field(default_factory=_utcnow_iso)
    last_updated: str = field(default_factory=_utcnow_iso)
    summary: str | None = None

    @property
    def blob_path(self) -> str:
        filename = f"{self.session_id}.json"
        prefix = self.gcs_prefix or ""
        folder = self.gcs_folder or ""
        return f"{prefix}{folder}{filename}"

    @property
    def relative_blob_path(self) -> str:
        filename = f"{self.session_id}.json"
        folder = self.gcs_folder or ""
        return f"{folder}{filename}"

    def append(self, role: str, text: str) -> None:
        message = ChatMessage(role=role, text=text.strip())
        self.messages.append(message)
        if len(self.messages) == 1:
            self.started_at = message.timestamp
        self.last_updated = message.timestamp

    def num_turns(self) -> int:
        return sum(1 for message in self.messages if message.role == "user")

    def to_dict(self) -> dict:
        return {
            "sessionId": self.session_id,
            "userId": self.user_id,
            "datasetId": self.dataset_id,
            "startedAt": self.started_at,
            "lastUpdated": self.last_updated,
            "messages": [message.__dict__ for message in self.messages],
            "summary": self.summary or "",
        }

    def to_metadata(self) -> dict:
        return {
            "sessionId": self.session_id,
            "file": self.relative_blob_path,
            "startedAt": self.started_at,
            "endedAt": self.last_updated,
            "numTurns": self.num_turns(),
            "lastUpdated": self.last_updated,
            "summary": self.summary or "",
        }


class GCSChatStore:
    def __init__(self, bucket_name: str):
        self._client = storage.Client()
        self._bucket = self._client.bucket(bucket_name)

    async def load(self, blob_path: str) -> Optional[dict]:
        def _download() -> Optional[bytes]:
            blob = self._bucket.blob(blob_path)
            if not blob.exists():
                return None
            return blob.download_as_bytes()

        data = await asyncio.to_thread(_download)
        if data is None:
            return None
        return json.loads(data.decode("utf-8"))

    async def save(self, blob_path: str, payload: dict) -> None:
        def _upload() -> None:
            blob = self._bucket.blob(blob_path)
            blob.upload_from_string(
                json.dumps(payload, ensure_ascii=False, indent=2),
                content_type="application/json",
            )

        await asyncio.to_thread(_upload)

    async def list_sessions(self, prefix: str) -> List[str]:
        def _list() -> List[str]:
            return [blob.name for blob in self._client.list_blobs(self._bucket, prefix=prefix)]

        return await asyncio.to_thread(_list)


class MongoChatStore:
    def __init__(self, uri: str, *, database: str = "miner", collection: str = "chat_sessions"):
        if AsyncIOMotorClient is None:
            raise RuntimeError("motor is not installed")
        self._client = AsyncIOMotorClient(uri)
        self._collection = self._client[database][collection]

    async def upsert(self, session: ChatSession) -> None:
        await self._collection.update_one(
            {
                "userId": session.user_id,
                "datasetId": session.dataset_id,
                "sessionId": session.session_id,
            },
            {
                "$set": session.to_dict(),
                "$currentDate": {"updatedAt": True},
            },
            upsert=True,
        )

    async def get(self, user_id: str, dataset_id: str, session_id: str) -> Optional[dict]:
        return await self._collection.find_one(
            {
                "userId": user_id,
                "datasetId": dataset_id,
                "sessionId": session_id,
            }
        )


class ChatHistoryManager:
    def __init__(
        self,
        *,
        bucket: str,
        prefix: str,
        folder: str,
        user_id: str,
        dataset_id: str,
        mongo_uri: str | None = None,
    ):
        self._bucket = bucket
        self._prefix = prefix.rstrip('/') + '/' if prefix else ''
        self._folder = folder.strip('/') + '/' if folder else ''
        self._user_id = user_id
        self._dataset_id = dataset_id
        self._gcs_store = GCSChatStore(bucket)
        self._mongo_store = MongoChatStore(mongo_uri) if mongo_uri else None

    @property
    def folder(self) -> str:
        return self._folder

    def _session_blob(self, session_id: str) -> str:
        return f"{self._prefix}{self._folder}{session_id}.json"

    async def load_session(self, session_id: str) -> Optional[ChatSession]:
        blob_path = self._session_blob(session_id)
        payload = await self._gcs_store.load(blob_path)
        if payload is None and self._mongo_store is not None:
            payload = await self._mongo_store.get(self._user_id, self._dataset_id, session_id)
        if payload is None:
            return None
        messages = [ChatMessage(**message) for message in payload.get("messages", [])]
        session = ChatSession(
            user_id=self._user_id,
            dataset_id=self._dataset_id,
            session_id=session_id,
            gcs_folder=self._folder,
            gcs_prefix=self._prefix,
            messages=messages,
            started_at=payload.get("startedAt", payload.get("started_at", _utcnow_iso())),
            last_updated=payload.get("lastUpdated", payload.get("last_updated", _utcnow_iso())),
            summary=payload.get("summary") or payload.get("description"),
        )
        return session

    def create_session(self, session_id: Optional[str] = None) -> ChatSession:
        session_id = session_id or datetime.utcnow().strftime("session-%Y%m%d-%H%M%S")
        return ChatSession(
            user_id=self._user_id,
            dataset_id=self._dataset_id,
            session_id=session_id,
            gcs_folder=self._folder,
            gcs_prefix=self._prefix,
        )

    async def save_session(self, session: ChatSession) -> None:
        payload = session.to_dict()
        await self._gcs_store.save(session.blob_path, payload)
        if self._mongo_store is not None:
            await self._mongo_store.upsert(session)

    async def list_session_blobs(self) -> List[str]:
        prefix = f"{self._prefix}{self._folder}"
        return await self._gcs_store.list_sessions(prefix)

    def session_metadata(self, session: ChatSession) -> dict:
        metadata = session.to_metadata()
        metadata["bucket"] = self._bucket
        metadata["folder"] = self._folder
        return metadata
