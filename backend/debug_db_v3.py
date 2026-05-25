import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['invoice_app_db']
    
    print("\n--- DETAILED CLIENTS ---")
    async for c in db['clients'].find({}):
        print(f"ID: {c['_id']}, company_name: {c.get('company_name')}, address: {c.get('address')}, state: {c.get('state')}")

if __name__ == "__main__":
    asyncio.run(check())
