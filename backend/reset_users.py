import asyncio
from database import init_db
from models import User, UserRole
from auth import get_password_hash

async def main():
    await init_db()
    # Delete all users
    await User.find_all().delete()
    print("Deleted all users.")

    # Create a new regular user
    new_user = User(
        email="user@system.com",
        hashed_password=get_password_hash("user123"),
        full_name="Regular User",
        role=UserRole.USER
    )
    await new_user.insert()
    print("Created new user: user@system.com with password: user123")

if __name__ == "__main__":
    asyncio.run(main())
