import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://3.86.4.100:27017')
    db = client['invoice_app_db']
    
    print("--- COMPANY DETAILS ---")
    async for c in db['company_details'].find({}):
        print(f"User: {c.get('user_id')}, Name: {c.get('name')}, Logo: {c.get('logo_url')}")

if __name__ == "__main__":
    asyncio.run(check())
