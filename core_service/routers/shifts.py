from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Depends, status
from core_service.auth import get_current_user, require_admin

from core_service.db import fetch, fetchrow
from core_service.schemas import ShiftCreate, ShiftOut, ShiftUpdate


router = APIRouter(prefix="/shifts", tags=["shifts"])


@router.post("/", response_model=ShiftOut, status_code=201)
async def create_shift(
    shift: ShiftCreate,
    current_user: dict = Depends(require_admin)):
    employee = await fetchrow(
        """
        SELECT id, name
        FROM employees
        WHERE id = $1
        """,
        shift.employee_id
    )

    if not employee:
        raise HTTPException(
            status_code=400,detail="Employee not found"
        )

    equipment_name = None

    if shift.equipment_id is not None:
        equipment = await fetchrow(
            """
            SELECT id, name
            FROM equipment
            WHERE id = $1
            """,
            shift.equipment_id
        )

        if not equipment:
            raise HTTPException(
                status_code=400,detail="Equipment not found"
            )

        equipment_name = equipment["name"]

    row = await fetchrow(
        """
        INSERT INTO shifts (employee_id, shift_date, time, status, equipment_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            employee_id,
            shift_date AS date,
            time,
            status,
            equipment_id
        """,
        shift.employee_id,
        shift.date,
        shift.time,
        shift.status,
        shift.equipment_id
    )

    row["employee_name"] = employee["name"]
    row["equipment_name"] = equipment_name

    return row


@router.get("/", response_model=list[ShiftOut])
async def get_shifts(
    employee_id: int | None = None,
    equipment_id: int | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: Literal["id", "date", "time", "status"] = "date",
    order: Literal["asc", "desc"] = "asc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        employee_id = current_user["employee_id"]

        if employee_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,detail="User is not linked to employee"
            )

    sort_columns = {
        "id": "s.id",
        "date": "s.shift_date",
        "time": "s.time",
        "status": "s.status"
    }

    sort_column = sort_columns[sort_by]
    order_sql = "DESC" if order == "desc" else "ASC"

    offset = (page - 1) * page_size

    query = f"""
        SELECT
            s.id,
            s.employee_id,
            s.shift_date AS date,
            s.time,
            s.status,
            s.equipment_id,
            e.name AS employee_name,
            eq.name AS equipment_name
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN equipment eq ON s.equipment_id = eq.id
        WHERE
            ($1::int IS NULL OR s.employee_id = $1)
            AND ($2::int IS NULL OR s.equipment_id = $2)
            AND ($3::text IS NULL OR s.status = $3)
            AND ($4::date IS NULL OR s.shift_date >= $4)
            AND ($5::date IS NULL OR s.shift_date <= $5)
        ORDER BY {sort_column} {order_sql}
        LIMIT $6 OFFSET $7
    """

    rows = await fetch(
        query,
        employee_id,
        equipment_id,
        status,
        date_from,
        date_to,
        page_size,
        offset
    )

    return rows


@router.get("/{shift_id}", response_model=ShiftOut)
async def get_shift(
    shift_id: int,
    current_user: dict = Depends(get_current_user)
):
    row = await fetchrow(
        """
        SELECT
            s.id,
            s.employee_id,
            s.shift_date AS date,
            s.time,
            s.status,
            s.equipment_id,
            e.name AS employee_name,
            eq.name AS equipment_name
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN equipment eq ON s.equipment_id = eq.id
        WHERE s.id = $1
        """,
        shift_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="Shift not found"
        )
    if current_user["role"] != "admin" and current_user["employee_id"] != row["employee_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,detail="You can open only your own shifts"
        )

    return row


@router.patch("/{shift_id}", response_model=ShiftOut)
async def update_shift(
    shift_id: int,
    shift: ShiftUpdate,
    current_user: dict = Depends(require_admin)):
    existing_shift = await fetchrow(
        """
        SELECT id
        FROM shifts
        WHERE id = $1
        """,
        shift_id
    )

    if not existing_shift:
        raise HTTPException(
            status_code=404,detail="Shift not found"
        )

    if shift.employee_id is not None:
        employee = await fetchrow(
            """
            SELECT id
            FROM employees
            WHERE id = $1
            """,
            shift.employee_id
        )

        if not employee:
            raise HTTPException(
                status_code=400,detail="Employee not found"
            )

    if shift.equipment_id is not None:
        equipment = await fetchrow(
            """
            SELECT id
            FROM equipment
            WHERE id = $1
            """,
            shift.equipment_id
        )

        if not equipment:
            raise HTTPException(
                status_code=400,detail="Equipment not found"
            )

    updated = await fetchrow(
        """
        UPDATE shifts
        SET
            employee_id = COALESCE($1, employee_id),
            shift_date = COALESCE($2, shift_date),
            time = COALESCE($3, time),
            status = COALESCE($4, status),
            equipment_id = COALESCE($5, equipment_id)
        WHERE id = $6
        RETURNING id
        """,
        shift.employee_id,
        shift.date,
        shift.time,
        shift.status,
        shift.equipment_id,
        shift_id
    )

    result = await fetchrow(
        """
        SELECT
            s.id,
            s.employee_id,
            s.shift_date AS date,
            s.time,
            s.status,
            s.equipment_id,
            e.name AS employee_name,
            eq.name AS equipment_name
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN equipment eq ON s.equipment_id = eq.id
        WHERE s.id = $1
        """,
        updated["id"]
    )

    return result


@router.delete("/{shift_id}")
async def delete_shift(
    shift_id: int,
    current_user: dict = Depends(require_admin)):
    row = await fetchrow(
        """
        DELETE FROM shifts
        WHERE id = $1
        RETURNING id
        """,
        shift_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="Shift not found"
        )

    return {
        "detail": "Shift deleted"
    }