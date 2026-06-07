import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
import sys
sys.path.append("/home/gowthaman/Documents/invoice_generator/backend")
from database import DATABASE_URL, DATABASE_NAME

class Company(Document):
    user_id: str
    name: str = None
    email: str = None
    mobile: str = None
    class Settings:
        name = "companies"

async def main():
    client = AsyncIOMotorClient(DATABASE_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[Company])
    
    companies = await Company.find_all().to_list()
    print(f"Total companies: {len(companies)}")
    for c in companies:
        print(f"ID: {c.id}, User ID: {c.user_id}, Name: {c.name}, Email: {c.email}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
