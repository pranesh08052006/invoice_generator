import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User, Product, Client
from datetime import datetime

async def seed():
    client = AsyncIOMotorClient("mongodb://3.86.4.100:27017")
    await init_beanie(database=client.invoice_app_db, document_models=[User, Product, Client])
    
    # Find the first user
    user = await User.find_one()
    if not user:
        print("No user found. Please register first.")
        return
    
    uid = str(user.id)
    print(f"Seeding for user: {user.email} ({uid})")

    # Add some products
    products = [
        {"name": "Engine Oil - 5W30", "category": "Parts", "unit": "Nos", "price": 1200.0, "gst_percent": 18.0, "stock": 50, "tax_type": "without_tax"},
        {"name": "Brake Pad Set", "category": "Parts", "unit": "Pcs", "price": 2500.0, "gst_percent": 18.0, "stock": 20, "tax_type": "without_tax"},
        {"name": "Full Service Labor", "category": "Services", "unit": "Hrs", "price": 3000.0, "gst_percent": 12.0, "stock": 999, "tax_type": "without_tax"},
        {"name": "AC Gas Recharge", "category": "Services", "unit": "Nos", "price": 1500.0, "gst_percent": 18.0, "stock": 100, "tax_type": "without_tax"},
        {"name": "Oil Filter", "category": "Parts", "unit": "Pcs", "price": 450.0, "gst_percent": 18.0, "stock": 100, "tax_type": "without_tax"},
    ]

    for p_data in products:
        existing = await Product.find_one(Product.name == p_data["name"], Product.user_id == uid)
        if not existing:
            p = Product(**p_data, user_id=uid)
            await p.insert()
            print(f"Added product: {p_data['name']}")

    # Add a sample client
    client_data = {
        "company_name": "Acme Motors",
        "contact_person": "John Doe",
        "mobile": "9876543210",
        "whatsapp": "9876543210",
        "email": "contact@acme.com",
        "address": "123 Industrial Area, Phase 2",
        "state": "Maharashtra",
        "user_id": uid
    }
    
    existing_client = await Client.find_one(Client.company_name == client_data["company_name"], Client.user_id == uid)
    if not existing_client:
        c = Client(**client_data)
        await c.insert()
        print(f"Added client: {client_data['company_name']}")

    print("Seed completed!")

if __name__ == "__main__":
    asyncio.run(seed())
