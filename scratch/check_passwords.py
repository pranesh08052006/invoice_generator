import asyncio
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User
from auth import verify_password
from database import DATABASE_URL, DATABASE_NAME

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User])
    
    users = await User.find_all().to_list()
    passwords_to_try = [
        "admin123", "password123", "password", "sadmin@123", "admin@123",
        "user123", "user01", "user02", "admin01", "rahul123", "deepak123", "rahul", "deepak"
    ]
    
    for u in users:
        found = False
        for p in passwords_to_try:
            if verify_password(p, u.hashed_password):
                print(f"User: {u.email} -> Password: {p}")
                found = True
                break
        if not found:
            print(f"User: {u.email} -> Password NOT FOUND in list")
            
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
