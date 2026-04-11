import sqlite3

def init_db():
    con = sqlite3.connect("Users.db")
    cursor = con.cursor()
    cursor.execute("""CREATE TABLE users
                    (id INTEGER PRIMARY KEY AUTOINCREMENT,  
                    name TEXT)
                """)

def select_users():
    con = sqlite3.connect("Users.db")
    cursor = con.cursor()
    users = cursor.execute("SELECT * FROM users").fetchall()
    for person in users:
        print(f"{person[1]}")

    return users

def insert_user_to_db(user_name):
    con = sqlite3.connect("Users.db")
    cursor = con.cursor()

    user = (user_name,)
    cursor.execute("INSERT INTO users (name) VALUES (?)", user)

    con.commit()
