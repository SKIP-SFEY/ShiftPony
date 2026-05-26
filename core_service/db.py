from pathlib import Path
from typing import Any

import asyncpg

from core_service.config import settings


pool: asyncpg.Pool | None = None


async def init_db() -> None:
    global pool
    pool = await asyncpg.create_pool(settings.DATABASE_URL)


async def close_db() -> None:
    global pool

    if pool is not None:
        await pool.close()
        pool = None


def _check_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("Database pool is not initialized")

    return pool


async def fetch(query: str, *args: Any) -> list[dict]:
    db_pool = _check_pool()

    async with db_pool.acquire() as connection:
        rows = await connection.fetch(query, *args)
        return [dict(row) for row in rows]


async def fetchrow(query: str, *args: Any) -> dict | None:
    db_pool = _check_pool()

    async with db_pool.acquire() as connection:
        row = await connection.fetchrow(query, *args)
        return dict(row) if row else None


async def fetchval(query: str, *args: Any) -> Any:
    db_pool = _check_pool()

    async with db_pool.acquire() as connection:
        return await connection.fetchval(query, *args)


async def execute(query: str, *args: Any) -> str:
    db_pool = _check_pool()

    async with db_pool.acquire() as connection:
        return await connection.execute(query, *args)


async def execute_sql_file(path: str | Path) -> None:
    db_pool = _check_pool()
    sql_path = Path(path)
    sql_text = sql_path.read_text(encoding="utf-8")

    async with db_pool.acquire() as connection:
        await connection.execute(sql_text)