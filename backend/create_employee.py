import asyncio
from database import init_db
from models import User, UserRole
from auth import get_password_hash

async def main():
    await init_db()
    
    # Check if employee already exists
    existing = await User.find_one(User.email == "employee@system.com")
    if existing:
        await existing.delete()
        print("Removed existing employee user.")
        
    new_user = User(
        email="employee@system.com",
        hashed_password=get_password_hash("employee123"),
        full_name="Employee",
        role=UserRole.USER
    )
    await new_user.insert()
    print("Created new employee: employee@system.com with password: employee123")

if __name__ == "__main__":
    asyncio.run(main())
