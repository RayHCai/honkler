from typing import Literal

from pydantic import BaseModel

from app.schemas.research import NegotiationPlan


class CallRequest(BaseModel):
    call_id: str
    task_id: str
    phone_number: str
    negotiation_plan: NegotiationPlan
    user_id: str
    wallet_address: str


class CallResponse(BaseModel):
    call_id: str
    status: Literal["initiated", "failed"]
    conversation_id: str | None = None
    twilio_call_sid: str | None = None
    error: str | None = None


class CallOutcome(BaseModel):
    call_id: str
    success: bool
    agreed_price: float | None = None
    agreement_summary: str = ""
    next_steps: list[str] = []
    savings_achieved: float | None = None
    confidence: float = 0.0
    transcript: str | None = None


class CallStatusResponse(BaseModel):
    call_id: str
    status: str
    outcome: CallOutcome | None = None
