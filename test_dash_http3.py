import asyncio
import sys
import requests
sys.path.append('/home/gowthaman/Documents/invoice_generator/backend')
from auth import create_access_token
import database
from models import User

async def run():
    await database.init_db()
    users = await User.find_all().to_list()
    for user in users:
        token = create_access_token(data={"sub": user.email}, session_id=user.current_session_id or "test")
        res = requests.get("http://localhost:8000/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
        print(f"{user.email} (Role: {user.role}): {res.status_code}")
        if res.status_code != 200:
            print("ERROR:", res.text)

asyncio.run(run())
