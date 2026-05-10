import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
db_url = os.environ.get('DATABASE_URL')

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute('SELECT version();')
    version = cur.fetchone()
    print(f"✅ Connected to Neon PostgreSQL: {version[0][:50]}...")
    cur.close()
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")