
import asyncio
from database import init_db
from models import Company

async def check_companies():
    await init_db()
    companies = await Company.find_all().to_list()
    for c in companies:
        print(f"User: {c.user_id}, Logo: {c.logo_url}")

if __name__ == "__main__":
    asyncio.run(check_companies())
