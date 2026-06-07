import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from models import User
from auth import get_password_hash
from database import DATABASE_URL, DATABASE_NAME

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    
    users = await User.find_all().to_list()
    for u in users:
        new_password = ""
        if "sadmin" in u.email:
            new_password = "sadmin@123"
        elif "admin" in u.email:
            new_password = "admin@123"
        else:
            new_password = "user@123"
            
        u.hashed_password = get_password_hash(new_password)
        await u.save()
        print(f"Updated {u.email} password to: {new_password}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
