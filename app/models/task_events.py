import asyncio
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("app.models.task_events")


@dataclass
class TaskEventManager:
    """In-memory pub/sub for streaming research events to SSE clients."""

    _queues: dict[str, list[asyncio.Queue]] = field(default_factory=dict)

    def subscribe(self, task_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._queues.setdefault(task_id, []).append(queue)
        logger.debug("SSE subscriber added for task %s (total: %d)", task_id, len(self._queues[task_id]))
        return queue

    def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        if task_id in self._queues:
            try:
                self._queues[task_id].remove(queue)
            except ValueError:
                pass
            if not self._queues[task_id]:
                del self._queues[task_id]
        logger.debug("SSE subscriber removed for task %s", task_id)

    async def emit(self, task_id: str, event: dict) -> None:
        for queue in self._queues.get(task_id, []):
            await queue.put(event)

    def has_subscribers(self, task_id: str) -> bool:
        return bool(self._queues.get(task_id))
