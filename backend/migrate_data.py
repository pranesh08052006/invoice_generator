import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
from typing import Optional, List
from pydantic import Field, BaseModel
from datetime import datetime

class MigrationClient(Document):
    user_id: str
    name: Optional[str] = None
    company_name: Optional[str] = None
    mobile: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    class Settings: name = "clients"

class MigrationProduct(Document):
    user_id: str
    name: str
    price: float
    discount_value: Optional[float] = 0.0
    discount_type: Optional[str] = "percentage"
    gst_percent: float
    class Settings: name = "products"

class MigrationInvoiceItem(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    price: float
    discount_value: Optional[float] = 0.0
    discount_type: Optional[str] = "percentage"
    gst_percent: float

class MigrationInvoice(Document):
    user_id: str
    client_id: str
    invoice_number: str
    discount: Optional[float] = 0.0
    discount_value: Optional[float] = 0.0
    discount_type: Optional[str] = "percentage"
    items: List[MigrationInvoiceItem] = []
    class Settings: name = "invoices"

async def migrate():
    client = AsyncIOMotorClient("mongodb://3.86.4.100:27017")
    db = client["invoice_app_db"]
    await init_beanie(database=db, document_models=[MigrationClient, MigrationProduct, MigrationInvoice])

    print("Migrating Clients...")
    clients = await MigrationClient.find_all().to_list()
    for c in clients:
        if not c.company_name and c.name:
            c.company_name = c.name
            c.state = c.state or "Default State"
            await c.save()
            print(f"Updated Client: {c.company_name}")

    print("Migrating Products...")
    products = await MigrationProduct.find_all().to_list()
    for p in products:
        if p.discount_value is None:
            p.discount_value = 0.0
            p.discount_type = "percentage"
            await p.save()
            print(f"Updated Product: {p.name}")

    print("Migrating Invoices...")
    invoices = await MigrationInvoice.find_all().to_list()
    for inv in invoices:
        updated = False
        if inv.discount_value is None or inv.discount_value == 0:
            if inv.discount and inv.discount > 0:
                inv.discount_value = inv.discount
                inv.discount_type = "amount"
            else:
                inv.discount_value = 0.0
                inv.discount_type = "percentage"
            updated = True
        
        for item in inv.items:
            if item.discount_value is None:
                item.discount_value = 0.0
                item.discount_type = "percentage"
                updated = True
        
        if updated:
            await inv.save()
            print(f"Updated Invoice: {inv.invoice_number}")

    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
