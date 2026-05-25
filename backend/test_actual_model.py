import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import Client, User, Product, Invoice, Company

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['invoice_app_db']
    await init_beanie(database=db, document_models=[User, Client, Product, Invoice, Company])
    
    print("Trying to fetch clients using the ACTUAL model...")
    try:
        clients = await Client.find_all().to_list()
        print(f"Success! Fetched {len(clients)} clients.")
        for c in clients:
            print(f"ID: {c.id}, Company: {c.company_name}, State: {c.state}")
    except Exception as e:
        print(f"FAILED to fetch clients: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check())
