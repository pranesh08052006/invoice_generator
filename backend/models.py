from typing import List, Optional
from datetime import datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"

class User(Document):
    email: Indexed(str, unique=True)
    hashed_password: str
    full_name: str
    role: UserRole = UserRole.USER
    created_by_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

class Company(Document):
    user_id: Indexed(str, unique=True)
    name: str = "My Company"
    address: str = "My Address"
    gst_number: Optional[str] = None
    mobile: str = "0000000000"
    email: Optional[str] = None
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    ifsc: Optional[str] = None
    account_type: Optional[str] = "Current"
    account_holder_name: Optional[str] = None
    signature_url: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#2563eb"
    secondary_color: Optional[str] = "#ffffff"

    class Settings:
        name = "company_details"

class Client(Document):
    user_id: str
    company_name: str
    contact_person: Optional[str] = None
    mobile: str
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: str  # This will be used as billing address
    shipping_address: Optional[str] = None
    gst_number: Optional[str] = None
    state: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clients"

class ItemType(str, Enum):
    PRODUCT = "product"
    SERVICE = "service"

class Product(Document):
    user_id: str
    name: str
    category: Optional[str] = None
    unit: str = "Units"
    hsn_code: Optional[str] = None
    price: float
    tax_type: str = "without_tax" # "with_tax" or "without_tax"
    discount_value: float = 0.0
    discount_type: str = "percentage"  # "percentage" or "amount"
    gst_percent: float
    stock: int = 0
    item_type: str = "product"  # "product" or "service"
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "products"

from pydantic import BaseModel, Field

class InvoiceStatus(str, Enum):
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    UNPAID = "UNPAID"
    DRAFT = "DRAFT"

class InvoiceItem(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    price: float
    discount_value: float = 0.0
    discount_type: str = "percentage"
    gst_percent: float
    hsn_sac: Optional[str] = None
    item_type: str = "product"  # "product" or "service"

class Invoice(Document):
    user_id: str
    client_id: str
    invoice_number: Indexed(str)
    date: datetime = Field(default_factory=datetime.utcnow)
    sub_total: float = 0.0
    total_gst: float = 0.0
    total_amount: float
    paid_amount: float = 0.0
    discount_value: float = 0.0
    discount_type: str = "percentage"
    status: InvoiceStatus = InvoiceStatus.UNPAID
    payment_mode: str = "CASH"
    is_gst: bool = True  # GST or Non-GST invoice
    payment_terms: Optional[str] = None
    delivery_details: Optional[str] = None
    notes: Optional[str] = None
    is_deleted: bool = False  # Soft delete
    source_type: Optional[str] = None  # "quotation" or "proforma" if converted
    source_id: Optional[str] = None  # ID of source quotation/proforma
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # In MongoDB, we often embed items for performance
    items: List[InvoiceItem] = []

    class Settings:
        name = "invoices"

# --- Quotation Model ---
class QuotationStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CONVERTED = "CONVERTED"

class Quotation(Document):
    user_id: str
    client_id: str
    quotation_number: Indexed(str)
    date: datetime = Field(default_factory=datetime.utcnow)
    valid_until: Optional[datetime] = None
    sub_total: float = 0.0
    total_gst: float = 0.0
    total_amount: float
    discount_value: float = 0.0
    discount_type: str = "percentage"
    is_gst: bool = True
    payment_terms: Optional[str] = None
    delivery_details: Optional[str] = None
    notes: Optional[str] = None
    status: QuotationStatus = QuotationStatus.DRAFT
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    items: List[InvoiceItem] = []

    class Settings:
        name = "quotations"

# --- Proforma Invoice Model ---
class ProformaStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    CONVERTED = "CONVERTED"

class ProformaInvoice(Document):
    user_id: str
    client_id: str
    proforma_number: Indexed(str)
    date: datetime = Field(default_factory=datetime.utcnow)
    sub_total: float = 0.0
    total_gst: float = 0.0
    total_amount: float
    paid_amount: float = 0.0
    discount_value: float = 0.0
    discount_type: str = "percentage"
    is_gst: bool = True
    payment_terms: Optional[str] = None
    delivery_details: Optional[str] = None
    notes: Optional[str] = None
    status: ProformaStatus = ProformaStatus.DRAFT
    payment_mode: str = "CASH"
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    items: List[InvoiceItem] = []

    class Settings:
        name = "proforma_invoices"

# --- Payment Record Model ---
class PaymentRecord(Document):
    user_id: str
    client_id: str
    invoice_id: Optional[str] = None
    amount: float
    payment_method: str = "CASH"  # CASH, UPI, BANK_TRANSFER, CARD, custom
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "payment_records"

# --- Stock Adjustment Model ---
class StockAdjustment(Document):
    user_id: str
    product_id: str
    adjustment_type: str = "add"  # "add" or "subtract"
    quantity: int
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "stock_adjustments"
