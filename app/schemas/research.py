from typing import Literal

from pydantic import BaseModel


class CompetingOffer(BaseModel):
    provider: str
    service: str
    price: float
    url: str | None = None
    notes: str | None = None


class BillExtraction(BaseModel):
    company_name: str
    service_type: str
    current_price: float
    customer_service_phone: str | None = None
    account_number: str | None = None
    line_items: list[str] = []
    contract_end_date: str | None = None


class NegotiationPlan(BaseModel):
    company_name: str
    service_type: str
    customer_service_phone: str
    summary: str
    current_price: float
    target_price: float
    floor_price: float
    competing_offers: list[CompetingOffer]
    talking_points: list[str]
    fallback_positions: list[str]
    detected_promotions: list[str]
    company_retention_intel: str
    sources: list[str]


class ResearchRequest(BaseModel):
    task_id: str
    company_name: str | None = None
    service_type: str | None = None
    current_price: float | None = None
    currency: str = "USD"
    bill_document_path: str | None = None
    additional_context: str | None = None


class ResearchResponse(BaseModel):
    task_id: str
    status: Literal["completed", "failed"]
    plan: NegotiationPlan | None = None
    error: str | None = None
