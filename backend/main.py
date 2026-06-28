from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import io
from uuid import uuid4
from bson import ObjectId
from beanie.operators import In

from database import init_db
from models import (
    User, UserRole, Client, Product, Invoice, InvoiceItem, InvoiceStatus, Company,
    Quotation, QuotationStatus, ProformaInvoice, ProformaStatus,
    PaymentRecord, StockAdjustment, Subscription, PlanType,
    ExpenseCategory, PaymentMode, Expense, UserTransferHistory, PasswordResetToken, AuditLog
)

from schemas import (
    UserCreate, UserOut, ClientCreate, ClientOut, ProductCreate, ProductOut,
    InvoiceCreate, CompanyCreate, CompanyOut,
    QuotationCreate, ProformaCreate, PaymentRecordCreate, StockAdjustmentCreate,
    ChangePasswordRequest,
    ExpenseCategoryCreate, ExpenseCategoryOut,
    PaymentModeCreate, PaymentModeOut,
    ExpenseCreate, ExpenseOut, UserSignup,
    GenerateOTPRequest, VerifyOTPRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, check_role, SessionExpiredException, logout_user_session
)
from pdf_gen import generate_invoice_pdf
from contextlib import asynccontextmanager
import logging
import asyncio
import os
import shutil
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB and Beanie
    await init_db()
    
    # Create default Super Admin if not exists
    admin_exists = await User.find_one(User.role == UserRole.SUPER_ADMIN)
    if not admin_exists:
        super_admin = User(
            email="sadmin1@system.com",
            hashed_password=get_password_hash("sadmin@123"),
            full_name="Super Admin",
            role=UserRole.SUPER_ADMIN
        )
        await super_admin.insert()

    # Create default System Admin if not exists
    system_admin = await User.find_one(User.is_system_admin == True)
    if not system_admin:
        system_admin = await User.find_one(User.email == "system@internal.digitalviyabari")
    if not system_admin:
        system_admin = User(
            email="system@internal.digitalviyabari",
            username="ADMIN",
            hashed_password=get_password_hash(str(uuid4())), # generates a random password, cannot login
            full_name="System Admin",
            role=UserRole.ADMIN,
            is_system_admin=True,
            is_protected=True,
            login_enabled=False,
            has_full_access=True,
            signup_source="SYSTEM_CREATED"
        )
        await system_admin.insert()

    # Migrate existing users: if assigned_admin_id is missing, assign SYSTEM_ADMIN_ID
    system_admin_id = str(system_admin.id)
    async for u in User.find(User.assigned_admin_id == None):
        if u.is_system_admin or u.role == UserRole.SUPER_ADMIN:
            continue
        u.assigned_admin_id = system_admin_id
        await u.save()

    # --- Email Hardening Startup Validation & Worker Activation ---
    try:
        email_service.validate_configuration()
    except Exception as e:
        logging.getLogger("app").error(f"Email service configuration invalid on startup: {str(e)}")

    try:
        health_status = await email_service.health_check()
        if health_status.get("status") != "healthy":
            logging.getLogger("app").error(f"SMTP connection health check failed on startup: {health_status.get('message')}")
    except Exception as e:
        logging.getLogger("app").error(f"SMTP connection check failed on startup: {str(e)}")

    from services.email.queue import email_queue
    email_queue.start_worker()

    yield

    # --- Email Worker Shutdown ---
    try:
        from services.email.queue import email_queue
        await email_queue.stop_worker()
    except Exception as e:
        logging.getLogger("app").error(f"Failed to stop email worker cleanly: {str(e)}")

from fastapi.responses import JSONResponse
from services.email.email_service import email_service
from services.otp.otp_service import otp_service, OTPRateLimitError

app = FastAPI(title="Pro Invoice SaaS", lifespan=lifespan)

class TestEmailRequest(BaseModel):
    email: str
    subject: str
    message: str

@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "ok"}

@app.post("/test-email")
async def test_email(data: TestEmailRequest):
    res = await email_service.send_plain_text_email(
        recipient=data.email,
        subject=data.subject,
        text_content=data.message
    )
    if res["status"] == "failure":
        return JSONResponse(status_code=400, content=res)
    return res

@app.get("/email/health")
async def email_health():
    res = await email_service.health_check()
    if res["status"] == "unhealthy":
        return JSONResponse(status_code=500, content=res)
    return res

@app.exception_handler(SessionExpiredException)
async def session_expired_exception_handler(request: Request, exc: SessionExpiredException):
    return JSONResponse(
        status_code=401,
        content={
            "message": "Session expired. Please login again.",
            "detail": "Session expired. Please login again."
        },
        headers={"WWW-Authenticate": "Bearer"},
    )

def parse_user_agent(ua: str) -> str:
    if not ua:
        return "Unknown Device"
    ua_lower = ua.lower()
    browser = "Unknown Browser"
    device = "Unknown Device"
    
    # Extract browser
    if "chrome" in ua_lower or "chromium" in ua_lower:
        browser = "Chrome"
    elif "safari" in ua_lower:
        browser = "Safari"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "edge" in ua_lower:
        browser = "Edge"
    elif "opera" in ua_lower or "opr" in ua_lower:
        browser = "Opera"
    elif "dart" in ua_lower:
        browser = "Dart/Flutter Client"
    
    # Extract OS/Device
    if "android" in ua_lower:
        device = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        device = "iOS"
    elif "windows" in ua_lower:
        device = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        device = "Macintosh"
    elif "linux" in ua_lower:
        device = "Linux"
        
    if browser != "Unknown Browser" and device != "Unknown Device":
        return f"{browser} on {device}"
    elif browser != "Unknown Browser":
        return browser
    elif device != "Unknown Device":
        return device
    return ua[:50]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if not exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Helper to get ancestor IDs
async def get_ancestors(user: User) -> List[str]:
    ids = [str(user.id)]
    current = user
    while current.created_by_id:
        parent = await User.get(current.created_by_id)
        if not parent: break
        if parent.role == UserRole.SUPER_ADMIN:
            break
        ids.append(str(parent.id))
        current = parent
    return ids

# Helper to get descendant IDs
async def get_all_descendants(user_id: str) -> List[str]:
    descendants = []
    children = await User.find(User.created_by_id == user_id).to_list()
    for child in children:
        descendants.append(str(child.id))
        descendants.extend(await get_all_descendants(str(child.id)))
    return descendants

# Helper to get all organization user IDs (top admin + descendants)
async def get_org_user_ids(user: User) -> List[str]:
    # Strict data privacy: every user (including admin roles) only has access to their own data.
    return [str(user.id)]


async def check_subscription(user: User):
    # Super Admin is exempt
    if user.role == UserRole.SUPER_ADMIN:
        return
    
    # Users with explicitly granted full access are exempt
    if user.role == UserRole.USER and user.has_full_access:
        return
    
    user_ids = await get_ancestors(user)
    # Check if any user in the hierarchy has an active subscription
    sub = await Subscription.find_one(In(Subscription.user_id, user_ids), Subscription.is_active == True)
    
    if not sub:
        # If no subscription record at all for the top-level owner, create a 7-day trial
        admin_id = user_ids[-1]
        owner_sub = await Subscription.find_one(Subscription.user_id == admin_id)
        if not owner_sub:
            new_sub = Subscription(
                user_id=admin_id,
                plan_type=PlanType.FREE_TRIAL,
                end_date=datetime.utcnow() + timedelta(days=7),
                is_active=True
            )
            await new_sub.insert()
            return
        else:
            # If sub exists but is inactive/expired
            if owner_sub.end_date < datetime.utcnow():
                raise HTTPException(
                    status_code=402, 
                    detail="Organization subscription expired. Contact Admin."
                )
            raise HTTPException(
                status_code=402, 
                detail="Subscription inactive. Please contact support."
            )
    
    # Check if currently active sub has expired
    if sub.end_date < datetime.utcnow():
        sub.is_active = False
        await sub.save()
        raise HTTPException(
            status_code=402, 
            detail="Subscription expired. Please renew to continue."
        )

async def check_user_restriction(user: User, action_type: str, is_create: bool = True):
    # Super Admin is exempt from all restrictions
    if user.role == UserRole.SUPER_ADMIN:
        return
    
    # NEW RULE: Managers (ADMIN) are RESTRICTED from modifying transactional data.
    # They can view data and manage users, but cannot create/edit/delete transactions.
    if user.role == UserRole.ADMIN:
        if action_type in ["invoice", "product", "client", "quotation", "proforma", "payment"]:
            raise HTTPException(
                status_code=403, 
                detail=f"Administrative Restriction: Managers (Admins) cannot {'create' if is_create else 'modify'} {action_type} data. Please login as a standard user."
            )
        return

    # If it's a standard USER (Billing Agent), apply subscription/trial limits
    if user.role == UserRole.USER:
        # If explicitly granted full access, allow everything
        if user.has_full_access:
            return
        
        # If within trial, allow everything for now
        now = datetime.utcnow()
        if user.trial_end_date and now <= user.trial_end_date:
            return
        
        # Restricted mode: Only 1 NEW instance per day for each type
        if is_create:
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            model_map = {
                "invoice": Invoice,
                "product": Product,
                "client": Client,
                "quotation": Quotation,
                "payment": PaymentRecord,
                "proforma": ProformaInvoice
            }
            
            model = model_map.get(action_type)
            if not model:
                return
                
            count = await model.find(model.user_id == str(user.id), model.created_at >= start_of_day).count()
            if count >= 1:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Trial Limit Reached: You can only create 1 {action_type} per day in trial mode. Please upgrade for unlimited access."
                )


from fastapi import Request

async def update_last_activity(user: User):
    user.last_activity = datetime.utcnow()
    await user.save()

# --- AUTH ---
# --- AUTH ---
@app.post("/auth/login")
async def login(request: Request):
    username = None
    password = None
    platform = "web"
    
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("email") or body.get("username")
            password = body.get("password")
            platform = body.get("platform", "web")
        except Exception:
            pass
            
    if not username or not password:
        try:
            form = await request.form()
            username = form.get("username") or form.get("email")
            password = form.get("password")
            platform = form.get("platform", "web")
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    user = await User.find_one(User.email == username)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if user.is_system_admin or not user.login_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System Admin login is disabled."
        )

    # Generate a fresh unique session ID (always embedded in token for JWT integrity)
    session_id = str(uuid4())

    # Capture login metadata
    client_ip = request.client.host

    # ADMIN: unlimited multi-device login — do NOT store/overwrite session IDs in DB.
    # USER & SUPER_ADMIN: enforce single-active-session per platform.
    if user.role != UserRole.ADMIN:
        if platform == "mobile":
            user.mobile_session_id = session_id
        else:
            user.web_session_id = session_id
        user.current_session_id = session_id

    user.last_login_at = datetime.utcnow()
    user.last_login = datetime.utcnow()
    user.last_activity = datetime.utcnow()
    user.last_login_ip = client_ip
    user.last_login_device = parse_user_agent(request.headers.get("User-Agent", ""))
    await user.save()

    # Embed session_id, user_id, role, platform inside the JWT
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "platform": platform
        },
        session_id=session_id,
        platform=platform
    )

    user_data = user.dict()
    user_data["id"] = str(user.id)
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}


