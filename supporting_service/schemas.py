from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ReportGenerateRequest(BaseModel):
    report_type: str = Field(pattern="^(summary|shifts|employees|equipment)$")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    status: Optional[str] = None
    employee_id: Optional[int] = None
    equipment_id: Optional[int] = None


class ReportRunOut(BaseModel):
    id: int
    report_type: str
    created_by: Optional[int] = None
    created_by_login: Optional[str] = None
    parameters: dict[str, Any]
    created_at: datetime


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1)
    type: str = Field(default="info", max_length=50)
    user_id: Optional[int] = None


class NotificationOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_login: Optional[str] = None
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
