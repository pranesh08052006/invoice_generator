import sqlite3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User, Client, Product, Invoice, InvoiceItem, UserRole, InvoiceStatus
from datetime import datetime

# Connection settings
SQLITE_DB = "invoice_app.db"
MONGO_URL = "mongodb://3.86.4.100:27017"
MONGO_DB_NAME = "invoice_app_db"

async def migrate():
    # 1. Initialize Beanie/MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    await init_beanie(
        database=client[MONGO_DB_NAME],
        document_models=[User, Client, Product, Invoice, InvoiceItem]
    )

    # 2. Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    print("Starting migration...")

    # --- Migrate Users ---
    user_map = {} # {old_id: new_str_id}
    cursor.execute("SELECT * FROM user")
    users = cursor.fetchall()
    for u in users:
        # Check if user already exists in Mongo by email
        existing = await User.find_one(User.email == u["email"])
        if existing:
            user_map[u["id"]] = str(existing.id)
            print(f"User {u['email']} already exists, skipping.")
            continue
            
        new_user = User(
            email=u["email"],
            hashed_password=u["hashed_password"],
            full_name=u["full_name"],
            role=u["role"].lower(),
            created_at=datetime.fromisoformat(u["created_at"]) if u["created_at"] else datetime.utcnow()
        )
        await new_user.insert()
        user_map[u["id"]] = str(new_user.id)
        print(f"Migrated User: {u['email']}")

    # Handle created_by_id for users
    for u in users:
        if u["created_by_id"] and u["created_by_id"] in user_map:
            mongo_user = await User.get(user_map[u["id"]])
            mongo_user.created_by_id = user_map[u["created_by_id"]]
            await mongo_user.save()

    # --- Migrate Clients ---
    client_map = {}
    cursor.execute("SELECT * FROM client")
    clients = cursor.fetchall()
    for c in clients:
        if c["user_id"] not in user_map: continue
        
        new_client = Client(
            user_id=user_map[c["user_id"]],
            name=c["name"],
            mobile=c["mobile"],
            email=c["email"],
            address=c["address"],
            gst_number=c["gst_number"],
            created_at=datetime.fromisoformat(c["created_at"]) if c["created_at"] else datetime.utcnow()
        )
        await new_client.insert()
        client_map[c["id"]] = str(new_client.id)
        print(f"Migrated Client: {c['name']}")

    # --- Migrate Products ---
    product_map = {}
    cursor.execute("SELECT * FROM product")
    products = cursor.fetchall()
    for p in products:
        if p["user_id"] not in user_map: continue
        
        new_product = Product(
            user_id=user_map[p["user_id"]],
            name=p["name"],
            price=p["price"],
            gst_percent=p["gst_percent"],
            stock=p["stock"] if p["stock"] is not None else 0,
            created_at=datetime.fromisoformat(p["created_at"]) if p["created_at"] else datetime.utcnow()
        )
        await new_product.insert()
        product_map[p["id"]] = str(new_product.id)
        print(f"Migrated Product: {p['name']}")

    # --- Migrate Invoices ---
    cursor.execute("SELECT * FROM invoice")
    invoices = cursor.fetchall()
    for inv in invoices:
        if inv["user_id"] not in user_map or inv["client_id"] not in client_map: 
            continue
        
        # Get items for this invoice
        cursor.execute("SELECT * FROM invoiceitem WHERE invoice_id = ?", (inv["id"],))
        items = cursor.fetchall()
        
        mongo_items = []
        for itm in items:
            p_id = product_map.get(itm["product_id"])
            mongo_items.append(InvoiceItem(
                product_id=p_id,
                product_name=itm["product_name"],
                quantity=itm["quantity"],
                price=itm["price"],
                gst_percent=itm["gst_percent"],
                hsn_sac=itm["hsn_sac"] if itm["hsn_sac"] else None
            ))

        new_invoice = Invoice(
            user_id=user_map[inv["user_id"]],
            client_id=client_map[inv["client_id"]],
            invoice_number=inv["invoice_number"],
            date=datetime.fromisoformat(inv["date"]) if inv["date"] else datetime.utcnow(),
            total_amount=inv["total_amount"],
            paid_amount=inv["paid_amount"],
            discount=inv["discount"],
            status=inv["status"].lower(),
            payment_mode=inv["payment_mode"] if "payment_mode" in inv.keys() else "CASH",
            created_at=datetime.fromisoformat(inv["created_at"]) if inv["created_at"] else datetime.utcnow(),
            items=mongo_items
        )
        await new_invoice.insert()
        print(f"Migrated Invoice: {inv['invoice_number']}")

    print("Migration finished successfully!")
    sqlite_conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
