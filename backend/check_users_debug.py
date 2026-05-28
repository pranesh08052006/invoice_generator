import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User
from database import DATABASE_URL, DATABASE_NAME

async def check():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    users = await User.find_all().to_list()
    for u in users:
        print(f"ID: {str(u.id)}, User: {u.full_name}, Email: {u.email}, Role: {u.role}")
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
