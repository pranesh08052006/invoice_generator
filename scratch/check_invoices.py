import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from models import Invoice
from database import DATABASE_URL, DATABASE_NAME

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[Invoice])
    
    invoices = await Invoice.find_all().to_list()
    print(f"Total invoices: {len(invoices)}")
    for i in invoices:
        print(f"Invoice: {i.invoice_number}, User ID: {i.user_id}, Total: {i.total_amount}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