@app.post("/auth/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    """
    Invalidates the current session by clearing the platform-specific session ID in the DB.
    """
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    await logout_user_session(current_user, token)
    return {"message": "Logged out successfully"}


@app.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.hashed_password = get_password_hash(data.new_password)
    # Invalidate all active sessions on both web and mobile
    current_user.web_session_id = None
    current_user.mobile_session_id = None
    current_user.current_session_id = str(uuid4())
    await current_user.save()
    return {"message": "Password changed successfully. Please log in again."}


@app.post("/auth/generate-reset-otp")
async def generate_reset_otp(request: Request, data: GenerateOTPRequest):
    # Validate user exists
    user = await User.find_one(User.email == data.email)
    if not user:
        # Prevent user enumeration: return success even if user not found
        return {"success": True, "message": "OTP Generated Successfully"}

    try:
        await otp_service.generate_otp(
            email=data.email,
            purpose="PASSWORD_RESET",
            request_ip=request.client.host if request.client else None,
            request_user_agent=request.headers.get("user-agent")
        )
        return {"success": True, "message": "OTP Generated Successfully"}
    except OTPRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred."
        )


@app.post("/auth/verify-reset-otp")
async def verify_reset_otp(data: VerifyOTPRequest):
    # 1. User exists
    user = await User.find_one(User.email == data.email)
    if not user:
        return {"success": False, "verified": False, "message": "User not found."}

    try:
        res = await otp_service.verify_otp(
            email=data.email,
            otp=data.otp,
            purpose="PASSWORD_RESET",
            mark_used=False
        )
        if res.get("success"):
            return {
                "success": True,
                "verified": True,
                "message": "OTP Verified Successfully"
            }
        else:
            return {
                "success": False,
                "verified": False,
                "message": res.get("message", "Invalid OTP")
            }
    except Exception as e:
        logger.error(f"OTP Verification failed for {data.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred."
        )


@app.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest, request: Request):
    # 1. User exists
    user = await User.find_one(User.email == data.email)
    if not user:
        return {"success": False, "message": "User not found."}

    # 2. OTP Validation (Verify again, marking it used)
    try:
        res = await otp_service.verify_otp(
            email=data.email,
            otp=data.otp,
            purpose="PASSWORD_RESET",
            mark_used=True
        )
        if not res.get("success"):
            return {"success": False, "message": res.get("message", "Invalid OTP")}
    except Exception as e:
        logger.error(f"OTP verification failed during password reset for {data.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during verification."
        )

    # 3. Update password hash & Session Invalidation
    try:
        user.hashed_password = get_password_hash(data.new_password)
        user.current_session_id = None
        user.web_session_id = None
        user.mobile_session_id = None
        await user.save()
    except Exception as e:
        logger.error(f"Failed to update user password/sessions for {data.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update credentials."
        )

    # 4. Create Audit Log
    try:
        audit_log = AuditLog(
            user_id=str(user.id),
            email=user.email,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            action="PASSWORD_RESET"
        )
        await audit_log.insert()
    except Exception as e:
        logger.error(f"Failed to create audit log for {data.email}: {str(e)}")

    # 5. Send Email Confirmation (in thread pool via email_service)
    try:
        await email_service.send_html_email(
            recipient=user.email,
            subject="Password Changed Successfully",
            template_name="emails/password_reset_success.html",
            context={
                "company_name": "Invoice Digital Viyabari",
                "current_year": datetime.now(timezone.utc).year
            }
        )
    except Exception as e:
        logger.error(f"Failed to send password reset confirmation email to {user.email}: {str(e)}")

    return {"success": True, "message": "Password reset successfully. Please login again."}


logger = logging.getLogger("email_service")


@app.post("/auth/forgot-password")
async def forgot_password(request: Request, data: ForgotPasswordRequest):
    """
    Forgot Password Endpoint.
    
    Receives email, verifies format, checks user existence.
    Generates a secure OTP, saves it, renders forgot_password.html,
    and sends it via EmailService with 3x retry policy.
    
    Always returns a success response to prevent email enumeration.
    """
    # Step 1: Validate email format (Pydantic EmailStr does this)
    # Step 2: Search user
    user = await User.find_one(User.email == data.email)
    if not user:
        # Anti-enumeration: return success response immediately
        return {"success": True, "message": "If the email exists, an OTP has been sent."}

    # Step 3: Call OTPService to generate, hash, and store OTP
    try:
        raw_otp = await otp_service.generate_otp(
            email=data.email,
            purpose="PASSWORD_RESET",
            request_ip=request.client.host if request.client else None,
            request_user_agent=request.headers.get("user-agent")
        )
    except OTPRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"OTP Generation failed for {data.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process request. Please try again later."
        )

    # Step 4: Render HTML Template and Send via EmailService with 3x retry

    max_retries = 3
    email_sent = False
    last_error_msg = ""

    for attempt in range(1, max_retries + 1):
        try:
            res = await email_service.send_html_email(
                recipient=data.email,
                subject="Password Reset Request",
                template_name="emails/forgot_password.html",
                context={
                    "company_name": "Invoice Digital Viyabari",
                    "otp": raw_otp,
                    "expiry_minutes": 10,
                    "support_email": "support@digitalviyabari.com",
                    "current_year": datetime.now(timezone.utc).year
                }
            )
            if res.get("status") == "success":
                email_sent = True
                break
            else:
                last_error_msg = res.get("message", "Unknown SMTP error")
                logger.warning(f"SMTP send attempt {attempt} failed for {data.email}: {last_error_msg}")
        except Exception as e:
            last_error_msg = str(e)
            logger.warning(f"SMTP send attempt {attempt} encountered exception for {data.email}: {last_error_msg}")

        # Exponential delay: 2, 4 seconds
        if attempt < max_retries:
            await asyncio.sleep(2 ** attempt)

    if not email_sent:
        logger.error(f"All {max_retries} attempts to send forgot password email to {data.email} failed. Last error: {last_error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email. Please try again later."
        )

    return {"success": True, "message": "If the email exists, an OTP has been sent."}


@app.post("/auth/signup")
async def signup(request: Request, data: UserSignup):
    # 1. Validate email uniqueness
    existing = await User.find_one(User.email == data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Get SYSTEM_ADMIN_ID or DEFAULT_ADMIN_ID configuration
    default_admin_id = os.getenv("DEFAULT_ADMIN_ID", "6a3a22b31da70629df949a39")
    system_admin = await User.find_one(User.is_system_admin == True)
    if not system_admin:
        system_admin = await User.find_one(User.email == "system@internal.digitalviyabari")
    system_admin_id = str(system_admin.id) if system_admin else default_admin_id
    
    # 3. Create User account
    now = datetime.utcnow()
    new_user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=UserRole.USER,
        created_by_id=system_admin_id,
        assigned_admin_id=system_admin_id,
        signup_source="SELF_REGISTERED",
        trial_start_date=now,
        trial_end_date=now + timedelta(days=7),
        has_full_access=False
    )
    await new_user.insert()
    
    # 4. Automatically create a 7-Day FREE_TRIAL subscription
    new_sub = Subscription(
        user_id=str(new_user.id),
        plan_type=PlanType.FREE_TRIAL,
        start_date=now,
        end_date=now + timedelta(days=7),
        is_active=True
    )
    await new_sub.insert()
    
    # 5. Automatically create company profile
    new_company = Company(
        user_id=str(new_user.id),
        name=data.company_name,
        mobile=data.mobile,
        email=data.email,
        gst_number=data.gst_number,
        address="My Address"
    )
    await new_company.insert()
    
    # 6. Allow login immediately by generating a token
    session_id = str(uuid4())
    client_ip = request.client.host
    new_user.web_session_id = session_id
    new_user.current_session_id = session_id
    new_user.last_login_at = now
    new_user.last_login = now
    new_user.last_activity = now
    new_user.last_login_ip = client_ip
    new_user.last_login_device = parse_user_agent(request.headers.get("User-Agent", ""))
    await new_user.save()
    
    access_token = create_access_token(
        data={
            "sub": new_user.email,
            "user_id": str(new_user.id),
            "role": new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role),
            "platform": "web"
        },
        session_id=session_id,
        platform="web"
    )
    
    user_data = new_user.dict()
    user_data["id"] = str(new_user.id)
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}


@app.get("/auth/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    user_data = user.dict()
    user_data["id"] = str(user.id)
    return user_data

@app.get("/subscription/me")
async def get_my_subscription(user: User = Depends(get_current_user)):
    now = datetime.utcnow()

    # For standard billing agents (USER role), the trial is tracked on the User model directly.
    if user.role == UserRole.USER:
        if user.has_full_access:
            return {
                "status": "active",
                "plan": "FULL_ACCESS",
                "days_left": None,
                "is_full_access": True
            }
        # Check trial_end_date on the user object
        if user.trial_end_date:
            days_left = (user.trial_end_date - now).days
            is_expired = now > user.trial_end_date
            return {
                "status": "expired" if is_expired else "active",
                "plan": "FREE_TRIAL",
                "end_date": user.trial_end_date,
                "days_left": max(0, days_left) if not is_expired else 0,
                "is_expired": is_expired
            }
        # No trial date set — treat as expired
        return {"status": "expired", "plan": "FREE_TRIAL", "days_left": 0, "is_expired": True}

    # For ADMINs and SUPER_ADMINs, look up the Subscription collection
    user_ids = await get_ancestors(user)
    sub = await Subscription.find_one(In(Subscription.user_id, user_ids), Subscription.is_active == True)
    if not sub:
        admin_id = user_ids[-1]
        sub = await Subscription.find_one(Subscription.user_id == admin_id)
    
    if not sub:
        return {"status": "inactive", "message": "No subscription found"}
    
    is_expired = sub.end_date < now
    days_left = max(0, (sub.end_date - now).days) if not is_expired else 0
    return {
        "status": "active" if sub.is_active and not is_expired else "expired",
        "plan": sub.plan_type,
        "end_date": sub.end_date,
        "days_left": days_left,
        "is_expired": is_expired
    }


async def serialize_user_with_metadata(u: User) -> dict:
    company = await Company.find_one(Company.user_id == str(u.id))
    company_name = company.name if company else None
    mobile = company.mobile if company else None
    
    assigned_admin_name = None
    if u.assigned_admin_id:
        admin_user = await User.get(u.assigned_admin_id)
        if admin_user:
            assigned_admin_name = admin_user.full_name
            
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "has_full_access": u.has_full_access,
        "trial_start_date": u.trial_start_date,
        "trial_end_date": u.trial_end_date,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
        "last_login_device": u.last_login_device,
        "last_login_ip": u.last_login_ip,
        "last_activity_at": u.last_activity_at,
        "assigned_admin_id": u.assigned_admin_id,
        "last_login": u.last_login,
        "last_activity": u.last_activity,
        "signup_source": u.signup_source,
        "username": u.username,
        "is_system_admin": u.is_system_admin,
        "is_protected": u.is_protected,
        "login_enabled": u.login_enabled,
        "company_name": company_name,
        "mobile": mobile,
        "assigned_admin_name": assigned_admin_name
    }


# --- ADMIN MANAGEMENT ---
@app.post("/admin/users", response_model=UserOut)
async def create_managed_user(
    user_in: UserCreate, 
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    try:
        if current_user.role == UserRole.SUPER_ADMIN and user_in.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Super Admins can only create managers (Admins)")
        
        if current_user.role == UserRole.ADMIN and user_in.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Managers can only create users (Users)")
        
        existing = await User.find_one(User.email == user_in.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        now = datetime.utcnow()
        system_admin_id = None
        if current_user.role != UserRole.ADMIN:
            system_admin = await User.find_one(User.is_system_admin == True)
            if not system_admin:
                system_admin = await User.find_one(User.email == "system@internal.digitalviyabari")
            if system_admin:
                system_admin_id = str(system_admin.id)

        new_user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role=user_in.role,
            created_by_id=str(current_user.id),
            assigned_admin_id=str(current_user.id) if current_user.role == UserRole.ADMIN else system_admin_id,
            trial_start_date=now,
            trial_end_date=now + timedelta(days=7),
            has_full_access=False
        )
        await new_user.insert()
        
        return await serialize_user_with_metadata(new_user)
    except Exception as e:
        print(f"ERROR CREATING USER: {str(e)}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/admin/users", response_model=List[UserOut])
async def list_managed_users(
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    try:
        if current_user.role == UserRole.SUPER_ADMIN:
            users = await User.find(User.id != current_user.id).to_list()
        else:
            users = await User.find(User.assigned_admin_id == str(current_user.id)).to_list()
        
        return [await serialize_user_with_metadata(u) for u in users]
    except Exception as e:
        print(f"ERROR LISTING USERS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/admin/users/{user_id}/access")
async def toggle_full_access(
    user_id: str,
    access_data: dict,
    current_user: User = Depends(check_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    target_user = await User.get(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.is_system_admin or target_user.is_protected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System Admin is protected and cannot be modified."
        )

    if current_user.role == UserRole.ADMIN and target_user.created_by_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to manage this user")
        
    target_user.has_full_access = access_data.get("has_full_access", False)
    await target_user.save()
    return {"message": "Access updated successfully", "has_full_access": target_user.has_full_access}

@app.delete("/admin/users/{user_id}")
async def delete_managed_user(
    user_id: str,
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    target_user = await User.get(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.is_system_admin or target_user.is_protected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System Admin is protected and cannot be deleted."
        )
    
    if current_user.role == UserRole.SUPER_ADMIN:
        if target_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Super Admins can only remove Admins")
    
    if current_user.role == UserRole.ADMIN:
        if target_user.role != UserRole.USER or target_user.created_by_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Managers can only remove their own Users")
    
    async def _purge_user_data(uid: str):
        """Completely remove all data associated with a user ID."""
        await Invoice.find(Invoice.user_id == uid).delete()
        await Client.find(Client.user_id == uid).delete()
        await Product.find(Product.user_id == uid).delete()
        await Quotation.find(Quotation.user_id == uid).delete()
        await ProformaInvoice.find(ProformaInvoice.user_id == uid).delete()
        await PaymentRecord.find(PaymentRecord.user_id == uid).delete()
        await StockAdjustment.find(StockAdjustment.user_id == uid).delete()
        await Company.find(Company.user_id == uid).delete()
        await Subscription.find(Subscription.user_id == uid).delete()

    # Reassign subordinates to SYSTEM_ADMIN instead of deleting
    if target_user.role == UserRole.ADMIN:
        system_admin = await User.find_one(User.is_system_admin == True)
        if not system_admin:
            system_admin = await User.find_one(User.email == "system@internal.digitalviyabari")
        if not system_admin:
            raise HTTPException(status_code=500, detail="System Admin not found. Cannot reassign users.")
        
        system_admin_id = str(system_admin.id)
        
        # Find all users assigned to or created by this Admin
        subordinates = await User.find(User.assigned_admin_id == str(target_user.id)).to_list()
        subordinates_by_creator = await User.find(User.created_by_id == str(target_user.id)).to_list()
        all_subs = {str(s.id): s for s in subordinates + subordinates_by_creator}
        
        for sub_id, sub in all_subs.items():
            from_admin = sub.assigned_admin_id
            sub.assigned_admin_id = system_admin_id
            sub.created_by_id = system_admin_id
            await sub.save()
            
            # Log transfer history
            history = UserTransferHistory(
                user_id=str(sub.id),
                from_admin_id=from_admin,
                to_admin_id=system_admin_id,
                transferred_by=str(current_user.id),
                reason=f"Admin {target_user.email} deleted. Automated transfer to System Admin."
            )
            await history.insert()
            
    await _purge_user_data(user_id)
    await target_user.delete()
    return {"detail": "User removed successfully"}

@app.get("/admin/system-admin-users", response_model=List[UserOut])
async def list_system_admin_users(
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN]))
):
    system_admin = await User.find_one(User.is_system_admin == True)
    if not system_admin:
        system_admin = await User.find_one(User.email == "system@internal.digitalviyabari")
    if not system_admin:
        return []
    
    users = await User.find(User.assigned_admin_id == str(system_admin.id)).to_list()
    return [await serialize_user_with_metadata(u) for u in users]

class ReassignUsersRequest(BaseModel):
    user_ids: List[str]
    to_admin_id: str
    reason: Optional[str] = "Super Admin Reassignment"

@app.post("/admin/reassign-users")
async def reassign_users(
    data: ReassignUsersRequest,
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN]))
):
    target_admin = await User.get(data.to_admin_id)
    if not target_admin:
        raise HTTPException(status_code=404, detail="Target Admin not found")
        
    if target_admin.role != UserRole.ADMIN and not target_admin.is_system_admin:
        raise HTTPException(
            status_code=400,
            detail="Users can only be reassigned to Admin or System Admin accounts."
        )

    transferred = []
    for uid in data.user_ids:
        u = await User.get(uid)
        if not u:
            continue
        if u.is_system_admin or u.is_protected:
            continue
            
        from_admin_id = u.assigned_admin_id
        u.assigned_admin_id = data.to_admin_id
        u.created_by_id = data.to_admin_id
        await u.save()
        
        history = UserTransferHistory(
            user_id=uid,
            from_admin_id=from_admin_id,
            to_admin_id=data.to_admin_id,
            transferred_by=str(current_user.id),
            reason=data.reason
        )
        await history.insert()
        transferred.append(uid)
        
    return {"message": f"Successfully reassigned {len(transferred)} users", "transferred_user_ids": transferred}


# --- Super Admin Email Monitoring & Health API ---
@app.get("/system/email-health")
async def get_email_health(current_user: User = Depends(check_role([UserRole.SUPER_ADMIN]))):
    # 1. Config Check
    config_ok = True
    config_err = None
    try:
        email_service.validate_configuration()
    except Exception as e:
        config_ok = False
        config_err = str(e)

    # 2. Template Engine Check
    templates_ok = False
    try:
        templates_ok = os.path.isdir(email_service.renderer.templates_dir)
    except Exception:
        pass

    # 3. Queue Check
    from services.email.queue import email_queue
    queue_ok = email_queue._worker_task is not None and not email_queue._worker_task.done()

    # 4. SMTP / Connection Check
    smtp_health = await email_service.health_check()
    smtp_ok = smtp_health.get("status") == "healthy"

    health_status = "healthy" if (config_ok and templates_ok and queue_ok and smtp_ok) else "unhealthy"

    return {
        "status": health_status,
        "details": {
            "smtp_reachable": smtp_ok,
            "authentication_successful": smtp_ok,
            "template_engine_working": templates_ok,
            "configuration_loaded": config_ok,
            "config_error": config_err,
            "queue_operational": queue_ok
        }
    }


@app.get("/system/email-dashboard")
async def get_email_dashboard(current_user: User = Depends(check_role([UserRole.SUPER_ADMIN]))):
    from models import EmailLog

    # Total count by statuses
    total_sent = await EmailLog.find(EmailLog.status == "Sent").count()
    total_failed = await EmailLog.find(EmailLog.status == "Failed").count()
    total_pending = await EmailLog.find(EmailLog.status == "Queued").count()

    # Today's count
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=None)
    todays_emails = await EmailLog.find(EmailLog.created_time >= today_start).count()

    # Last error
    last_failed = await EmailLog.find(EmailLog.status == "Failed").sort("-created_time").first_or_none()
    last_error = last_failed.error_message if last_failed else None

    # Recent activity
    recent_logs = await EmailLog.find().sort("-created_time").limit(20).to_list()
    recent_activity = [
        {
            "id": str(log.id),
            "recipient": log.recipient,
            "subject": log.subject,
            "template_name": log.template_name,
            "status": log.status,
            "retry_count": log.retry_count,
            "error_message": log.error_message,
            "created_time": log.created_time,
            "sent_time": log.sent_time
        }
        for log in recent_logs
    ]

    # Rate Monitoring
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    one_day_ago = datetime.utcnow() - timedelta(days=1)
    
    emails_per_hour = await EmailLog.find(EmailLog.status == "Sent", EmailLog.sent_time >= one_hour_ago).count()
    emails_per_day = await EmailLog.find(EmailLog.status == "Sent", EmailLog.sent_time >= one_day_ago).count()
    
    total_retries = 0
    async for log in EmailLog.find(EmailLog.retry_count > 0):
        total_retries += log.retry_count

    return {
        "metrics": {
            "total_sent": total_sent,
            "total_failed": total_failed,
            "total_pending": total_pending,
            "todays_emails": todays_emails,
            "last_error": last_error
        },
        "rate_monitoring": {
            "emails_per_hour": emails_per_hour,
            "emails_per_day": emails_per_day,
            "total_retries": total_retries
        },
        "recent_activity": recent_activity
    }

class UserSubscriptionUpdateRequest(BaseModel):
    plan_type: PlanType
    days: int = 365
    is_active: bool = True

@app.post("/admin/users/{user_id}/subscription")
async def update_user_subscription(
    user_id: str,
    data: UserSubscriptionUpdateRequest,
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN]))
):
    target_user = await User.get(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    sub = await Subscription.find_one(Subscription.user_id == user_id)
    now = datetime.utcnow()
    if not sub:
        sub = Subscription(
            user_id=user_id,
            plan_type=data.plan_type,
            start_date=now,
            end_date=now + timedelta(days=data.days),
            is_active=data.is_active
        )
        await sub.insert()
    else:
        sub.plan_type = data.plan_type
        sub.end_date = now + timedelta(days=data.days)
        sub.is_active = data.is_active
        await sub.save()
        
    return {
        "message": "Subscription updated successfully",
        "plan_type": sub.plan_type,
        "end_date": sub.end_date,
        "is_active": sub.is_active
    }


@app.get("/admin/my-users")
async def get_my_users(current_user: User = Depends(check_role([UserRole.ADMIN]))):
    try:
        users = await User.find(User.assigned_admin_id == str(current_user.id)).to_list()
        result = []
        for u in users:
            company = await Company.find_one(Company.user_id == str(u.id))
            company_name = company.name if company else "My Company"
            mobile = company.mobile if company else "0000000000"
            
            now = datetime.utcnow()
            trial_status = "active"
            if u.trial_end_date and now > u.trial_end_date:
                trial_status = "expired"
            if u.has_full_access:
                trial_status = "full_access"
                
            status = "inactive"
            if u.last_activity:
                diff = (now - u.last_activity).days
                if diff <= 7:
                    status = "active"
                elif diff <= 30:
                    status = "less_active"
            
            result.append({
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "company_name": company_name,
                "mobile": mobile,
                "trial_status": trial_status,
                "trial_end_date": u.trial_end_date,
                "created_at": u.created_at,
                "last_login": u.last_login,
                "last_activity": u.last_activity,
                "signup_source": u.signup_source,
                "status": status
            })
        return result
    except Exception as e:
        print(f"ERROR GETTING MY USERS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/my-users/{user_id}/details")
async def get_my_user_details(
    user_id: str, 
    current_user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    try:
        u = await User.get(user_id)
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
            
        if current_user.role != UserRole.SUPER_ADMIN and u.assigned_admin_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to view this user")
            
        company = await Company.find_one(Company.user_id == str(u.id))
        company_name = company.name if company else "My Company"
        mobile = company.mobile if company else "0000000000"
        
        total_invoices = await Invoice.find(Invoice.user_id == str(u.id)).count()
        total_products = await Product.find(Product.user_id == str(u.id)).count()
        total_clients = await Client.find(Client.user_id == str(u.id)).count()
        total_quotations = await Quotation.find(Quotation.user_id == str(u.id)).count()
        total_proformas = await ProformaInvoice.find(ProformaInvoice.user_id == str(u.id)).count()
        total_expenses = await Expense.find(Expense.user_id == str(u.id)).count()
        total_payments = await PaymentRecord.find(PaymentRecord.user_id == str(u.id)).count()
        
        # Get subscription plan type
        sub = await Subscription.find_one(Subscription.user_id == str(u.id))
        plan_type = sub.plan_type if sub else "FREE_TRIAL"
        
        assigned_admin_name = "Unassigned"
        if u.assigned_admin_id:
            admin_user = await User.get(u.assigned_admin_id)
            if admin_user:
                assigned_admin_name = admin_user.full_name
        
        now = datetime.utcnow()
        trial_status = "active"
        if u.trial_end_date and now > u.trial_end_date:
            trial_status = "expired"
        if u.has_full_access:
            trial_status = "full_access"
            
        return {
            "basic_info": {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "company_name": company_name,
                "mobile": mobile
            },
            "ownership_info": {
                "assigned_admin_id": u.assigned_admin_id,
                "assigned_admin_name": assigned_admin_name,
                "signup_source": u.signup_source
            },
            "trial_info": {
                "plan_type": plan_type,
                "trial_status": trial_status,
                "trial_start_date": u.trial_start_date,
                "trial_end_date": u.trial_end_date,
                "has_full_access": u.has_full_access
            },
            "usage_stats": {
                "total_invoices": total_invoices,
                "total_products": total_products,
                "total_clients": total_clients,
                "total_quotations": total_quotations,
                "total_proformas": total_proformas,
                "total_expenses": total_expenses,
                "total_payments": total_payments
            },
            "activity_info": {
                "last_login": u.last_login,
                "last_activity": u.last_activity
            }
        }
    except Exception as e:
        print(f"ERROR GETTING MY USER DETAILS: {str(e)}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))


# --- COMPANY SETTINGS ---
@app.get("/company", response_model=Optional[CompanyOut])
async def get_company_details(user: User = Depends(get_current_user)):
    company = await Company.find_one(Company.user_id == str(user.id))
    if company and company.signature_url:
        if not company.signature_url.startswith("http"):
            filename = os.path.basename(company.signature_url)
            base_url = os.getenv("BASE_URL", "http://localhost:8000")
            company.signature_url = f"{base_url}/uploads/{filename}"
    return company

@app.post("/company", response_model=CompanyOut)
async def save_company_details(company_in: CompanyCreate, user: User = Depends(get_current_user)):
    try:
        data = company_in.dict()
        print(f"DEBUG SAVE: received data: {data}")
        # Clean data: remove IDs and handle empty strings
        clean_data = {
            k: (v if v != "" or k in ['name', 'address', 'mobile'] else None) 
            for k, v in data.items() 
            if k not in ['id', 'user_id', '_id']
        }
        print(f"DEBUG SAVE: clean_data: {clean_data}")
        
        uid = str(user.id)
        company = await Company.find_one({"user_id": uid})
        
        if not company:
            company = Company(user_id=uid)
            await company.insert()
            
        # Update fields — but NEVER overwrite image URLs with None
        # (logo/signature are updated only via their dedicated upload endpoints)
        IMAGE_FIELDS = {'logo_url', 'signature_url'}
        for k, v in clean_data.items():
            if hasattr(company, k):
                if k in IMAGE_FIELDS and v is None:
                    continue  # preserve existing image URL
                setattr(company, k, v)
        
        print(f"DEBUG SAVE: saving company: {company.dict()}")
        await company.save()
        print("DEBUG SAVE: company saved successfully")
        return company
            
    except Exception as e:
        import traceback
        with open("d:/invoice_generator/backend/save_error.txt", "a") as f:
            f.write(f"\n--- ERROR AT {datetime.now()} ---\n")
            f.write(f"Received data: {data}\n")
            f.write(f"Clean data: {clean_data}\n")
            f.write(traceback.format_exc())
            f.write(f"Error: {str(e)}\n")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/company/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    try:
        os.makedirs("uploads/logos", exist_ok=True)
        file_path = f"uploads/logos/{user.id}_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        url = f"{base_url}/{file_path}"
        company = await Company.find_one(Company.user_id == str(user.id))
        if company:
            company.logo_url = url
            await company.save()
        else:
            company = Company(user_id=str(user.id), logo_url=url)
            await company.create()
            
        return {"logo_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/company/signature")
async def upload_signature(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    try:
        ext = file.filename.split(".")[-1]
        filename = f"sig_{user.id}.{ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        company = await Company.find_one(Company.user_id == str(user.id))
        if not company:
            company = Company(user_id=str(user.id), name="My Company", address="My Address", mobile="0000000000")
            await company.insert()
            
        company.signature_url = filepath
        await company.save()
        
        # Return full URL for frontend
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        return {"signature_url": f"{base_url}/uploads/{filename}"}
    except Exception as e:
        print(f"UPLOAD ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- CLIENTS ---
@app.post("/clients", response_model=ClientOut)
async def create_client(
    client_in: ClientCreate, 
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_subscription(user)
    await check_user_restriction(user, "client")
    try:
        new_client = Client(**client_in.dict(), user_id=str(user.id))
        await new_client.insert()
        await update_last_activity(user)
        
        # Explicit construction for Pydantic V2 compatibility
        return {
            "id": str(new_client.id),
            "company_name": new_client.company_name,
            "contact_person": new_client.contact_person,
            "mobile": new_client.mobile,
            "whatsapp": new_client.whatsapp,
            "email": new_client.email,
            "address": new_client.address,
            "shipping_address": new_client.shipping_address,
            "gst_number": new_client.gst_number,
            "state": new_client.state,
            "created_at": new_client.created_at
        }
    except Exception as e:
        print(f"ERROR CREATING CLIENT: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/clients", response_model=List[ClientOut])
async def get_clients(user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))):
    if user.role == UserRole.SUPER_ADMIN:
        return []
    org_ids = await get_org_user_ids(user)
    clients = await Client.find(In(Client.user_id, org_ids)).to_list()

    
    return [
        {
            "id": str(c.id),
            "company_name": c.company_name,
            "contact_person": c.contact_person,
            "mobile": c.mobile,
            "whatsapp": c.whatsapp,
            "email": c.email,
            "address": c.address,
            "shipping_address": c.shipping_address,
            "gst_number": c.gst_number,
            "state": c.state,
            "created_at": c.created_at
        } for c in clients
    ]

@app.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: str,
    client_in: ClientCreate,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_user_restriction(user, "client", is_create=False)
    client = await Client.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role != UserRole.SUPER_ADMIN and client.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in client_in.dict().items():
        setattr(client, key, value)
    await client.save()
    return {"id": str(client.id), **client.dict(exclude={"id", "user_id"})}

@app.delete("/clients/{client_id}")
async def delete_client(
    client_id: str,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_user_restriction(user, "client", is_create=False)
    client = await Client.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role != UserRole.SUPER_ADMIN and client.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    await client.delete()
    return {"message": "Client deleted"}

# --- PRODUCTS ---
@app.post("/products", response_model=ProductOut)
async def create_product(
    product_in: ProductCreate, 
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_subscription(user)
    await check_user_restriction(user, "product")
    try:
        new_product = Product(**product_in.dict(), user_id=str(user.id))
        await new_product.insert()
        await update_last_activity(user)
        return {
            "id": str(new_product.id),
            **new_product.dict(exclude={"id", "user_id"})
        }
    except Exception as e:
        print(f"ERROR CREATING PRODUCT: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/products", response_model=List[ProductOut])
async def get_products(user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))):
    if user.role == UserRole.SUPER_ADMIN:
        return []
    org_ids = await get_org_user_ids(user)
    products = await Product.find(In(Product.user_id, org_ids)).to_list()

    return [
        {
            "id": str(p.id),
            **p.dict(exclude={"id", "user_id"})
        } for p in products
    ]

@app.put("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    product_in: ProductCreate,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_user_restriction(user, "product", is_create=False)
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if user.role != UserRole.SUPER_ADMIN and product.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in product_in.dict().items():
        setattr(product, key, value)
    await product.save()
    return {"id": str(product.id), **product.dict(exclude={"id", "user_id"})}

@app.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if user.role != UserRole.SUPER_ADMIN and product.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    await product.delete()
    return {"message": "Product deleted"}

async def _adjust_stock(items, direction="reduce"):
    for item in items:
        if item.product_id:
            try:
                db_product = await Product.get(item.product_id)
                if db_product:
                    qty = item.quantity or 0
                    if direction == "reduce":
                        db_product.stock -= qty
                    else:
                        db_product.stock += qty
                    await db_product.save()
                    print(f"DEBUG: Adjusted stock for {db_product.name} (ID: {db_product.id}): {direction} {qty}. New stock: {db_product.stock}")
            except Exception as e:
                print(f"ERROR adjusting stock for product {item.product_id}: {str(e)}")

# --- INVOICES ---

@app.post("/invoices")
async def create_invoice(
    invoice_in: InvoiceCreate, 
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_subscription(user)
    await check_user_restriction(user, "invoice")
    try:
        existing = await Invoice.find_one(Invoice.user_id == str(user.id), Invoice.invoice_number == invoice_in.invoice_number)
        if existing:
            raise HTTPException(status_code=400, detail="Invoice number already exists")

        sub_total = 0
        total_gst = 0
        items_to_save = []
        
        for item in invoice_in.items:
            # Line item calculations
            qty = item.quantity or 0
            price = item.price or 0
            line_subtotal_before_discount = price * qty
            
            # Line item discount
            line_discount = 0
            if item.discount_type == "percentage":
                line_discount = (line_subtotal_before_discount * (item.discount_value or 0)) / 100
            else:
                line_discount = (item.discount_value or 0)
            
            line_taxable_value = line_subtotal_before_discount - line_discount
            line_gst = (line_taxable_value * (item.gst_percent or 0)) / 100
            
            sub_total += line_taxable_value
            total_gst += line_gst
            
        # Adjust Stock
        await _adjust_stock(invoice_in.items)
        
        for item in invoice_in.items:
            items_to_save.append(InvoiceItem(**item.dict()))

        # Final Invoice Discount
        invoice_discount_amount = 0
        if invoice_in.discount_type == "percentage":
            invoice_discount_amount = (sub_total * (invoice_in.discount_value or 0)) / 100
        else:
            invoice_discount_amount = (invoice_in.discount_value or 0)

        final_amount = sub_total + total_gst - invoice_discount_amount
        
        new_invoice = Invoice(
            user_id=str(user.id),
            client_id=invoice_in.client_id,
            invoice_number=invoice_in.invoice_number,
            sub_total=sub_total,
            total_gst=total_gst,
            total_amount=final_amount,
            paid_amount=invoice_in.paid_amount or 0,
            discount_value=invoice_in.discount_value or 0,
            discount_type=invoice_in.discount_type,
            status=invoice_in.status.upper(),
            payment_mode=invoice_in.payment_mode,
            is_gst=invoice_in.is_gst,
            payment_terms=invoice_in.payment_terms,
            delivery_details=invoice_in.delivery_details,
            notes=invoice_in.notes,
            source_type=invoice_in.source_type,
            source_id=invoice_in.source_id,
            items=items_to_save
        )
        await new_invoice.insert()
        await update_last_activity(user)
        
        print(f"SUCCESS: Invoice {new_invoice.invoice_number} created with ID {new_invoice.id}")

        return {
            "id": str(new_invoice.id),
            "invoice_number": new_invoice.invoice_number,
            "total_amount": new_invoice.total_amount,
            "status": new_invoice.status
        }
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"ERROR CREATING INVOICE:\n{tb}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Invoice Creation Failed: {str(e)}")

@app.patch("/invoices/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status_in: dict,
    user: User = Depends(get_current_user)
):
    await check_user_restriction(user, "invoice", is_create=False)
    invoice = await Invoice.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    can_update = False
    if user.role == UserRole.SUPER_ADMIN:
        can_update = True
    elif user.role in [UserRole.ADMIN, UserRole.USER]:
        org_ids = await get_org_user_ids(user)
        if invoice.user_id in org_ids:
            can_update = True
            
    if not can_update:
        raise HTTPException(status_code=403, detail="Not authorized to update this invoice")
        
    new_status = status_in.get("status", "").upper()
    invoice.status = new_status
    
    # Sync paid_amount if marked as PAID to ensure metrics updates correctly
    if new_status == "PAID" and (invoice.paid_amount or 0) < invoice.total_amount:
        invoice.paid_amount = invoice.total_amount
    
    await invoice.save()
    return {"detail": "Status updated"}

@app.get("/invoices")
async def get_invoices(user: User = Depends(get_current_user)):
    try:
        if user.role == UserRole.SUPER_ADMIN:
            return []
        org_ids = await get_org_user_ids(user)
        invoices = await Invoice.find(In(Invoice.user_id, org_ids)).to_list()

        
        # Filter out soft-deleted invoices and sort newest first
        invoices = [inv for inv in invoices if not getattr(inv, 'is_deleted', False)]
        invoices.sort(key=lambda x: x.created_at or x.date, reverse=True)

        if not invoices:
            return []

        # Batch fetch clients and users to avoid N+1 issues
        client_ids = list(set([inv.client_id for inv in invoices if inv.client_id and len(inv.client_id) == 24]))
        clients = await Client.find(In(Client.id, [ObjectId(cid) for cid in client_ids])).to_list()
        client_map = {str(c.id): c for c in clients}

        user_ids = list(set([inv.user_id for inv in invoices if inv.user_id and len(inv.user_id) == 24]))
        users = await User.find(In(User.id, [ObjectId(uid) for uid in user_ids])).to_list()
        user_map = {str(u.id): u for u in users}
            
        results = []
        for inv in invoices:
            creator = user_map.get(inv.user_id)
            client = client_map.get(inv.client_id)
            results.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "client_id": inv.client_id,
                "company_name": client.company_name if client else "Unknown",
                "date": inv.date,
                "total_amount": inv.total_amount,
                "paid_amount": inv.paid_amount,
                "discount_value": inv.discount_value,
                "discount_type": inv.discount_type,
                "status": inv.status,
                "payment_mode": inv.payment_mode,
                "is_gst": getattr(inv, 'is_gst', True),
                "payment_terms": getattr(inv, 'payment_terms', None),
                "delivery_details": getattr(inv, 'delivery_details', None),
                "notes": getattr(inv, 'notes', None),
                "source_type": getattr(inv, 'source_type', None),
                "source_id": getattr(inv, 'source_id', None),
                "created_at": inv.created_at,
                "user_full_name": creator.full_name if creator else "Unknown",
                "user_role": creator.role if creator else "user",
                "user_id": inv.user_id,
                "items": [item.dict() for item in inv.items]
            })
        return results
    except Exception as e:
        print(f"ERROR FETCHING INVOICES: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/invoices/{invoice_id}/pdf")
async def get_pdf(
    invoice_id: str,
    user: User = Depends(get_current_user)
):
    try:
        invoice = await Invoice.get(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        creator = None
        # Authorization
        can_access = False
        if user.role == UserRole.SUPER_ADMIN:
            can_access = True
        elif user.role == UserRole.ADMIN:
            creator = await User.get(invoice.user_id)
            if creator and (str(creator.id) == str(user.id) or creator.created_by_id == str(user.id)):
                can_access = True
        elif user.role == UserRole.USER:
            if invoice.user_id == str(user.id):
                can_access = True
                
        if not can_access:
            raise HTTPException(status_code=403, detail="Not authorized to access this invoice")

        # Fetch saved company details, fallback to basic user info
        saved_company = await Company.find_one(Company.user_id == str(invoice.user_id))
        
        business_details = _build_business_details(saved_company, creator or user)
        
        client = await Client.get(invoice.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        from pdf_gen import generate_invoice_pdf
        pdf_buffer = generate_invoice_pdf(invoice, client, business_details)
        pdf_buffer.seek(0)
        
        return Response(
            content=pdf_buffer.read(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=INV_{invoice.invoice_number}.pdf"}
        )
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        error_msg = f"ERROR GENERATING PDF: {str(e)}\n{tb}"
        print(error_msg)
        with open("error_log.txt", "a") as f:
            import datetime
            f.write(f"[{datetime.datetime.now()}] {error_msg}\n")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"PDF Generation Failed: {str(e)}")

@app.post("/invoices/preview")
async def preview_invoice(
    invoice_in: InvoiceCreate, 
    user: User = Depends(get_current_user)
):
    try:
        sub_total = 0
        total_gst = 0
        items_to_save = []
        
        for item in invoice_in.items:
            qty = item.quantity or 0
            price = item.price or 0
            line_subtotal_before_discount = price * qty
            
            line_discount = 0
            if item.discount_type == "percentage":
                line_discount = (line_subtotal_before_discount * (item.discount_value or 0)) / 100
            else:
                line_discount = (item.discount_value or 0)
            
            line_taxable_value = line_subtotal_before_discount - line_discount
            line_gst = (line_taxable_value * (item.gst_percent or 0)) / 100
            
            sub_total += line_taxable_value
            total_gst += line_gst
            
            items_to_save.append(InvoiceItem(**item.dict()))

        # Final Invoice Discount
        invoice_discount_amount = 0
        if invoice_in.discount_type == "percentage":
            invoice_discount_amount = (sub_total * (invoice_in.discount_value or 0)) / 100
        else:
            invoice_discount_amount = (invoice_in.discount_value or 0)

        final_amount = sub_total + total_gst - invoice_discount_amount
        
        mock_invoice = Invoice(
            user_id=str(user.id),
            client_id=invoice_in.client_id,
            invoice_number=invoice_in.invoice_number,
            sub_total=sub_total,
            total_gst=total_gst,
            total_amount=final_amount,
            paid_amount=invoice_in.paid_amount or 0,
            discount_value=invoice_in.discount_value or 0,
            discount_type=invoice_in.discount_type,
            status=invoice_in.status.upper(),
            payment_mode=invoice_in.payment_mode,
            payment_terms=invoice_in.payment_terms,
            delivery_details=invoice_in.delivery_details,
            notes=invoice_in.notes,
            items=items_to_save
        )

        saved_company = await Company.find_one(Company.user_id == str(user.id))
        
        business_details = _build_business_details(saved_company, user)
        
        client = await Client.get(mock_invoice.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        from pdf_gen import generate_invoice_pdf
        pdf_buffer = generate_invoice_pdf(mock_invoice, client, business_details)
        pdf_buffer.seek(0)
        
        return Response(
            content=pdf_buffer.read(),
            media_type="application/pdf"
        )
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"ERROR GENERATING PREVIEW PDF: {str(e)}\n{tb}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"PDF Preview Failed: {str(e)}")

# --- INVOICE DELETE (Soft Delete) ---
@app.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    user: User = Depends(get_current_user)
):
    await check_user_restriction(user, "invoice", is_create=False)
    invoice = await Invoice.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if user.role != UserRole.SUPER_ADMIN and invoice.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    invoice.is_deleted = True
    await invoice.save()
    return {"detail": "Invoice deleted"}

# --- INVOICE UPDATE ---
@app.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    invoice_in: InvoiceCreate,
    user: User = Depends(get_current_user)
):
    await check_user_restriction(user, "invoice", is_create=False)
    invoice = await Invoice.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if user.role != UserRole.SUPER_ADMIN and invoice.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sub_total = 0
    total_gst = 0
    items_to_save = []
    # Record old items to revert stock
    old_items = invoice.items
    
    for item in invoice_in.items:
        qty = item.quantity or 0
        price = item.price or 0
        line_sub = price * qty
        line_disc = 0
        if item.discount_type == "percentage":
            line_disc = (line_sub * (item.discount_value or 0)) / 100
        else:
            line_disc = item.discount_value or 0
        line_taxable = line_sub - line_disc
        line_gst = (line_taxable * (item.gst_percent or 0)) / 100
        sub_total += line_taxable
        total_gst += line_gst
        items_to_save.append(InvoiceItem(**item.dict()))
    
    # Revert old stock impact
    await _adjust_stock(old_items, direction="add")
    # Apply new stock impact
    await _adjust_stock(items_to_save, direction="reduce")
    
    inv_disc = 0
    if invoice_in.discount_type == "percentage":
        inv_disc = (sub_total * (invoice_in.discount_value or 0)) / 100
    else:
        inv_disc = invoice_in.discount_value or 0
    final_amount = sub_total + total_gst - inv_disc
    
    invoice.client_id = invoice_in.client_id
    invoice.invoice_number = invoice_in.invoice_number
    invoice.sub_total = sub_total
    invoice.total_gst = total_gst
    invoice.total_amount = final_amount
    invoice.paid_amount = invoice_in.paid_amount or 0
    invoice.discount_value = invoice_in.discount_value or 0
    invoice.discount_type = invoice_in.discount_type
    invoice.status = invoice_in.status.upper()
    invoice.payment_mode = invoice_in.payment_mode
    invoice.is_gst = invoice_in.is_gst
    invoice.payment_terms = invoice_in.payment_terms
    invoice.delivery_details = invoice_in.delivery_details
    invoice.notes = invoice_in.notes
    invoice.items = items_to_save
    await invoice.save()
    return {"id": str(invoice.id), "invoice_number": invoice.invoice_number, "total_amount": invoice.total_amount, "status": invoice.status}

# ========== QUOTATION MODULE ==========

def _calc_items(items_in):
    """Shared calculation for quotation/proforma items."""
    sub_total = 0
    total_gst = 0
    items_out = []
    for item in items_in:
        qty = item.quantity or 0
        price = item.price or 0
        line_sub = price * qty
        line_disc = 0
        if item.discount_type == "percentage":
            line_disc = (line_sub * (item.discount_value or 0)) / 100
        else:
            line_disc = item.discount_value or 0
        line_taxable = line_sub - line_disc
        line_gst = (line_taxable * (item.gst_percent or 0)) / 100
        sub_total += line_taxable
        total_gst += line_gst
        items_out.append(InvoiceItem(**item.dict()))
    return sub_total, total_gst, items_out

@app.post("/quotations")
async def create_quotation(
    q_in: QuotationCreate,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_subscription(user)
    await check_user_restriction(user, "quotation")
    try:
        sub_total, total_gst, items = _calc_items(q_in.items)
        disc = 0
        if q_in.discount_type == "percentage":
            disc = (sub_total * (q_in.discount_value or 0)) / 100
        else:
            disc = q_in.discount_value or 0
        total = sub_total + total_gst - disc

        valid_until = None
        if q_in.valid_until:
            try:
                valid_until = datetime.fromisoformat(q_in.valid_until)
            except Exception:
                valid_until = None

        quotation = Quotation(
            user_id=str(user.id),
            client_id=q_in.client_id,
            quotation_number=q_in.quotation_number,
            sub_total=sub_total,
            total_gst=total_gst,
            total_amount=total,
            discount_value=q_in.discount_value or 0,
            discount_type=q_in.discount_type,
            is_gst=q_in.is_gst,
            payment_terms=q_in.payment_terms,
            delivery_details=q_in.delivery_details,
            notes=q_in.notes,
            valid_until=valid_until,
            items=items
        )
        await quotation.insert()
        await update_last_activity(user)
        return {"id": str(quotation.id), "quotation_number": quotation.quotation_number, "total_amount": quotation.total_amount}
    except Exception as e:
        import traceback
        print(f"ERROR CREATING QUOTATION:\n{traceback.format_exc()}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/quotations")
async def get_quotations(user: User = Depends(get_current_user)):
    try:
        if user.role == UserRole.SUPER_ADMIN:
            return []
        org_ids = await get_org_user_ids(user)
        quotations = await Quotation.find(In(Quotation.user_id, org_ids)).to_list()

        quotations = [q for q in quotations if not getattr(q, 'is_deleted', False)]
        quotations.sort(key=lambda x: x.created_at, reverse=True)

        if not quotations:
            return []

        client_ids = list(set([q.client_id for q in quotations if q.client_id and len(q.client_id) == 24]))
        clients = await Client.find(In(Client.id, [ObjectId(cid) for cid in client_ids])).to_list()
        client_map = {str(c.id): c for c in clients}

        results = []
        for q in quotations:
            client = client_map.get(q.client_id)
            results.append({
                "id": str(q.id),
                "quotation_number": q.quotation_number,
                "client_id": q.client_id,
                "company_name": client.company_name if client else "Unknown",
                "date": q.date,
                "valid_until": q.valid_until,
                "total_amount": q.total_amount,
                "sub_total": q.sub_total,
                "total_gst": q.total_gst,
                "discount_value": q.discount_value,
                "discount_type": q.discount_type,
                "is_gst": q.is_gst,
                "payment_terms": q.payment_terms,
                "delivery_details": q.delivery_details,
                "notes": q.notes,
                "status": q.status,
                "created_at": q.created_at,
                "items": [item.dict() for item in q.items]
            })
        return results
    except Exception as e:
        print(f"ERROR FETCHING QUOTATIONS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/quotations/{quotation_id}")
async def delete_quotation(quotation_id: str, user: User = Depends(get_current_user)):
    await check_user_restriction(user, "quotation", is_create=False)
    q = await Quotation.get(quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if user.role != UserRole.SUPER_ADMIN and q.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    q.is_deleted = True
    await q.save()
    return {"detail": "Quotation deleted"}

@app.put("/quotations/{quotation_id}")
async def update_quotation(
    quotation_id: str,
    q_in: QuotationCreate,
    user: User = Depends(get_current_user)
):
    await check_user_restriction(user, "quotation", is_create=False)
    q = await Quotation.get(quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if user.role != UserRole.SUPER_ADMIN and q.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sub_total, total_gst, items = _calc_items(q_in.items)
    disc = 0
    if q_in.discount_type == "percentage":
        disc = (sub_total * (q_in.discount_value or 0)) / 100
    else:
        disc = q_in.discount_value or 0
    total = sub_total + total_gst - disc

    valid_until = None
    if q_in.valid_until:
        try:
            valid_until = datetime.fromisoformat(q_in.valid_until)
        except Exception:
            valid_until = None

    q.client_id = q_in.client_id
    q.quotation_number = q_in.quotation_number
    q.sub_total = sub_total
    q.total_gst = total_gst
    q.total_amount = total
    q.discount_value = q_in.discount_value or 0
    q.discount_type = q_in.discount_type
    q.is_gst = q_in.is_gst
    q.payment_terms = q_in.payment_terms
    q.delivery_details = q_in.delivery_details
    q.notes = q_in.notes
    q.valid_until = valid_until
    q.items = items

    await q.save()
    return {"id": str(q.id), "quotation_number": q.quotation_number, "total_amount": q.total_amount, "status": q.status}

@app.post("/quotations/{quotation_id}/convert")
async def convert_quotation_to_invoice(
    quotation_id: str,
    body: dict,
    user: User = Depends(get_current_user)
):
    """Convert a quotation to a full invoice."""
    await check_user_restriction(user, "invoice")
    q = await Quotation.get(quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if user.role != UserRole.SUPER_ADMIN and q.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    invoice_number = body.get("invoice_number", f"INV-{q.quotation_number}")
    new_invoice = Invoice(
        user_id=str(user.id),
        client_id=q.client_id,
        invoice_number=invoice_number,
        sub_total=q.sub_total,
        total_gst=q.total_gst,
        total_amount=q.total_amount,
        discount_value=q.discount_value,
        discount_type=q.discount_type,
        is_gst=q.is_gst,
        payment_terms=q.payment_terms,
        delivery_details=q.delivery_details,
        notes=q.notes,
        source_type="quotation",
        source_id=str(q.id),
        items=q.items,
        status=InvoiceStatus.UNPAID
    )
    await new_invoice.insert()
    
    # Adjust stock on conversion from quotation
    await _adjust_stock(q.items)
    
    q.status = QuotationStatus.CONVERTED
    await q.save()
    return {"id": str(new_invoice.id), "invoice_number": new_invoice.invoice_number, "total_amount": new_invoice.total_amount}

@app.get("/quotations/{quotation_id}/pdf")
async def get_quotation_pdf(quotation_id: str, user: User = Depends(get_current_user)):
    q = await Quotation.get(quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    client = await Client.get(q.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    saved_company = await Company.find_one(Company.user_id == q.user_id)
    business_details = _build_business_details(saved_company, user)
    mock_inv = Invoice(
        user_id=q.user_id, client_id=q.client_id, invoice_number=q.quotation_number,
        sub_total=q.sub_total, total_gst=q.total_gst, total_amount=q.total_amount,
        discount_value=q.discount_value, discount_type=q.discount_type,
        is_gst=q.is_gst, payment_terms=q.payment_terms, delivery_details=q.delivery_details,
        notes=q.notes, items=q.items, status="DRAFT"
    )
    from pdf_gen import generate_invoice_pdf
    pdf_buffer = generate_invoice_pdf(mock_inv, client, business_details, doc_title="QUOTATION")
    pdf_buffer.seek(0)
    return Response(content=pdf_buffer.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=QT_{q.quotation_number}.pdf"})

@app.post("/quotations/preview")
async def preview_quotation(
    q_in: QuotationCreate,
    user: User = Depends(get_current_user)
):
    """Generate a PDF preview for a quotation without saving."""
    try:
        sub_total, total_gst, items = _calc_items(q_in.items)
        disc = 0
        if q_in.discount_type == "percentage":
            disc = (sub_total * (q_in.discount_value or 0)) / 100
        else:
            disc = q_in.discount_value or 0
        total = sub_total + total_gst - disc

        mock_inv = Invoice(
            user_id=str(user.id), client_id=q_in.client_id,
            invoice_number=q_in.quotation_number,
            sub_total=sub_total, total_gst=total_gst, total_amount=total,
            discount_value=q_in.discount_value or 0, discount_type=q_in.discount_type,
            is_gst=q_in.is_gst, payment_terms=q_in.payment_terms,
            delivery_details=q_in.delivery_details, notes=q_in.notes,
            items=items, status="DRAFT"
        )
        client = await Client.get(q_in.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        saved_company = await Company.find_one(Company.user_id == str(user.id))
        business_details = _build_business_details(saved_company, user)
        from pdf_gen import generate_invoice_pdf
        pdf_buffer = generate_invoice_pdf(mock_inv, client, business_details, doc_title="QUOTATION")
        pdf_buffer.seek(0)
        return Response(content=pdf_buffer.read(), media_type="application/pdf")
    except Exception as e:
        import traceback
        print(f"ERROR QUOTATION PREVIEW:\n{traceback.format_exc()}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Quotation Preview Failed: {str(e)}")

# ========== PROFORMA INVOICE MODULE ==========

@app.post("/proformas")
async def create_proforma(
    p_in: ProformaCreate,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    await check_subscription(user)
    await check_user_restriction(user, "proforma")
    try:
        sub_total, total_gst, items = _calc_items(p_in.items)
        disc = 0
        if p_in.discount_type == "percentage":
            disc = (sub_total * (p_in.discount_value or 0)) / 100
        else:
            disc = p_in.discount_value or 0
        total = sub_total + total_gst - disc

        proforma = ProformaInvoice(
            user_id=str(user.id),
            client_id=p_in.client_id,
            proforma_number=p_in.proforma_number,
            sub_total=sub_total,
            total_gst=total_gst,
            total_amount=total,
            paid_amount=p_in.paid_amount or 0,
            discount_value=p_in.discount_value or 0,
            discount_type=p_in.discount_type,
            is_gst=p_in.is_gst,
            payment_mode=p_in.payment_mode,
            payment_terms=p_in.payment_terms,
            delivery_details=p_in.delivery_details,
            notes=p_in.notes,
            items=items
        )
        await proforma.insert()
        await update_last_activity(user)
        return {"id": str(proforma.id), "proforma_number": proforma.proforma_number, "total_amount": proforma.total_amount}
    except Exception as e:
        import traceback
        print(f"ERROR CREATING PROFORMA:\n{traceback.format_exc()}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/proformas")
async def get_proformas(user: User = Depends(get_current_user)):
    try:
        if user.role == UserRole.SUPER_ADMIN:
            return []
        org_ids = await get_org_user_ids(user)
        proformas = await ProformaInvoice.find(In(ProformaInvoice.user_id, org_ids)).to_list()

        proformas = [p for p in proformas if not getattr(p, 'is_deleted', False)]
        proformas.sort(key=lambda x: x.created_at, reverse=True)

        if not proformas:
            return []

        client_ids = list(set([p.client_id for p in proformas if p.client_id and len(p.client_id) == 24]))
        clients = await Client.find(In(Client.id, [ObjectId(cid) for cid in client_ids])).to_list()
        client_map = {str(c.id): c for c in clients}

        results = []
        for p in proformas:
            client = client_map.get(p.client_id)
            results.append({
                "id": str(p.id),
                "proforma_number": p.proforma_number,
                "client_id": p.client_id,
                "company_name": client.company_name if client else "Unknown",
                "date": p.date,
                "total_amount": p.total_amount,
                "paid_amount": p.paid_amount,
                "sub_total": p.sub_total,
                "total_gst": p.total_gst,
                "discount_value": p.discount_value,
                "discount_type": p.discount_type,
                "is_gst": p.is_gst,
                "payment_mode": p.payment_mode,
                "payment_terms": p.payment_terms,
                "delivery_details": p.delivery_details,
                "notes": p.notes,
                "status": p.status,
                "created_at": p.created_at,
                "items": [item.dict() for item in p.items]
            })
        return results
    except Exception as e:
        print(f"ERROR FETCHING PROFORMAS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/proformas/{proforma_id}")
async def delete_proforma(proforma_id: str, user: User = Depends(get_current_user)):
    await check_user_restriction(user, "proforma", is_create=False)
    p = await ProformaInvoice.get(proforma_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proforma not found")
    if user.role != UserRole.SUPER_ADMIN and p.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    p.is_deleted = True
    await p.save()
    return {"detail": "Proforma deleted"}

@app.put("/proformas/{proforma_id}")
async def update_proforma(
    proforma_id: str,
    p_in: ProformaCreate,
    user: User = Depends(get_current_user)
):
    await check_user_restriction(user, "proforma", is_create=False)
    p = await ProformaInvoice.get(proforma_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proforma invoice not found")
    if user.role != UserRole.SUPER_ADMIN and p.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sub_total, total_gst, items = _calc_items(p_in.items)
    disc = 0
    if p_in.discount_type == "percentage":
        disc = (sub_total * (p_in.discount_value or 0)) / 100
    else:
        disc = p_in.discount_value or 0
    total = sub_total + total_gst - disc

    p.client_id = p_in.client_id
    p.proforma_number = p_in.proforma_number
    p.sub_total = sub_total
    p.total_gst = total_gst
    p.total_amount = total
    p.paid_amount = p_in.paid_amount or 0
    p.discount_value = p_in.discount_value or 0
    p.discount_type = p_in.discount_type
    p.is_gst = p_in.is_gst
    p.payment_mode = p_in.payment_mode
    p.payment_terms = p_in.payment_terms
    p.delivery_details = p_in.delivery_details
    p.notes = p_in.notes
    p.items = items

    await p.save()
    return {"id": str(p.id), "proforma_number": p.proforma_number, "total_amount": p.total_amount, "status": p.status}

@app.post("/proformas/{proforma_id}/convert")
async def convert_proforma_to_invoice(
    proforma_id: str,
    body: dict,
    user: User = Depends(get_current_user)
):
    await check_user_restriction(user, "invoice")
    p = await ProformaInvoice.get(proforma_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proforma not found")
    if user.role != UserRole.SUPER_ADMIN and p.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    invoice_number = body.get("invoice_number", f"INV-{p.proforma_number}")
    new_invoice = Invoice(
        user_id=str(user.id),
        client_id=p.client_id,
        invoice_number=invoice_number,
        sub_total=p.sub_total,
        total_gst=p.total_gst,
        total_amount=p.total_amount,
        paid_amount=p.paid_amount,
        discount_value=p.discount_value,
        discount_type=p.discount_type,
        is_gst=p.is_gst,
        payment_mode=p.payment_mode,
        payment_terms=p.payment_terms,
        delivery_details=p.delivery_details,
        notes=p.notes,
        source_type="proforma",
        source_id=str(p.id),
        items=p.items,
        status=InvoiceStatus.UNPAID
    )
    await new_invoice.insert()
    
    # Adjust stock on conversion from proforma
    await _adjust_stock(p.items)
    
    p.status = ProformaStatus.CONVERTED
    await p.save()
    return {"id": str(new_invoice.id), "invoice_number": new_invoice.invoice_number, "total_amount": new_invoice.total_amount}

@app.get("/proformas/{proforma_id}/pdf")
async def get_proforma_pdf(proforma_id: str, user: User = Depends(get_current_user)):
    p = await ProformaInvoice.get(proforma_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proforma not found")
    client = await Client.get(p.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    saved_company = await Company.find_one(Company.user_id == p.user_id)
    business_details = _build_business_details(saved_company, user)
    mock_inv = Invoice(
        user_id=p.user_id, client_id=p.client_id, invoice_number=p.proforma_number,
        sub_total=p.sub_total, total_gst=p.total_gst, total_amount=p.total_amount,
        paid_amount=p.paid_amount, discount_value=p.discount_value, discount_type=p.discount_type,
        is_gst=p.is_gst, payment_terms=p.payment_terms, delivery_details=p.delivery_details,
        notes=p.notes, items=p.items, status="DRAFT", payment_mode=p.payment_mode
    )
    from pdf_gen import generate_invoice_pdf
    pdf_buffer = generate_invoice_pdf(mock_inv, client, business_details, doc_title="PROFORMA INVOICE")
    pdf_buffer.seek(0)
    return Response(content=pdf_buffer.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=PI_{p.proforma_number}.pdf"})

@app.post("/proformas/preview")
async def preview_proforma(
    p_in: ProformaCreate,
    user: User = Depends(get_current_user)
):
    """Generate a PDF preview for a proforma without saving."""
    try:
        sub_total, total_gst, items = _calc_items(p_in.items)
        disc = 0
        if p_in.discount_type == "percentage":
            disc = (sub_total * (p_in.discount_value or 0)) / 100
        else:
            disc = p_in.discount_value or 0
        total = sub_total + total_gst - disc

        mock_inv = Invoice(
            user_id=str(user.id), client_id=p_in.client_id,
            invoice_number=p_in.proforma_number,
            sub_total=sub_total, total_gst=total_gst, total_amount=total,
            paid_amount=p_in.paid_amount or 0,
            discount_value=p_in.discount_value or 0, discount_type=p_in.discount_type,
            is_gst=p_in.is_gst, payment_mode=p_in.payment_mode,
            payment_terms=p_in.payment_terms, delivery_details=p_in.delivery_details,
            notes=p_in.notes, items=items, status="DRAFT"
        )
        client = await Client.get(p_in.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        saved_company = await Company.find_one(Company.user_id == str(user.id))
        business_details = _build_business_details(saved_company, user)
        from pdf_gen import generate_invoice_pdf
        pdf_buffer = generate_invoice_pdf(mock_inv, client, business_details, doc_title="PROFORMA INVOICE")
        pdf_buffer.seek(0)
        return Response(content=pdf_buffer.read(), media_type="application/pdf")
    except Exception as e:
        import traceback
        print(f"ERROR PROFORMA PREVIEW:\n{traceback.format_exc()}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Proforma Preview Failed: {str(e)}")

# --- Shared helper for business details ---
def _build_business_details(saved_company, user):
    if saved_company:
        return {
            "name": saved_company.name,
            "address": saved_company.address,
            "email": saved_company.email or user.email,
            "phone": saved_company.mobile,
            "gst": saved_company.gst_number,
            "signature_url": getattr(saved_company, 'signature_url', None),
            "logo_url": getattr(saved_company, 'logo_url', None),
            "invoice_color": getattr(saved_company, 'invoice_color', "#f59e0b"),
            "bank": {
                "bank_name": saved_company.bank_name or "N/A",
                "account_no": saved_company.account_no or "N/A",
                "ifsc": saved_company.ifsc or "N/A",
                "account_type": saved_company.account_type or "Current",
                "account_holder_name": saved_company.account_holder_name or saved_company.name
            }
        }
    return {
        "name": user.full_name + " Business",
        "address": "123 Business Plaza, City, India",
        "email": user.email,
        "phone": "+91 9876543210",
        "gst": "33AABCA1234A1Z1",
        "invoice_color": "#f59e0b",
        "bank": {"bank_name": "N/A", "account_no": "N/A", "ifsc": "N/A", "account_type": "Current", "account_holder_name": user.full_name}
    }

# ========== STOCK ADJUSTMENTS ==========

@app.post("/stock-adjustments")
async def create_stock_adjustment(
    adj_in: StockAdjustmentCreate,
    user: User = Depends(get_current_user)
):
    product = await Product.get(adj_in.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if user.role != UserRole.SUPER_ADMIN and product.user_id not in await get_org_user_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if adj_in.adjustment_type == "add":
        product.stock += adj_in.quantity
    else:
        product.stock = max(0, product.stock - adj_in.quantity)
    await product.save()
    
    adj = StockAdjustment(
        user_id=str(user.id),
        product_id=adj_in.product_id,
        adjustment_type=adj_in.adjustment_type,
        quantity=adj_in.quantity,
        reason=adj_in.reason
    )
    await adj.insert()
    return {"id": str(adj.id), "new_stock": product.stock}

@app.get("/stock-adjustments")
async def get_stock_adjustments(user: User = Depends(get_current_user)):
    if user.role == UserRole.SUPER_ADMIN:
        return []
    org_ids = await get_org_user_ids(user)
    adjs = await StockAdjustment.find(In(StockAdjustment.user_id, org_ids)).to_list()

    adjs.sort(key=lambda x: x.created_at, reverse=True)
    
    if not adjs:
        return []

    product_ids = list(set([a.product_id for a in adjs if a.product_id and len(a.product_id) == 24]))
    products = await Product.find(In(Product.id, [ObjectId(pid) for pid in product_ids])).to_list()
    product_map = {str(p.id): p for p in products}

    results = []
    for a in adjs:
        product = product_map.get(a.product_id)
        results.append({
            "id": str(a.id),
            "product_id": a.product_id,
            "product_name": product.name if product else "Unknown",
            "adjustment_type": a.adjustment_type,
            "quantity": a.quantity,
            "reason": a.reason,
            "created_at": a.created_at
        })
    return results

# ========== PAYMENT RECORDS ==========

@app.post("/payments")
async def create_payment(
    pay_in: PaymentRecordCreate,
    user: User = Depends(get_current_user)
):
    await check_subscription(user)
    await check_user_restriction(user, "payment")
    payment = PaymentRecord(
        user_id=str(user.id),
        client_id=pay_in.client_id,
        invoice_id=pay_in.invoice_id,
        amount=pay_in.amount,
        payment_method=pay_in.payment_method,
        notes=pay_in.notes
    )
    await payment.insert()
    await update_last_activity(user)
    
    # Update invoice paid_amount if linked
    if pay_in.invoice_id:
        invoice = await Invoice.get(pay_in.invoice_id)
        if invoice:
            invoice.paid_amount = (invoice.paid_amount or 0) + pay_in.amount
            if invoice.paid_amount >= invoice.total_amount:
                invoice.status = InvoiceStatus.PAID
            elif invoice.paid_amount > 0:
                invoice.status = InvoiceStatus.PARTIAL
            await invoice.save()
    
    return {"id": str(payment.id), "amount": payment.amount}

@app.get("/payments")
async def get_payments(user: User = Depends(get_current_user)):
    if user.role == UserRole.SUPER_ADMIN:
        return []
    org_ids = await get_org_user_ids(user)
    payments = await PaymentRecord.find(In(PaymentRecord.user_id, org_ids)).to_list()

    payments.sort(key=lambda x: x.created_at, reverse=True)
    
    if not payments:
        return []

    client_ids = list(set([p.client_id for p in payments if p.client_id and len(p.client_id) == 24]))
    clients = await Client.find(In(Client.id, [ObjectId(cid) for cid in client_ids])).to_list()
    client_map = {str(c.id): c for c in clients}

    results = []
    for p in payments:
        client = client_map.get(p.client_id)
        results.append({
            "id": str(p.id),
            "client_id": p.client_id,
            "client_name": client.company_name if client else "Unknown",
            "invoice_id": p.invoice_id,
            "amount": p.amount,
            "payment_method": p.payment_method,
            "payment_date": p.payment_date,
            "notes": p.notes,
            "created_at": p.created_at
        })
    return results

# ========== REPORTS ==========

@app.get("/reports/summary")
async def get_reports_summary(user: User = Depends(get_current_user)):
    """Get comprehensive report data."""
    uid = str(user.id)
    if user.role == UserRole.SUPER_ADMIN:
        invoices = []
        clients = []
        products = []
        expenses = []
    else:
        org_ids = await get_org_user_ids(user)
        invoices = await Invoice.find(In(Invoice.user_id, org_ids)).to_list()
        clients = await Client.find(In(Client.user_id, org_ids)).to_list()
        products = await Product.find(In(Product.user_id, org_ids)).to_list()
        expenses = await Expense.find(In(Expense.user_id, org_ids)).to_list()
    
    invoices = [i for i in invoices if not getattr(i, 'is_deleted', False)]
    
    # Fetch all payments to include general payments (unlinked to invoices)
    if user.role == UserRole.SUPER_ADMIN:
        payments = []
    else:
        org_ids = await get_org_user_ids(user)
        payments = await PaymentRecord.find(In(PaymentRecord.user_id, org_ids)).to_list()

    # Total collected = payments on invoices + general payments (unlinked)
    # Since invoice.paid_amount is updated when a linked payment is created,
    # we can sum all invoice.paid_amount and add only unlinked payments.
    unlinked_payments_sum = sum(p.amount for p in payments if not p.invoice_id)
    
    total_revenue = sum(i.paid_amount or 0 for i in invoices) + unlinked_payments_sum
    total_invoiced = sum(i.total_amount or 0 for i in invoices if i.status != InvoiceStatus.DRAFT)
    total_outstanding = total_invoiced - total_revenue
    
    # Per-client breakdown
    client_map = {str(c.id): c.company_name for c in clients}
    client_stats = {}
    for inv in invoices:
        cid = inv.client_id
        if cid not in client_stats:
            client_stats[cid] = {"name": client_map.get(cid, "Unknown"), "invoiced": 0, "paid": 0, "count": 0}
        client_stats[cid]["invoiced"] += inv.total_amount or 0
        client_stats[cid]["paid"] += inv.paid_amount or 0
        client_stats[cid]["count"] += 1
    
    # Add unlinked payments to client stats
    for p in payments:
        if not p.invoice_id:
            cid = p.client_id
            if cid in client_stats:
                client_stats[cid]["paid"] += p.amount
    
    # Low stock products
    low_stock = [{"id": str(p.id), "name": p.name, "stock": p.stock, "unit": p.unit} for p in products if p.stock <= 10]
    
    # Expense aggregations
    total_expenses = sum(exp.amount for exp in expenses)
    cat_map = {}
    for exp in expenses:
        cat_map[exp.category] = cat_map.get(exp.category, 0.0) + exp.amount
    category_expenses = [{"category": k, "amount": v} for k, v in cat_map.items()]
    
    pm_map = {}
    for exp in expenses:
        pm_map[exp.payment_mode] = pm_map.get(exp.payment_mode, 0.0) + exp.amount
    payment_mode_expenses = [{"payment_mode": k, "amount": v} for k, v in pm_map.items()]
    
    return {
        "total_revenue": total_revenue,
        "total_outstanding": total_outstanding,
        "total_invoiced": total_invoiced,
        "total_invoices": len(invoices),
        "total_clients": len(clients),
        "total_products": len(products),
        "paid_count": len([i for i in invoices if i.status == InvoiceStatus.PAID]),
        "unpaid_count": len([i for i in invoices if i.status != InvoiceStatus.PAID and i.status != InvoiceStatus.DRAFT]),
        "client_breakdown": list(client_stats.values()),
        "low_stock_products": low_stock,
        "total_expenses": total_expenses,
        "category_expenses": category_expenses,
        "payment_mode_expenses": payment_mode_expenses
    }

# --- DASHBOARD ---

@app.get("/dashboard/stats")
async def get_stats(
    target_user_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    # --- FETCHING DATA FOR A SPECIFIC USER (Performance View) ---
    if target_user_id:
        target = await User.get(target_user_id)
        if not target: 
            raise HTTPException(status_code=404, detail="User not found")
        
        # Security: Users can only see their own performance; Admins can only see their subordinates
        if user.role == UserRole.USER:
            if str(target.id) != str(user.id):
                raise HTTPException(status_code=403, detail="Not authorized to view this user")
        elif user.role == UserRole.ADMIN:
            if target.created_by_id != str(user.id) and str(target.id) != str(user.id):
                raise HTTPException(status_code=403, detail="Not authorized to view this user")
        
        descendant_ids = await get_all_descendants(str(target.id))
        all_involved_ids = [str(target.id)] + descendant_ids
        
        from beanie.operators import In
        invoices = await Invoice.find(In(Invoice.user_id, all_involved_ids)).to_list()
        
        formatted_invoices = []
        for inv in invoices:
            formatted_invoices.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "total_amount": inv.total_amount,
                "payment_mode": inv.payment_mode,
                "created_at": inv.created_at
            })

        return {
            "target_name": target.full_name,
            "total_sales": sum((inv.paid_amount or 0) for inv in invoices),
            "total_invoices": len(invoices),
            "managed_users_count": len(descendant_ids),
            "invoices": formatted_invoices[:20]
        }

    # --- MAIN DASHBOARD VIEWS ---
    
    # 1. Super Admin Stats
    if user.role == UserRole.SUPER_ADMIN:
        try:
            all_invoices = await Invoice.find_all().to_list()
            all_payments = await PaymentRecord.find_all().to_list()
            admins = await User.find(User.role == UserRole.ADMIN).to_list()
            unlinked_pmts = sum(p.amount for p in all_payments if not p.invoice_id)
            return {
                "total_sales": sum((inv.paid_amount or 0) for inv in all_invoices) + unlinked_pmts,
                "total_admins": len(admins),
                "total_users": len(await User.find(User.role == UserRole.USER).to_list()),
                "total_invoices": len(all_invoices),
                "admins": [{"id": str(a.id), "full_name": a.full_name, "email": a.email} for a in admins]
            }
        except Exception as e:
            import traceback
            raise HTTPException(status_code=500, detail=traceback.format_exc())
    
    # 2. Admin Stats
    if user.role == UserRole.ADMIN:
        descendant_ids = await get_all_descendants(str(user.id))
        all_involved_ids = [str(user.id)] + descendant_ids
        
        from beanie.operators import In
        invoices = await Invoice.find(In(Invoice.user_id, all_involved_ids)).to_list()
        payments = await PaymentRecord.find(In(PaymentRecord.user_id, all_involved_ids)).to_list()
        managed_users = await User.find(User.created_by_id == str(user.id)).to_list()
        unlinked_pmts = sum(p.amount for p in payments if not p.invoice_id)
        
        return {
            "active_users": len(descendant_ids),
            "total_invoices": len(invoices),
            "total_sales": sum((inv.paid_amount or 0) for inv in invoices) + unlinked_pmts,
            "managed_users": [{"id": str(u.id), "full_name": u.full_name, "email": u.email} for u in managed_users]
        }

    # 3. Regular User Stats (Default fallback)
    user_invoices = await Invoice.find(Invoice.user_id == str(user.id)).to_list()
    clients_count = len(await Client.find(Client.user_id == str(user.id)).to_list())
    print(f"DEBUG: get_stats for user {user.email} (ID: {user.id}) -> clients: {clients_count}, invoices: {len(user_invoices)}")
    # Get recent invoices
    recent_invoices_objs = await Invoice.find(Invoice.user_id == str(user.id)).sort(-Invoice.date).limit(5).to_list()
    recent_invoices = []
    for inv in recent_invoices_objs:
        client = await Client.get(inv.client_id)
        recent_invoices.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "client_name": client.company_name if client else "Unknown",
            "date": inv.date.isoformat(),
            "total_amount": inv.total_amount,
            "status": inv.status
        })

    user_payments = await PaymentRecord.find(PaymentRecord.user_id == str(user.id)).to_list()
    unlinked_pmts = sum(p.amount for p in user_payments if not p.invoice_id)
    
    # Calculate expense stats
    user_expenses = await Expense.find(Expense.user_id == str(user.id)).to_list()
    total_expenses = sum(exp.amount for exp in user_expenses)
    
    now = datetime.utcnow()
    start_of_today = datetime(now.year, now.month, now.day)
    start_of_month = datetime(now.year, now.month, 1)
    
    today_expenses = sum(exp.amount for exp in user_expenses if exp.date.replace(tzinfo=None) >= start_of_today)
    month_expenses = sum(exp.amount for exp in user_expenses if exp.date.replace(tzinfo=None) >= start_of_month)
    
    return {
        "total_sales": sum((inv.paid_amount or 0) for inv in user_invoices) + unlinked_pmts,
        "total_clients": clients_count,
        "total_products": len(await Product.find(Product.user_id == str(user.id)).to_list()),
        "total_invoices": len(user_invoices),
        "recent_invoices": recent_invoices,
        "total_expenses": total_expenses,
        "today_expenses": today_expenses,
        "month_expenses": month_expenses
    }

# --- Expense Categories endpoints ---

@app.get("/expense-categories", response_model=List[ExpenseCategoryOut])
async def get_expense_categories(user: User = Depends(get_current_user)):
    categories = await ExpenseCategory.find(ExpenseCategory.user_id == str(user.id)).to_list()
    if not categories:
        # Seed defaults
        defaults = ["Coffee", "Tea", "Dinner", "Travel", "Petrol", "Electricity", "Office Supplies"]
        for d in defaults:
            cat = ExpenseCategory(user_id=str(user.id), name=d)
            await cat.insert()
        categories = await ExpenseCategory.find(ExpenseCategory.user_id == str(user.id)).to_list()
    return [{"id": str(c.id), "name": c.name} for c in categories]

@app.post("/expense-categories", response_model=ExpenseCategoryOut)
async def create_expense_category(payload: ExpenseCategoryCreate, user: User = Depends(get_current_user)):
    existing = await ExpenseCategory.find_one(
        ExpenseCategory.user_id == str(user.id),
        ExpenseCategory.name == payload.name
    )
    if existing:
        return {"id": str(existing.id), "name": existing.name}
    cat = ExpenseCategory(user_id=str(user.id), name=payload.name)
    await cat.insert()
    return {"id": str(cat.id), "name": cat.name}

@app.delete("/expense-categories/{category_id}")
async def delete_expense_category(category_id: str, user: User = Depends(get_current_user)):
    cat = await ExpenseCategory.get(category_id)
    if not cat or cat.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Category not found")
    await cat.delete()
    return {"message": "Category deleted successfully"}


# --- Payment Modes endpoints ---

@app.get("/payment-modes", response_model=List[PaymentModeOut])
async def get_payment_modes(user: User = Depends(get_current_user)):
    modes = await PaymentMode.find(PaymentMode.user_id == str(user.id)).to_list()
    if not modes:
        # Seed defaults
        defaults = ["Cash", "UPI", "Bank Transfer", "Card"]
        for d in defaults:
            mode = PaymentMode(user_id=str(user.id), name=d)
            await mode.insert()
        modes = await PaymentMode.find(PaymentMode.user_id == str(user.id)).to_list()
    return [{"id": str(m.id), "name": m.name} for m in modes]

@app.post("/payment-modes", response_model=PaymentModeOut)
async def create_payment_mode(payload: PaymentModeCreate, user: User = Depends(get_current_user)):
    existing = await PaymentMode.find_one(
        PaymentMode.user_id == str(user.id),
        PaymentMode.name == payload.name
    )
    if existing:
        return {"id": str(existing.id), "name": existing.name}
    mode = PaymentMode(user_id=str(user.id), name=payload.name)
    await mode.insert()
    return {"id": str(mode.id), "name": mode.name}

@app.delete("/payment-modes/{mode_id}")
async def delete_payment_mode(mode_id: str, user: User = Depends(get_current_user)):
    mode = await PaymentMode.get(mode_id)
    if not mode or mode.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Payment mode not found")
    await mode.delete()
    return {"message": "Payment mode deleted successfully"}


# --- Expenses endpoints ---

@app.get("/expenses", response_model=List[ExpenseOut])
async def get_expenses(
    category: Optional[str] = None,
    payment_mode: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    query = {"user_id": str(user.id)}
    
    if category:
        query["category"] = category
    if payment_mode:
        query["payment_mode"] = payment_mode
        
    # Build date filters
    if start_date or end_date:
        date_filter = {}
        if start_date:
            try:
                date_filter["$gte"] = datetime.fromisoformat(start_date)
            except ValueError:
                pass
        if end_date:
            try:
                date_filter["$lte"] = datetime.fromisoformat(end_date)
            except ValueError:
                pass
        if date_filter:
            query["date"] = date_filter
            
    expenses = await Expense.find(query).sort(-Expense.date).to_list()
    return [
        {
            "id": str(e.id),
            "category": e.category,
            "amount": e.amount,
            "payment_mode": e.payment_mode,
            "date": e.date,
            "notes": e.notes,
            "created_at": e.created_at
        } for e in expenses
    ]

@app.post("/expenses", response_model=ExpenseOut)
async def create_expense(payload: ExpenseCreate, user: User = Depends(get_current_user)):
    expense = Expense(
        user_id=str(user.id),
        category=payload.category,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        date=payload.date,
        notes=payload.notes
    )
    await expense.insert()
    return {
        "id": str(expense.id),
        "category": expense.category,
        "amount": expense.amount,
        "payment_mode": expense.payment_mode,
        "date": expense.date,
        "notes": expense.notes,
        "created_at": expense.created_at
    }

@app.put("/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense(expense_id: str, payload: ExpenseCreate, user: User = Depends(get_current_user)):
    expense = await Expense.get(expense_id)
    if not expense or expense.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense.category = payload.category
    expense.amount = payload.amount
    expense.payment_mode = payload.payment_mode
    expense.date = payload.date
    expense.notes = payload.notes
    
    await expense.save()
    return {
        "id": str(expense.id),
        "category": expense.category,
        "amount": expense.amount,
        "payment_mode": expense.payment_mode,
        "date": expense.date,
        "notes": expense.notes,
        "created_at": expense.created_at
    }

@app.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: User = Depends(get_current_user)):
    expense = await Expense.get(expense_id)
    if not expense or expense.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Expense not found")
    await expense.delete()
    return {"message": "Expense deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
