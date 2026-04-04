from dataclasses import dataclass, field

from fastapi import WebSocket

from app.schemas.research import NegotiationPlan


@dataclass
class CallState:
    call_id: str
    conversation_id: str
    call_sid: str
    plan: NegotiationPlan
    wallet_address: str
    status: str = "in_progress"
    listeners: list[WebSocket] = field(default_factory=list)

    def add_listener(self, ws: WebSocket):
        self.listeners.append(ws)

    def remove_listener(self, ws: WebSocket):
        if ws in self.listeners:
            self.listeners.remove(ws)

    async def broadcast(self, message: dict):
        dead: list[WebSocket] = []
        for ws in self.listeners:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.listeners.remove(ws)

    async def close_listeners(self, code: int = 1000, reason: str = ""):
        for ws in self.listeners:
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass
        self.listeners.clear()


class CallStateManager:
    def __init__(self):
        self._calls: dict[str, CallState] = {}
        self._by_conversation: dict[str, str] = {}
        self._by_call_sid: dict[str, str] = {}

    def register(
        self,
        call_id: str,
        conversation_id: str,
        call_sid: str,
        plan: NegotiationPlan,
        wallet_address: str,
    ) -> CallState:
        state = CallState(
            call_id=call_id,
            conversation_id=conversation_id,
            call_sid=call_sid,
            plan=plan,
            wallet_address=wallet_address,
        )
        self._calls[call_id] = state
        self._by_conversation[conversation_id] = call_id
        self._by_call_sid[call_sid] = call_id
        return state

    def get(self, call_id: str) -> CallState | None:
        return self._calls.get(call_id)

    def get_by_conversation_id(self, conversation_id: str) -> CallState | None:
        call_id = self._by_conversation.get(conversation_id)
        return self._calls.get(call_id) if call_id else None

    def get_by_call_sid(self, call_sid: str) -> CallState | None:
        call_id = self._by_call_sid.get(call_sid)
        return self._calls.get(call_id) if call_id else None

    def remove(self, call_id: str) -> None:
        state = self._calls.pop(call_id, None)
        if state:
            self._by_conversation.pop(state.conversation_id, None)
            self._by_call_sid.pop(state.call_sid, None)
