# app/routers/admin/__init__.py
from fastapi import APIRouter
from app.routers.admin.championships import router as championships_router

router = APIRouter()
router.include_router(championships_router)
