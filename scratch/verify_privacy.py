import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from models import User, Invoice
from main import get_org_user_ids
from database import DATABASE_URL, DATABASE_NAME

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[User, Invoice])
    
    user1 = await User.find_one(User.email == "user1@system.com")
    user2 = await User.find_one(User.email == "user2@system.com")
    admin1 = await User.find_one(User.email == "admin1@system.com")
    
    print(f"User1 (USER) org IDs: {await get_org_user_ids(user1)}")
    print(f"User2 (USER) org IDs: {await get_org_user_ids(user2)}")
    print(f"Admin1 (ADMIN) org IDs: {await get_org_user_ids(admin1)}")
    
    # Check invoices for user1 vs user2
    from beanie.operators import In
    invoices_user1 = await Invoice.find(In(Invoice.user_id, await get_org_user_ids(user1))).to_list()
    invoices_user2 = await Invoice.find(In(Invoice.user_id, await get_org_user_ids(user2))).to_list()
    invoices_admin1 = await Invoice.find(In(Invoice.user_id, await get_org_user_ids(admin1))).to_list()
    
    print(f"Invoices visible to User1: {len(invoices_user1)}")
    print(f"Invoices visible to User2: {len(invoices_user2)}")
    print(f"Invoices visible to Admin1: {len(invoices_admin1)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
