import sqlite3
conn = sqlite3.connect("dermaxai.db")
for row in conn.execute("SELECT id, name, email, role FROM users"):
    print(row)