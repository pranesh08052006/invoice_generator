import asyncio
from database import init_db
from models import Company

async def test():
    await init_db()
    
    # Try to find any company
    company = await Company.find_one({})
    if company:
        print(f"Loaded company: {company.dict()}")
        # Check if invoice_color has a default
        print(f"invoice_color: {company.invoice_color}")
        
        # Try to save it
        company.invoice_color = "#123456"
        await company.save()
        print("Saved successfully")
    else:
        print("No company found to test")

if __name__ == "__main__":
    asyncio.run(test())
