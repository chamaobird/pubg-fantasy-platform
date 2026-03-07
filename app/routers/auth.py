from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/ping")
def ping():
    return {"status": "ok"}
