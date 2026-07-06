import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

load_dotenv()

# MongoDB Connection URL
DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "invoice_app_db")

async def init_db():
    from models import User, Client, Product, Invoice, Company, Quotation, ProformaInvoice, PaymentRecord, StockAdjustment, Subscription, ExpenseCategory, PaymentMode, Expense, UserTransferHistory, PasswordResetToken, AuditLog, EmailLog, EmailAudit
    
    # Initialize Motor Client
    client = AsyncIOMotorClient(DATABASE_URL)
    
    # Initialize Beanie with the database
    await init_beanie(
        database=client[DATABASE_NAME],
        document_models=[
            User,
            Client,
            Product,
            Invoice,
            Company,
            Quotation,
            ProformaInvoice,
            PaymentRecord,
            StockAdjustment,
            Subscription,
            ExpenseCategory,
            PaymentMode,
            Expense,
            UserTransferHistory,
            PasswordResetToken,
            AuditLog,
            EmailLog,
            EmailAudit
        ]
    )

