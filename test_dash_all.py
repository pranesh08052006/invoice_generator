import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
sys.path.append('/home/gowthaman/Documents/invoice_generator/backend')
from models import User, Invoice, Client, PaymentRecord, Product, Expense
import database
import main

async def run():
    await database.init_db()
    users = await User.find_all().to_list()
    for user in users:
        print(f"Testing user {user.email} (Role: {user.role})")
        try:
            res = await main.get_stats(None, user)
            print("OK")
        except Exception as e:
            print("FAILED:", str(e))
            import traceback
            traceback.print_exc()

asyncio.run(run())
