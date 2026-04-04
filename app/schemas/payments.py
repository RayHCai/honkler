from pydantic import BaseModel


class SettlementResult(BaseModel):
    charged: bool
    reason: str | None = None
    transaction_id: str | None = None
    amount: float | None = None
