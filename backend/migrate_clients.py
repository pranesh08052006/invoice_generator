import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
from typing import Optional
from pydantic import Field
from datetime import datetime

# Temporary Client model for migration that has all fields as optional
class MigrationClient(Document):
    user_id: str
    name: Optional[str] = None
    company_name: Optional[str] = None
    mobile: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clients"

async def migrate():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["invoice_app_db"]
    await init_beanie(database=db, document_models=[MigrationClient])

    print("Starting migration for clients...")
    clients = await MigrationClient.find_all().to_list()
    
    for c in clients:
        updated = False
        # If company_name is missing but name exists, rename it
        if not c.company_name and c.name:
            c.company_name = c.name
            updated = True
        
        # Ensure state is present
        if not c.state:
            c.state = "Default State"
            updated = True
            
        # Ensure mobile is present (it was required before, but just in case)
        if not c.mobile:
            c.mobile = "0000000000"
            updated = True

        if updated:
            await c.save()
            print(f"Updated client: {c.company_name}")

    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
