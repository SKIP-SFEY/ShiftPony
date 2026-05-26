from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:8642@localhost:5432/shift_planner"

    SECRET_KEY: str = "pisun"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    CORE_SERVICE_HOST: str = "0.0.0.0"
    CORE_SERVICE_PORT: int = 8000

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()