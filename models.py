from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List

class Workers(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(nullable=False)
    email: str = Field(nullable=False, unique=True)
    hash_password: str = Field(nullable=False)
    number: str = Field(nullable=False, unique=True)
    skills: str = Field(nullable=False)
    slave: str = Field(nullable=False)
    icon_url: str = Field(nullable=False)

    # Отношения (исправлены типы и имена)
    schedules: List["Schedule"] = Relationship(back_populates="worker")
    equipments: List["Equipment"] = Relationship(back_populates="worker")

class Schedule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(nullable=False)
    task: str = Field(nullable=False)
    pisun: str = Field(nullable=False)

    # Внешний ключ – должен быть того же типа, что и Workers.id (int)
    worker_id: int = Field(foreign_key="workers.id")

    # Обратная связь
    worker: Workers = Relationship(back_populates="schedules")

class Equipment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(nullable=False)
    type: str = Field(nullable=False)
    serial_number: str = Field(nullable=False)
    status: str = Field(nullable=False)
    place: str = Field(nullable=False)

    # Внешний ключ (отдельное поле, не первичный ключ)
    worker_id: int = Field(foreign_key="workers.id")

    # Обратная связь
    worker: Workers = Relationship(back_populates="equipments")