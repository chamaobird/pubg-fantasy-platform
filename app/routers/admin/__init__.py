# app/routers/admin/__init__.py
from fastapi import APIRouter
from app.routers.admin.championships import router as championships_router
from app.routers.admin.stages import router as stages_router

router = APIRouter()
router.include_router(championships_router)
router.include_router(stages_router)
