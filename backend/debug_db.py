import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['invoice_app_db']
    
    print("--- USERS ---")
    async for u in db['users'].find({}):
        print(f"ID: {u['_id']}, Email: {u['email']}")

    print("\n--- CLIENTS ---")
    async for c in db['clients'].find({}):
        print(f"ID: {c['_id']}, Company: {c.get('company_name')}, UserID: {c.get('user_id')}")

    print("\n--- INVOICES ---")
    async for i in db['invoices'].find({}):
        print(f"ID: {i['_id']}, Number: {i['invoice_number']}, UserID: {i.get('user_id')}")

if __name__ == "__main__":
    asyncio.run(check())
