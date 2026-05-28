import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User
from database import DATABASE_URL, DATABASE_NAME
from datetime import datetime, timedelta

async def migrate():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    
    users = await User.find_all().to_list()
    now = datetime.utcnow()
    
    for u in users:
        updated = False
        if u.trial_start_date is None:
            u.trial_start_date = u.created_at or now
            updated = True
        if u.trial_end_date is None:
            # Give everyone a fresh 7 days trial from their creation or from now
            start = u.created_at or now
            u.trial_end_date = start + timedelta(days=7)
            updated = True
            
        if updated:
            print(f"Updating user: {u.email} -> Trial ends: {u.trial_end_date}")
            await u.save()
            
    print("Migration complete.")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
