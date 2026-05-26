from asyncpg.exceptions import UniqueViolationError
from fastapi import APIRouter, HTTPException
from starlette.responses import RedirectResponse

from core_service.auth import create_access_token, hash_password, verify_password
from core_service.db import fetchrow
from core_service.schemas import LoginRequest, TokenResponse, UserCreate, UserOut


router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserOut, status_code=201)
async def register_user(user: UserCreate):

    if user.role not in ("admin", "user"):
        raise HTTPException(status_code=400,detail="Role must be 'admin' or 'user'"
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
        created_user = await fetchrow(
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
        raise HTTPException(status_code=409,detail="User with this login already exists"
        )

    return created_user


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):

    user = await fetchrow(
        """
        SELECT id, login, password_hash, role, employee_id
        FROM users
        WHERE login = $1
        """,
        credentials.login
    )

    if not user:
        raise HTTPException(status_code=401,detail="Invalid login or password"
        )

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401,detail="Invalid login or password"
        )

    access_token = create_access_token(
        {
            "sub": user["login"],
            "role": user["role"]
        }
    )

    employee_id = None
    employee_name = None

    if user["employee_id"] is not None:
        employee = await fetchrow(
            """
            SELECT id, name
            FROM employees
            WHERE id = $1
            """,
            user["employee_id"]
        )

        if employee:
            employee_id = employee["id"]
            employee_name = employee["name"]

    if user["role"] == "user" and employee_id is None:
        raise HTTPException(
            status_code=403,detail="К аккаунту не привязан сотрудник или сотрудник был удалён"
        )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "employeeId": employee_id,
        "name": employee_name
    }