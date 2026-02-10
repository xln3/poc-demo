from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Optional, Dict, List
from collections import defaultdict
from ..models.schemas import LogEntry, LogType, LogStatus


MAX_QUEUE_SIZE = 1000  # per-client queue cap — prevents OOM if client stops consuming
MAX_CONNECTIONS_PER_SESSION = 5  # prevent memory amplification via many connections


class LogManager:
    """Manages log streams for sessions."""

    def __init__(self):
        self._queues: Dict[str, List[asyncio.Queue]] = defaultdict(list)

    def create_queue(self, session_id: str) -> asyncio.Queue:
        """Create a new log queue for a session.

        Raises ValueError if per-session connection limit is reached.
        """
        if len(self._queues[session_id]) >= MAX_CONNECTIONS_PER_SESSION:
            raise ValueError(f"Max {MAX_CONNECTIONS_PER_SESSION} connections per session")
        queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
        self._queues[session_id].append(queue)
        return queue

    def remove_queue(self, session_id: str, queue: asyncio.Queue):
        """Remove a log queue."""
        if session_id in self._queues and queue in self._queues[session_id]:
            self._queues[session_id].remove(queue)

    async def emit(self, session_id: str, log: LogEntry):
        """Emit a log entry to all queues for a session."""
        if session_id in self._queues:
            for queue in self._queues[session_id]:
                await queue.put(log)

    def emit_sync(self, session_id: str, log: LogEntry):
        """Synchronous version of emit for use in callbacks."""
        if session_id in self._queues:
            for queue in self._queues[session_id]:
                try:
                    queue.put_nowait(log)
                except asyncio.QueueFull:
                    pass

    async def emit_container_log(
        self,
        session_id: str,
        content: str,
        status: LogStatus = LogStatus.NORMAL,
        details: Optional[dict] = None
    ):
        """Emit a container-related log."""
        log = LogEntry(
            type=LogType.CONTAINER,
            content=content,
            status=status,
            timestamp=datetime.now().isoformat(),
            details=details
        )
        await self.emit(session_id, log)

    async def emit_tool_log(
        self,
        session_id: str,
        content: str,
        status: LogStatus = LogStatus.NORMAL,
        details: Optional[dict] = None
    ):
        """Emit a tool-related log."""
        log = LogEntry(
            type=LogType.TOOL,
            content=content,
            status=status,
            timestamp=datetime.now().isoformat(),
            details=details
        )
        await self.emit(session_id, log)


# Singleton instance
log_manager = LogManager()
