import asyncio
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User
from auth import get_password_hash
from database import DATABASE_URL, DATABASE_NAME

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    
    for email in ["user1@system.com", "user2@system.com", "user3@system.com"]:
        user = await User.find_one(User.email == email)
        if user:
            user.hashed_password = get_password_hash("password123")
            await user.save()
            print(f"Reset password for {email} to password123")
            
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
