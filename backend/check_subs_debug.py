import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import Subscription, User
from database import DATABASE_URL, DATABASE_NAME

async def check():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[Subscription, User])
    subs = await Subscription.find_all().to_list()
    for s in subs:
        user = await User.find_one(User.id == s.user_id)
        email = user.email if user else "Unknown"
        print(f"Subscription: {email} ({s.user_id}) -> Type: {s.plan_type}, Active: {s.is_active}, End: {s.end_date}")
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
