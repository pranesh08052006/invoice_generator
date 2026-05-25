import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://3.86.4.100:27017')
    db = client['invoice_app_db']
    users = await db.users.find().to_list(10)
    invoices = await db.invoices.find().to_list(10)
    
    print("USERS:")
    for u in users:
        print(f"  _id: {u['_id']}, created_by_id: {u.get('created_by_id')}, email: {u.get('email')}")
        
    print("\nINVOICES:")
    for i in invoices:
        print(f"  _id: {i['_id']}, user_id: {i.get('user_id')}")

if __name__ == '__main__':
    asyncio.run(check())
