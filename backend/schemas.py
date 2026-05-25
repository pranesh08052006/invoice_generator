from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from models import UserRole, InvoiceStatus, QuotationStatus, ProformaStatus

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.USER

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class CompanyCreate(BaseModel):
    name: str
    address: str
    gst_number: Optional[str] = None
    mobile: str
    email: Optional[EmailStr] = None
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    ifsc: Optional[str] = None
    account_type: Optional[str] = "Current"
    account_holder_name: Optional[str] = None
    signature_url: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#2563eb"
    secondary_color: Optional[str] = "#ffffff"

class CompanyOut(BaseModel):
    name: str
    address: str
    gst_number: Optional[str] = None
    mobile: str
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
    class Config:
        from_attributes = True

class ClientCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    mobile: str
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: str
    shipping_address: Optional[str] = None
    gst_number: Optional[str] = None
    state: str

class ClientOut(BaseModel):
    id: str
    company_name: str
    contact_person: Optional[str] = None
    mobile: str
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: str
    shipping_address: Optional[str] = None
    gst_number: Optional[str] = None
    state: str
    created_at: datetime
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    unit: str = "Units"
    hsn_code: Optional[str] = None
    price: float
    tax_type: str = "without_tax"
    discount_value: float = 0.0
    discount_type: str = "percentage"
    gst_percent: float
    stock: int = 0
    item_type: str = "product"  # "product" or "service"
    image_url: Optional[str] = None

class ProductOut(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    unit: str
    hsn_code: Optional[str] = None
    price: float
    tax_type: str
    discount_value: float
    discount_type: str
    gst_percent: float
    stock: int
    item_type: str = "product"
    image_url: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class InvoiceItemCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    price: float
    discount_value: float = 0.0
    discount_type: str = "percentage"
    gst_percent: float
    hsn_sac: Optional[str] = None
    item_type: str = "product"

class InvoiceCreate(BaseModel):
    client_id: str
    invoice_number: str
    discount_value: float = 0.0
    discount_type: str = "percentage"
    paid_amount: float = 0.0
    status: InvoiceStatus = InvoiceStatus.UNPAID
    payment_mode: str = "CASH"
    is_gst: bool = True
    payment_terms: Optional[str] = None
    delivery_details: Optional[str] = None
    notes: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    items: List[InvoiceItemCreate]

# --- Quotation Schemas ---
class QuotationCreate(BaseModel):
    client_id: str
    quotation_number: str
    discount_value: float = 0.0
    discount_type: str = "percentage"
    is_gst: bool = True
    payment_terms: Optional[str] = None
    delivery_details: Optional[str] = None
    notes: Optional[str] = None
    valid_until: Optional[str] = None
    items: List[InvoiceItemCreate]

# --- Proforma Invoice Schemas ---
class ProformaCreate(BaseModel):
    client_id: str
    proforma_number: str
    discount_value: float = 0.0
    discount_type: str = "percentage"
    paid_amount: float = 0.0
    payment_mode: str = "CASH"
    is_gst: bool = True
    payment_terms: Optional[str] = None
    delivery_details: Optional[str] = None
    notes: Optional[str] = None
    items: List[InvoiceItemCreate]

# --- Payment Record Schemas ---
class PaymentRecordCreate(BaseModel):
    client_id: str
    invoice_id: Optional[str] = None
    amount: float
    payment_method: str = "CASH"
    notes: Optional[str] = None

# --- Stock Adjustment Schemas ---
class StockAdjustmentCreate(BaseModel):
    product_id: str
    adjustment_type: str = "add"
    quantity: int
    reason: Optional[str] = None
