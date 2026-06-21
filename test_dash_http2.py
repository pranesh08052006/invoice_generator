import asyncio
from fastapi.testclient import TestClient
import sys
sys.path.append('/home/gowthaman/Documents/invoice_generator/backend')
import main
from auth import create_access_token
import database
from models import User

async def run():
    await database.init_db()
    users = await User.find_all().to_list()
    client = TestClient(main.app)
    for user in users:
        token = create_access_token(data={"sub": user.email}, session_id=user.current_session_id or "test")
        res = client.get("/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
        print(f"{user.email}: {res.status_code}")
        if res.status_code != 200:
            print("ERROR:", res.text)

asyncio.run(run())
