from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import HTMLResponse, Response, RedirectResponse
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

from core_service.auth import create_access_token, get_current_user
from core_service.config import settings
from core_service.db import close_db, fetchrow, init_db
from core_service.routers import admin, auth, employees, equipment, shifts, users


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

FRONTEND_DIR = PROJECT_ROOT / "frontend"
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="Shift Planner Core Service",
    description="Core service for employees, equipment, shifts and users",
    version="1.0.0",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)), name="static")


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(employees.router)
app.include_router(equipment.router)
app.include_router(shifts.router)
app.include_router(admin.router)


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )


@app.get("/user/{username}", response_class=HTMLResponse)
async def frontend_user_page(request: Request, username: str):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )


@app.get("/user/{username}/profile", response_class=HTMLResponse)
async def frontend_user_profile_page(request: Request, username: str):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "core"
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


async def _get_profile_by_username(username: str, current_user: dict) -> dict:
    if current_user["login"] != username and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,detail="You can open only your own profile"
        )

    user = await fetchrow(
        """
        SELECT
            u.id,
            u.login,
            u.role,
            u.employee_id,
            e.name AS employee_name,
            e.email AS employee_email,
            e.phone AS employee_phone,
            e.skills AS employee_skills
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE u.login = $1
        """,
        username
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,detail="User not found"
        )

    return {
        "id": user["id"],
        "login": user["login"],
        "role": user["role"],
        "employeeId": user["employee_id"],
        "employeeName": user["employee_name"],
        "employeeEmail": user["employee_email"],
        "employeePhone": user["employee_phone"],
        "employeeSkills": user["employee_skills"]
    }


@app.post("/api/profile/{username}/refresh-token")
async def refresh_user_token(
    username: str,
    current_user: dict = Depends(get_current_user)
):
    profile = await _get_profile_by_username(username, current_user)

    access_token = create_access_token(
        {
            "sub": profile["login"],
            "role": profile["role"]
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": profile["role"],
        "employeeId": profile["employeeId"],
        "name": profile["employeeName"]
    }


@app.get("/api/profile/{username}")
async def user_profile(
    username: str,
    current_user: dict = Depends(get_current_user)
):
    return await _get_profile_by_username(username, current_user)

@app.get("/{path:path}")
async def redirect_random_path(path: str):
    return RedirectResponse("https://http.cat/[404]")


if __name__ == "__main__":
    uvicorn.run(
        "core_service.app:app",
        host=settings.CORE_SERVICE_HOST,
        port=settings.CORE_SERVICE_PORT,
        reload=True
    )