from typing import Literal

from asyncpg.exceptions import UniqueViolationError
from fastapi import APIRouter, HTTPException, Query, Depends, status

from core_service.auth import hash_password, require_admin, get_current_user
from core_service.db import _check_pool, fetch, fetchrow
from core_service.schemas import EmployeeCreate, EmployeeOut, EmployeeUpdate


router = APIRouter(prefix="/employees", tags=["employees"])


@router.post("/", response_model=EmployeeOut, status_code=201)
async def create_employee(employee: EmployeeCreate,current_user: dict = Depends(require_admin)):
    login = employee.login.strip() if employee.login else None
    password = employee.password.strip() if employee.password else None

    if login or password:
        if not login or not password:
            raise HTTPException(
                status_code=400,detail="Login and password must be filled together"
            )

        if len(login) < 3:
            raise HTTPException(status_code=400, detail="Login is too short")

        if len(password) < 4:
            raise HTTPException(status_code=400, detail="Password is too short")

    try:
        db_pool = _check_pool()

        async with db_pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO employees (name, phone, email, skills)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, name, phone, email, skills
                    """,
                    employee.name,
                    employee.phone,
                    employee.email,
                    employee.skills
                )

                result = dict(row)
                result["login"] = None

                if login and password:
                    await connection.fetchrow(
                        """
                        INSERT INTO users (login, password_hash, role, employee_id)
                        VALUES ($1, $2, 'user', $3)
                        RETURNING id
                        """,
                        login,
                        hash_password(password),
                        result["id"]
                    )
                    result["login"] = login

                return result

    except UniqueViolationError:
        raise HTTPException(
            status_code=409,detail="User with this login already exists"
        )


@router.get("/", response_model=list[EmployeeOut])
async def get_employees(
    search: str | None = None,
    sort_by: Literal["id", "name", "email"] = "id",
    order: Literal["asc", "desc"] = "asc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(require_admin)
):
    sort_columns = {
        "id": "e.id",
        "name": "e.name",
        "email": "e.email"
    }

    sort_column = sort_columns[sort_by]
    order_sql = "DESC" if order == "desc" else "ASC"
    offset = (page - 1) * page_size

    query = f"""
        SELECT
            e.id,
            e.name,
            e.phone,
            e.email,
            e.skills,
            u.login
        FROM employees e
        LEFT JOIN users u ON u.employee_id = e.id
        WHERE (
            $1::text IS NULL
            OR e.name ILIKE '%' || $1 || '%'
            OR e.email ILIKE '%' || $1 || '%'
            OR u.login ILIKE '%' || $1 || '%'
        )
        ORDER BY {sort_column} {order_sql}
        LIMIT $2 OFFSET $3
    """

    return await fetch(query, search, page_size, offset)


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: int,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin" and current_user["employee_id"] != employee_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You can open only your own employee profile"
        )

    row = await fetchrow(
        """
        SELECT
            e.id,
            e.name,
            e.phone,
            e.email,
            e.skills,
            u.login
        FROM employees e
        LEFT JOIN users u ON u.employee_id = e.id
        WHERE e.id = $1
        """,
        employee_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")

    return row

@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: int,
    employee: EmployeeUpdate,
    current_user: dict = Depends(require_admin)
):
    row = await fetchrow(
        """
        UPDATE employees
        SET
            name = COALESCE($1, name),
            phone = COALESCE($2, phone),
            email = COALESCE($3, email),
            skills = COALESCE($4, skills)
        WHERE id = $5
        RETURNING id
        """,
        employee.name,
        employee.phone,
        employee.email,
        employee.skills,
        employee_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")

    return await get_employee(employee_id, current_user)


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: dict = Depends(require_admin)
):
    row = await fetchrow(
        """
        DELETE FROM employees
        WHERE id = $1
        RETURNING id
        """,
        employee_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {"detail": "Employee deleted"}
