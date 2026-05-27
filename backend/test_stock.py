
import asyncio
from database import init_db
from models import Product, Invoice, InvoiceItem, InvoiceStatus, Client
from datetime import datetime

async def test_stock_reduction():
    await init_db()
    
    # Create a test product
    product = Product(
        user_id="test_user",
        name="Test Product",
        price=100.0,
        gst_percent=18,
        stock=50
    )
    await product.insert()
    pid = str(product.id)
    print(f"Created product {pid} with stock 50")
    
    # Simulate current create_invoice logic
    qty_to_buy = 5
    db_product = await Product.get(pid)
    if db_product:
        print(f"Found product {db_product.id}, current stock: {db_product.stock}")
        db_product.stock -= qty_to_buy
        await db_product.save()
        print(f"Subtracted {qty_to_buy}, new stock: {db_product.stock}")
    
    # Verify
    reloaded = await Product.get(pid)
    print(f"Reloaded stock: {reloaded.stock}")
    
    # Cleanup
    await product.delete()

if __name__ == "__main__":
    asyncio.run(test_stock_reduction())
