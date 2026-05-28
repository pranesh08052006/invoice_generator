import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User
from database import DATABASE_URL, DATABASE_NAME
from datetime import datetime, timedelta

async def expire_user():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    
    email = "user01@system.com"
    user = await User.find_one(User.email == email)
    
    if user:
        # Set trial end date to 10 days ago
        user.trial_end_date = datetime.utcnow() - timedelta(days=10)
        user.has_full_access = False
        await user.save()
        print(f"User {email} trial has been expired. (End date: {user.trial_end_date})")
    else:
        print(f"User {email} not found.")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(expire_user())
