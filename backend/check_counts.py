import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://3.86.4.100:27017')
    db = client['invoice_app_db']
    u = await db['users'].find_one({'email': 'user01@system.com'})
    print(f"User ID: {u['_id']}, Role: {u['role']}")
    
    count = await db['clients'].count_documents({'user_id': str(u['_id'])})
    print(f"Client count for this User ID (string): {count}")
    
    count_obj = await db['clients'].count_documents({'user_id': u['_id']})
    print(f"Client count for this User ID (ObjectId): {count_obj}")

if __name__ == "__main__":
    asyncio.run(check())
