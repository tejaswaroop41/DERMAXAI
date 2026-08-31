import sqlite3
conn = sqlite3.connect("dermaxai.db")
conn.execute("DELETE FROM users WHERE email = 'string'")
conn.commit()
print("deleted")