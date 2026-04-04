from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def check() -> dict:
    return {"status": "ok"}
