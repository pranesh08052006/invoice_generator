from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from datetime import datetime, timedelta
import io
from uuid import uuid4
from bson import ObjectId
from beanie.operators import In

from database import init_db
from models import (
    User, UserRole, Client, Product, Invoice, InvoiceItem, InvoiceStatus, Company,
    Quotation, QuotationStatus, ProformaInvoice, ProformaStatus,
    PaymentRecord, StockAdjustment, Subscription, PlanType
)

from schemas import (
    UserCreate, UserOut, ClientCreate, ClientOut, ProductCreate, ProductOut,
    InvoiceCreate, CompanyCreate, CompanyOut,
    QuotationCreate, ProformaCreate, PaymentRecordCreate, StockAdjustmentCreate,
    ChangePasswordRequest
)
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, check_role, SessionExpiredException
)
from pdf_gen import generate_invoice_pdf
from contextlib import asynccontextmanager
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
    yield

from fastapi.responses import JSONResponse

app = FastAPI(title="Pro Invoice SaaS", lifespan=lifespan)

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
    if user.role == UserRole.SUPER_ADMIN:
        return []
    if user.role == UserRole.USER:
        # Standard users should only have access to their own data
        return [str(user.id)]
    ancestors = await get_ancestors(user)
    top_admin_id = ancestors[-1]
    descendants = await get_all_descendants(top_admin_id)
    return [top_admin_id] + descendants

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

# --- AUTH ---
@app.post("/auth/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    user = await User.find_one(User.email == form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    # Generate a fresh unique session ID — this immediately invalidates any
    # previously issued token for this account on any other device/browser.
    session_id = str(uuid4())

    # Capture login metadata
    client_ip = request.client.host
    user.current_session_id = session_id
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = client_ip
    user.last_login_device = parse_user_agent(request.headers.get("User-Agent", ""))
    await user.save()

    # Embed session_id inside the JWT as the 'sid' claim
    access_token = create_access_token(data={"sub": user.email}, session_id=session_id)

    user_data = user.dict()
    user_data["id"] = str(user.id)
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}


@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Invalidates the current session by clearing current_session_id in the DB.
    Any JWT that previously belonged to this session will be rejected on the
    next request, even if it hasn't expired yet.
    """
    current_user.current_session_id = None
    await current_user.save()
    return {"message": "Logged out successfully"}


@app.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.hashed_password = get_password_hash(data.new_password)
    # Invalidate all active sessions (force login again) by generating a new session ID
    current_user.current_session_id = str(uuid4())
    await current_user.save()
    return {"message": "Password changed successfully. Please log in again."}


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
        new_user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role=user_in.role,
            created_by_id=str(current_user.id),
            trial_start_date=now,
            trial_end_date=now + timedelta(days=7),
            has_full_access=False
        )
        await new_user.insert()
        
        return {
            "id": str(new_user.id),
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "has_full_access": new_user.has_full_access,
            "trial_start_date": new_user.trial_start_date,
            "trial_end_date": new_user.trial_end_date,
            "created_at": new_user.created_at
        }
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
            users = await User.find(User.role == UserRole.ADMIN).to_list()
        else:
            users = await User.find(User.created_by_id == str(current_user.id), User.role == UserRole.USER).to_list()
        
        return [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "has_full_access": u.has_full_access,
                "trial_start_date": u.trial_start_date,
                "trial_end_date": u.trial_end_date,
                "created_at": u.created_at
            } for u in users
        ]
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

    # Cascade delete in MongoDB
    if target_user.role == UserRole.ADMIN:
        subordinates = await User.find(User.created_by_id == str(target_user.id)).to_list()
        for sub in subordinates:
            await _purge_user_data(str(sub.id))
            await sub.delete()
    
    await _purge_user_data(user_id)
    await target_user.delete()
    
    return {"detail": "User removed successfully"}

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
        clients = await Client.find_all().to_list()
    else:
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
        products = await Product.find_all().to_list()
    else:
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
            invoices = await Invoice.find_all().to_list()
        else:
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
            quotations = await Quotation.find_all().to_list()
        else:
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
            proformas = await ProformaInvoice.find_all().to_list()
        else:
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
        adjs = await StockAdjustment.find_all().to_list()
    else:
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
        payments = await PaymentRecord.find_all().to_list()
    else:
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
        invoices = await Invoice.find_all().to_list()
        clients = await Client.find_all().to_list()
        products = await Product.find_all().to_list()
    else:
        org_ids = await get_org_user_ids(user)
        invoices = await Invoice.find(In(Invoice.user_id, org_ids)).to_list()
        clients = await Client.find(In(Client.user_id, org_ids)).to_list()
        products = await Product.find(In(Product.user_id, org_ids)).to_list()
    
    invoices = [i for i in invoices if not getattr(i, 'is_deleted', False)]
    
    # Fetch all payments to include general payments (unlinked to invoices)
    if user.role == UserRole.SUPER_ADMIN:
        payments = await PaymentRecord.find_all().to_list()
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
        "low_stock_products": low_stock
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
        
        # Security: Admins can only see their own subordinates
        if user.role == UserRole.ADMIN:
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
    
    return {
        "total_sales": sum((inv.paid_amount or 0) for inv in user_invoices) + unlinked_pmts,
        "total_clients": clients_count,
        "total_products": len(await Product.find(Product.user_id == str(user.id)).to_list()),
        "total_invoices": len(user_invoices),
        "recent_invoices": recent_invoices
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
