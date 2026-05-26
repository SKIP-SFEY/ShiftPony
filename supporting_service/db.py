from contextlib import contextmanager
from pathlib import Path
from typing import Any

from psycopg2 import pool
from psycopg2.extras import RealDictCursor

from supporting_service.config import settings


_db_pool: pool.SimpleConnectionPool | None = None


def init_db() -> None:
    global _db_pool

    if _db_pool is None:
        _db_pool = pool.SimpleConnectionPool(minconn=1,maxconn=10,dsn=settings.DATABASE_URL,)


def close_db() -> None:
    global _db_pool

    if _db_pool is not None:
        _db_pool.closeall()
        _db_pool = None


def _check_pool() -> pool.SimpleConnectionPool:
    if _db_pool is None:
        raise RuntimeError("Database pool is not initialized")

    return _db_pool


@contextmanager
def get_connection():
    db_pool = _check_pool()
    connection = db_pool.getconn()

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        db_pool.putconn(connection)


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict]:
    with get_connection() as connection:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict | None:
    with get_connection() as connection:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
            return dict(row) if row else None


def fetch_value(query: str, params: tuple[Any, ...] = ()) -> Any:
    row = fetch_one(query, params)

    if not row:
        return None

    return next(iter(row.values()))


def execute(query: str, params: tuple[Any, ...] = ()) -> int:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.rowcount


def execute_sql_file(path: str | Path) -> None:
    sql_path = Path(path)
    sql_text = sql_path.read_text(encoding="utf-8")
    execute(sql_text)
