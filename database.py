from sqlmodel import create_engine, Session
from config import settings

engine = create_engine(settings.DATABASE_URL_psycopg, echo=False)

session = Session(engine, expire_on_commit=False)