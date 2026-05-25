import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_statuses():
    client = AsyncIOMotorClient('mongodb://3.86.4.100:27017')
    db = client['invoice_app_db']
    
    invoices = await db.invoices.find().to_list(1000)
    for inv in invoices:
        old_status = inv.get("status")
        if old_status and isinstance(old_status, str) and not old_status.isupper():
            new_status = old_status.upper()
            await db.invoices.update_one(
                {"_id": inv["_id"]},
                {"$set": {"status": new_status}}
            )
            print(f"Updated invoice {inv['_id']} status from {old_status} to {new_status}")
            
    print("All statuses fixed!")

if __name__ == '__main__':
    asyncio.run(fix_statuses())
