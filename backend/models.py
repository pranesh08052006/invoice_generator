from typing import List, Optional
from datetime import datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"

class PlanType(str, Enum):
    FREE_TRIAL = "FREE_TRIAL"
    BASIC = "BASIC"
    PREMIUM = "PREMIUM"
    ENTERPRISE = "ENTERPRISE"

class Subscription(Document):
    user_id: Indexed(str, unique=True)
    plan_type: PlanType = PlanType.FREE_TRIAL
    start_date: datetime = Field(default_factory=datetime.utcnow)
    end_date: datetime
    is_active: bool = True
    razorpay_payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    amount_paid: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "subscriptions"


class User(Document):
    email: Indexed(str, unique=True)
    hashed_password: str
    full_name: str
    role: UserRole = UserRole.USER
    created_by_id: Optional[str] = None
    last_login_device_id: Optional[str] = None
    last_login_ip: Optional[str] = None
    # Single-active-session fields
    current_session_id: Optional[str] = None   # UUID embedded in the JWT; only this session is valid
    web_session_id: Optional[str] = None
    mobile_session_id: Optional[str] = None
    last_login_at: Optional[datetime] = None    # Timestamp of the most recent successful login
    last_login_device: Optional[str] = None    # Parsed browser/device name
    last_activity_at: Optional[datetime] = None  # Timestamp of the user's last active request
    # User Trial/Access fields
    has_full_access: bool = False
    trial_start_date: Optional[datetime] = None
    trial_end_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Administrative tracking fields
    assigned_admin_id: Optional[str] = None
    last_login: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    signup_source: str = "ADMIN_CREATED"

    # System Admin ownership architecture fields
    username: Optional[str] = None
    is_system_admin: bool = False
    is_protected: bool = False
    login_enabled: bool = True

    class Settings:
        name = "users"

class Company(Document):
    user_id: Indexed(str, unique=True)
    name: Optional[str] = "My Company"
    address: Optional[str] = "My Address"
    gst_number: Optional[str] = None
    mobile: Optional[str] = "0000000000"
    email: Optional[str] = None
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    ifsc: Optional[str] = None
    account_type: Optional[str] = "Current"
    account_holder_name: Optional[str] = None
    upi_id: Optional[str] = None
    signature_url: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#2563eb"
    secondary_color: Optional[str] = "#ffffff"
    invoice_color: Optional[str] = "#f59e0b"

    class Settings:
        name = "company_details"

class Client(Document):
    user_id: Indexed(str)
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
    user_id: Indexed(str)
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
    user_id: Indexed(str)
    client_id: Indexed(str)
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
    user_id: Indexed(str)
    client_id: Indexed(str)
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
    user_id: Indexed(str)
    client_id: Indexed(str)
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
    user_id: Indexed(str)
    client_id: Indexed(str)
    invoice_id: Optional[Indexed(str)] = None
    amount: float
    payment_method: str = "CASH"  # CASH, UPI, BANK_TRANSFER, CARD, custom
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "payment_records"

# --- Stock Adjustment Model ---
class StockAdjustment(Document):
    user_id: Indexed(str)
    product_id: Indexed(str)
    adjustment_type: str = "add"  # "add" or "subtract"
    quantity: int
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "stock_adjustments"

# --- Expense Category Model ---
class ExpenseCategory(Document):
    user_id: Indexed(str)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "expense_categories"

# --- Payment Mode Model ---
class PaymentMode(Document):
    user_id: Indexed(str)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "payment_modes"

# --- Expense Model ---
class Expense(Document):
    user_id: Indexed(str)
    category: str
    amount: float
    payment_mode: str
    date: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "expenses"

# --- User Transfer History Model ---
class UserTransferHistory(Document):
    user_id: str
    from_admin_id: Optional[str] = None
    to_admin_id: str
    transferred_by: str
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_transfer_history"


# --- Password Reset & OTP Tokens Model ---
class PasswordResetToken(Document):
    email: Indexed(str)
    otp_hash: str
    purpose: str = "PASSWORD_RESET"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    used: bool = False
    used_at: Optional[datetime] = None
    request_ip: Optional[str] = None
    request_user_agent: Optional[str] = None
    attempt_count: int = 0

    class Settings:
        name = "password_reset_tokens"


# --- Audit Log Model ---
class AuditLog(Document):
    user_id: Optional[str] = None
    email: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action: str = "PASSWORD_RESET"

    class Settings:
        name = "audit_logs"


# --- Email Hardening Models ---
class EmailLog(Document):
    recipient: str
    subject: str
    template_name: str
    status: str = "Queued"  # "Queued", "Sent", "Failed"
    retry_count: int = 0
    error_message: Optional[str] = None
    created_time: datetime = Field(default_factory=datetime.utcnow)
    sent_time: Optional[datetime] = None

    class Settings:
        name = "email_logs"


class EmailAudit(Document):
    triggered_by: str  # user_id or "system"
    recipient: str
    email_type: str  # e.g., "Forgot Password", "Welcome", etc.
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str

    class Settings:
        name = "email_audits"

