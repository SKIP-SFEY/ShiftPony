import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env"


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        os.environ.setdefault(key, value)


_load_env_file(ENV_PATH)


class Settings:
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:8642@localhost:5432/shift_planner",
    )


    SUPPORTING_SERVICE_HOST = os.getenv("SUPPORTING_SERVICE_HOST", "127.0.0.1")
    SUPPORTING_SERVICE_PORT = int(os.getenv("SUPPORTING_SERVICE_PORT", "5001"))

    CORE_SERVICE_URL = os.getenv("CORE_SERVICE_URL", "http://127.0.0.1:8000")


settings = Settings()
