# app/schemas/feedback.py
from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    page: Optional[str] = Field(None, max_length=120)
    message: str = Field(..., min_length=5, max_length=2000)
    rating: Optional[int] = Field(None, ge=1, le=5)
    user_agent: Optional[str] = Field(None, max_length=300)


class FeedbackOut(BaseModel):
    id: int
    user_id: Optional[str]
    page: Optional[str]
    message: str
    rating: Optional[int]
    user_agent: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
