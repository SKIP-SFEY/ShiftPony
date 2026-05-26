from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class EmployeeCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    skills: str = "—"
    login: Optional[str] = None
    password: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    skills: Optional[str] = None


class EmployeeOut(BaseModel):
    id: int
    name: str
    phone: str
    email: str
    skills: str
    login: Optional[str] = None


class EquipmentCreate(BaseModel):
    name: str
    serial_number: str = "—"
    location: str = "—"
    status: str = "Исправно"


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None


class EquipmentOut(BaseModel):
    id: int
    name: str
    serial_number: str
    location: str
    status: str


class ShiftCreate(BaseModel):
    employee_id: int
    date: date
    time: str
    status: str = "Запланирована"
    equipment_id: Optional[int] = None


class ShiftUpdate(BaseModel):
    employee_id: Optional[int] = None
    date: Optional[date] = None
    time: Optional[str] = None
    status: Optional[str] = None
    equipment_id: Optional[int] = None


class ShiftOut(BaseModel):
    id: int
    employee_id: int
    date: date
    time: str
    status: str
    equipment_id: Optional[int] = None
    employee_name: Optional[str] = None
    equipment_name: Optional[str] = None


class UserCreate(BaseModel):
    login: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=4)
    role: str = "user"
    employee_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    login: str
    role: str
    employee_id: Optional[int] = None


class LoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    employeeId: Optional[int] = None
    name: Optional[str] = None
