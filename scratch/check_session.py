import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from models import User
from database import DATABASE_URL, DATABASE_NAME

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    
    u = await User.find_one(User.email == "user1@system.com")
    if u:
        print(f"Email: {u.email}")
        print(f"Role: {u.role}")
        print(f"Current Session ID: {u.current_session_id}")
    else:
        print("User user1@system.com not found!")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
