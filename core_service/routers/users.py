from asyncpg.exceptions import UniqueViolationError
from fastapi import APIRouter, HTTPException, Depends

from core_service.auth import hash_password, require_admin
from core_service.db import fetch, fetchrow
from core_service.schemas import UserCreate, UserOut


router = APIRouter(prefix="/users",tags=["users"],dependencies=[Depends(require_admin)])


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(user: UserCreate):
    if user.role not in ("admin", "user"):
        raise HTTPException(
            status_code=400,detail="Role must be 'admin' or 'user'"
        )

    if user.employee_id is not None:
        employee = await fetchrow(
            """
            SELECT id
            FROM employees
            WHERE id = $1
            """,
            user.employee_id
        )

        if not employee:
            raise HTTPException(
                status_code=400,detail="Employee not found"
            )

    try:
        row = await fetchrow(
            """
            INSERT INTO users (login, password_hash, role, employee_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, login, role, employee_id
            """,
            user.login,
            hash_password(user.password),
            user.role,
            user.employee_id
        )

    except UniqueViolationError:
        raise HTTPException(
            status_code=409,detail="User with this login already exists"
        )

    return row


@router.get("/", response_model=list[UserOut])
async def get_users():
    rows = await fetch(
        """
        SELECT id, login, role, employee_id
        FROM users
        ORDER BY id
        """
    )

    return rows


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int):
    row = await fetchrow(
        """
        SELECT id, login, role, employee_id
        FROM users
        WHERE id = $1
        """,
        user_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="User not found"
        )

    return row


@router.delete("/{user_id}")
async def delete_user(user_id: int):
    row = await fetchrow(
        """
        DELETE FROM users
        WHERE id = $1
        RETURNING id
        """,
        user_id
    )

    if not row:
        raise HTTPException(
            status_code=404,detail="User not found"
        )

    return {
        "detail": "User deleted"
    }