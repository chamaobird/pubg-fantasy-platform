# app/routers/admin/__init__.py
from fastapi import APIRouter
from app.routers.admin.championships import router as championships_router
from app.routers.admin.stages import router as stages_router
from app.routers.admin.stage_days import router as stage_days_router
from app.routers.admin.persons import router as persons_router
from app.routers.admin.roster import router as roster_router

router = APIRouter()
router.include_router(championships_router)
router.include_router(stages_router)
router.include_router(stage_days_router)
router.include_router(persons_router)
router.include_router(roster_router)
