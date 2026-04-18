from sqlmodel import SQLModel
from database import engine

def delete_db():
    SQLModel.metadata.drop_all(engine)

def create_db():
    SQLModel.metadata.create_all(engine)

def main():
    delete_db()
    create_db()

if __name__ == '__main__':
    main()