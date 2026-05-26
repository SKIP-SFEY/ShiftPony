from datetime import date

from fastapi import APIRouter, Depends

from core_service.auth import require_admin
from core_service.db import fetch, fetchval


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats")
async def get_admin_stats():
    employees_count = await fetchval(
        """
        SELECT count(*)
        FROM employees
        """
    )

    equipment_count = await fetchval(
        """
        SELECT count(*)
        FROM equipment
        """
    )

    total_shifts = await fetchval(
        """
        SELECT count(*)
        FROM shifts
        """
    )

    shifts_today = await fetchval(
        """
        SELECT count(*)
        FROM shifts
        WHERE shift_date = $1
        """,
        date.today()
    )

    return {
        "employeesCount": employees_count,
        "equipmentCount": equipment_count,
        "totalShifts": total_shifts,
        "shiftsToday": shifts_today
    }


@router.get("/shifts/today")
async def get_today_shifts():
    rows = await fetch(
        """
        SELECT
            s.id,
            s.shift_date AS date,
            s.time,
            s.status,
            e.name AS "employeeName",
            eq.name AS "equipmentName"
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN equipment eq ON s.equipment_id = eq.id
        WHERE s.shift_date = $1
        ORDER BY s.time
        """,
        date.today()
    )

    return rows


@router.get("/stats/shifts-by-status")
async def get_shifts_by_status():
    rows = await fetch(
        """
        SELECT status, count(*) AS count
        FROM shifts
        GROUP BY status
        ORDER BY count DESC
        """
    )

    return rows


@router.get("/stats/equipment-by-status")
async def get_equipment_by_status():
    rows = await fetch(
        """
        SELECT status, count(*) AS count
        FROM equipment
        GROUP BY status
        ORDER BY count DESC
        """
    )

    return rows