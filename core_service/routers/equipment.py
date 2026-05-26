from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Depends

from core_service.auth import require_admin
from core_service.db import fetch, fetchrow
from core_service.schemas import EquipmentCreate, EquipmentOut, EquipmentUpdate


router = APIRouter(prefix="/equipment",tags=["equipment"],dependencies=[Depends(require_admin)])


@router.post("/", response_model=EquipmentOut, status_code=201)
async def create_equipment(equipment: EquipmentCreate):
    row = await fetchrow(
        """
        INSERT INTO equipment (name, serial_number, location, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, serial_number, location, status
        """,
        equipment.name,
        equipment.serial_number,
        equipment.location,
        equipment.status
    )

    return row


@router.get("/", response_model=list[EquipmentOut])
async def get_equipment(
    search: str | None = None,
    status: str | None = None,
    sort_by: Literal["id", "name", "status", "location"] = "id",
    order: Literal["asc", "desc"] = "asc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100)
):
    sort_columns = {
        "id": "id",
        "name": "name",
        "status": "status",
        "location": "location"
    }

    sort_column = sort_columns[sort_by]
    order_sql = "DESC" if order == "desc" else "ASC"

    offset = (page - 1) * page_size

    query = f"""
        SELECT id, name, serial_number, location, status
        FROM equipment
        WHERE
            (
                $1::text IS NULL
                OR name ILIKE '%' || $1 || '%'
                OR serial_number ILIKE '%' || $1 || '%'
            )
            AND ($2::text IS NULL OR status = $2)
        ORDER BY {sort_column} {order_sql}
        LIMIT $3 OFFSET $4
    """

    rows = await fetch(query, search, status, page_size, offset)

    return rows


@router.get("/{equipment_id}", response_model=EquipmentOut)
async def get_equipment_by_id(equipment_id: int):
    row = await fetchrow(
        """
        SELECT id, name, serial_number, location, status
        FROM equipment
        WHERE id = $1
        """,
        equipment_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="Equipment not found"
        )

    return row


@router.patch("/{equipment_id}", response_model=EquipmentOut)
async def update_equipment(equipment_id: int, equipment: EquipmentUpdate):
    row = await fetchrow(
        """
        UPDATE equipment
        SET
            name = COALESCE($1, name),
            serial_number = COALESCE($2, serial_number),
            location = COALESCE($3, location),
            status = COALESCE($4, status)
        WHERE id = $5
        RETURNING id, name, serial_number, location, status
        """,
        equipment.name,
        equipment.serial_number,
        equipment.location,
        equipment.status,
        equipment_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="Equipment not found"
        )

    return row


@router.delete("/{equipment_id}")
async def delete_equipment(equipment_id: int):
    row = await fetchrow(
        """
        DELETE FROM equipment
        WHERE id = $1
        RETURNING id
        """,
        equipment_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="Equipment not found"
        )

    return {
        "detail": "Equipment deleted"
    }