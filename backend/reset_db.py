import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "invoice_app_db")

async def drop_db():
    print(f"Connecting to {DATABASE_URL}...")
    client = AsyncIOMotorClient(DATABASE_URL)
    print(f"Dropping database: {DATABASE_NAME}...")
    await client.drop_database(DATABASE_NAME)
    print("Database completely dropped. All data (users, invoices, products, etc.) has been erased.")

if __name__ == "__main__":
    asyncio.run(drop_db())
