import asyncio
from database import init_db
from models import User
from auth import get_password_hash

async def main():
    await init_db()
    user = await User.find_one(User.email == "user1@gmail.com")
    if user:
        user.hashed_password = get_password_hash("user1234")
        await user.save()
        print("Password updated successfully.")
    else:
        print("User not found.")

if __name__ == "__main__":
    asyncio.run(main())
