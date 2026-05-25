import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://3.86.4.100:27017')
    db = client['invoice_app_db']
    invoices = await db.invoices.find().to_list(100)
    for i in invoices:
        print(f"ID: {i['_id']}, total_amount: {i.get('total_amount')}, type: {type(i.get('total_amount'))}")

if __name__ == '__main__':
    asyncio.run(check())
