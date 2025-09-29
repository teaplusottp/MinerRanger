from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, Iterator, Optional


@dataclass(slots=True)
class DatasetContext:
    """Holds dataset artefacts and chat session scoped to current request."""

    artefacts: Any
    session: Any | None = None


_DATASET_CONTEXT: ContextVar[Optional[DatasetContext]] = ContextVar(
    "dataset_context", default=None
)


def get_dataset_context() -> Optional[DatasetContext]:
    """Return current dataset context if available."""

    return _DATASET_CONTEXT.get()


def activate_dataset_context(artefacts: Any, session: Any | None = None):
    """Set dataset context; returns token for reset."""

    return _DATASET_CONTEXT.set(DatasetContext(artefacts=artefacts, session=session))


def reset_dataset_context(token: Any) -> None:
    """Reset dataset context using provided token."""

    _DATASET_CONTEXT.reset(token)


@contextmanager
def dataset_context(artefacts: Any, session: Any | None = None) -> Iterator[DatasetContext]:
    """Convenience async-safe context manager for temporary dataset context."""

    token = activate_dataset_context(artefacts=artefacts, session=session)
    try:
        yield _DATASET_CONTEXT.get()
    finally:
        reset_dataset_context(token)
