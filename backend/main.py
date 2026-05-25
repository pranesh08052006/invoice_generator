from fastapi import FastAPI, Depends, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from datetime import datetime, timedelta
import io

from database import init_db
from models import (
    User, UserRole, Client, Product, Invoice, InvoiceItem, InvoiceStatus, Company,
    Quotation, QuotationStatus, ProformaInvoice, ProformaStatus,
    PaymentRecord, StockAdjustment
)
from schemas import (
    UserCreate, UserOut, ClientCreate, ClientOut, ProductCreate, ProductOut,
    InvoiceCreate, CompanyCreate, CompanyOut,
    QuotationCreate, ProformaCreate, PaymentRecordCreate, StockAdjustmentCreate
)
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, check_role
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
            email="admin@system.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Super Admin",
            role=UserRole.SUPER_ADMIN
        )
        await super_admin.insert()
    yield

app = FastAPI(title="Pro Invoice SaaS", lifespan=lifespan)

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

# --- AUTH ---
@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await User.find_one(User.email == form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    # Ensure user has a string ID in the response
    user_data = user.dict()
    user_data["id"] = str(user.id)
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}

@app.get("/auth/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "created_at": user.created_at
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
            raise HTTPException(status_code=403, detail="Managers can only create employees (Users)")
        
        existing = await User.find_one(User.email == user_in.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        new_user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role=user_in.role,
            created_by_id=str(current_user.id)
        )
        await new_user.insert()
        
        # Manually construct return to avoid Pydantic ObjectId issues
        return {
            "id": str(new_user.id),
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role,
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
        
        # Manually format each user to ensure 'id' is a string
        return [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "created_at": u.created_at
            } for u in users
        ]
    except Exception as e:
        print(f"ERROR LISTING USERS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
            raise HTTPException(status_code=403, detail="Managers can only remove their own Employees")
    
    # Cascade delete in MongoDB
    if target_user.role == UserRole.ADMIN:
        subordinates = await User.find(User.created_by_id == str(target_user.id)).to_list()
        for sub in subordinates:
            await Invoice.find(Invoice.user_id == str(sub.id)).delete()
            await Client.find(Client.user_id == str(sub.id)).delete()
            await Product.find(Product.user_id == str(sub.id)).delete()
            await sub.delete()
    
    await Invoice.find(Invoice.user_id == user_id).delete()
    await Client.find(Client.user_id == user_id).delete()
    await Product.find(Product.user_id == user_id).delete()
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
        # Clean data: remove IDs and handle empty strings
        clean_data = {k: (v if v != "" else None) for k, v in data.items() if k not in ['id', 'user_id', '_id']}
        
        uid = str(user.id)
        company = await Company.find_one({"user_id": uid})
        
        if not company:
            company = Company(user_id=uid)
            await company.insert()
            
        # Update fields
        for k, v in clean_data.items():
            if hasattr(company, k):
                setattr(company, k, v)
        
        await company.save()
        return company
            
    except Exception as e:
        print(f"ERROR SAVING COMPANY: {str(e)}")
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
    try:
        new_client = Client(**client_in.dict(), user_id=str(user.id))
        await new_client.insert()
        return {
            "id": str(new_client.id),
            **new_client.dict(exclude={"id", "user_id"})
        }
    except Exception as e:
        print(f"ERROR CREATING CLIENT: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/clients", response_model=List[ClientOut])
async def get_clients(user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))):
    if user.role == UserRole.SUPER_ADMIN:
        clients = await Client.find_all().to_list()
    else:
        clients = await Client.find(Client.user_id == str(user.id)).to_list()
    return [
        {
            "id": str(c.id),
            **c.dict(exclude={"id", "user_id"})
        } for c in clients
    ]

@app.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: str,
    client_in: ClientCreate,
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
    client = await Client.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role != UserRole.SUPER_ADMIN and client.user_id != str(user.id):
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
    client = await Client.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role != UserRole.SUPER_ADMIN and client.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    await client.delete()
    return {"message": "Client deleted"}

# --- PRODUCTS ---
@app.post("/products", response_model=ProductOut)
async def create_product(
    product_in: ProductCreate, 
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
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
        products = await Product.find(Product.user_id == str(user.id)).to_list()
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
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if user.role != UserRole.SUPER_ADMIN and product.user_id != str(user.id):
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
    if user.role != UserRole.SUPER_ADMIN and product.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    await product.delete()
    return {"message": "Product deleted"}

# --- INVOICES ---
@app.post("/invoices")
async def create_invoice(
    invoice_in: InvoiceCreate, 
    user: User = Depends(check_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]))
):
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
            
            if item.product_id:
                db_product = await Product.get(item.product_id)
                if db_product:
                    db_product.stock -= (item.quantity or 0)
                    await db_product.save()
            
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
    invoice = await Invoice.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    can_update = False
    if user.role == UserRole.SUPER_ADMIN:
        can_update = True
    elif user.role == UserRole.ADMIN:
        creator = await User.get(invoice.user_id)
        if str(creator.id) == str(user.id) or creator.created_by_id == str(user.id):
            can_update = True
    elif user.role == UserRole.USER:
        if invoice.user_id == str(user.id):
            can_update = True
            
    if not can_update:
        raise HTTPException(status_code=403, detail="Not authorized to update this invoice")
        
    new_status = status_in.get("status", "").upper()
    invoice.status = new_status
    await invoice.save()
    return {"detail": "Status updated"}

@app.get("/invoices")
async def get_invoices(user: User = Depends(get_current_user)):
    try:
        if user.role == UserRole.SUPER_ADMIN:
            invoices = await Invoice.find_all().to_list()
        elif user.role == UserRole.ADMIN:
            descendant_ids = await get_all_descendants(str(user.id))
            all_involved_ids = [str(user.id)] + descendant_ids
            from beanie.operators import In
            invoices = await Invoice.find(In(Invoice.user_id, all_involved_ids)).to_list()
        else:
            invoices = await Invoice.find(Invoice.user_id == str(user.id)).to_list()
        
        # Filter out soft-deleted invoices and sort newest first
        invoices = [inv for inv in invoices if not getattr(inv, 'is_deleted', False)]
        invoices.sort(key=lambda x: x.created_at or x.date, reverse=True)
            
        results = []
        for inv in invoices:
            creator = await User.get(inv.user_id)
            client = await Client.get(inv.client_id)
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
        
        if saved_company:
            business_details = {
                "name": saved_company.name,
                "address": saved_company.address,
                "email": saved_company.email or user.email,
                "phone": saved_company.mobile,
                "gst": saved_company.gst_number,
                "signature_url": saved_company.signature_url,
                "bank": {
                    "bank_name": saved_company.bank_name or "N/A",
                    "account_no": saved_company.account_no or "N/A",
                    "ifsc": saved_company.ifsc or "N/A",
                    "account_type": saved_company.account_type or "Current",
                    "account_holder_name": saved_company.account_holder_name or saved_company.name
                }
            }
        else:
            business_details = {
                "name": (creator.full_name if creator else user.full_name) + " Business",
                "address": "123 Business Plaza, City, India",
                "email": creator.email if creator else user.email,
                "phone": "+91 9876543210",
                "gst": "33AABCA1234A1Z1",
                "bank": {
                    "bank_name": "City Union Bank Limited",
                    "account_no": "500101011467177",
                    "ifsc": "CIUB0000524",
                    "account_type": "Current",
                    "account_holder_name": creator.full_name if creator else user.full_name
                }
            }
        
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
        
        if saved_company:
            business_details = {
                "name": saved_company.name,
                "address": saved_company.address,
                "email": saved_company.email or user.email,
                "phone": saved_company.mobile,
                "gst": saved_company.gst_number,
                "signature_url": saved_company.signature_url,
                "bank": {
                    "bank_name": saved_company.bank_name or "N/A",
                    "account_no": saved_company.account_no or "N/A",
                    "ifsc": saved_company.ifsc or "N/A",
                    "account_type": saved_company.account_type or "Current",
                    "account_holder_name": saved_company.account_holder_name or saved_company.name
                }
            }
        else:
            business_details = {
                "name": user.full_name + " Business",
                "address": "123 Business Plaza, City, India",
                "email": user.email,
                "phone": "+91 9876543210",
                "gst": "33AABCA1234A1Z1",
                "bank": {
                    "bank_name": "City Union Bank Limited",
                    "account_no": "500101011467177",
                    "ifsc": "CIUB0000524",
                    "account_type": "Current",
                    "account_holder_name": user.full_name
                }
            }
        
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
    invoice = await Invoice.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if user.role != UserRole.SUPER_ADMIN and invoice.user_id != str(user.id):
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
    invoice = await Invoice.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if user.role != UserRole.SUPER_ADMIN and invoice.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sub_total = 0
    total_gst = 0
    items_to_save = []
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
    user: User = Depends(get_current_user)
):
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
            quotations = await Quotation.find(Quotation.user_id == str(user.id)).to_list()
        quotations = [q for q in quotations if not getattr(q, 'is_deleted', False)]
        quotations.sort(key=lambda x: x.created_at, reverse=True)
        results = []
        for q in quotations:
            client = await Client.get(q.client_id)
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
    q = await Quotation.get(quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if user.role != UserRole.SUPER_ADMIN and q.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    q.is_deleted = True
    await q.save()
    return {"detail": "Quotation deleted"}

@app.post("/quotations/{quotation_id}/convert")
async def convert_quotation_to_invoice(
    quotation_id: str,
    body: dict,
    user: User = Depends(get_current_user)
):
    """Convert a quotation to a full invoice."""
    q = await Quotation.get(quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if user.role != UserRole.SUPER_ADMIN and q.user_id != str(user.id):
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
    user: User = Depends(get_current_user)
):
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
            proformas = await ProformaInvoice.find(ProformaInvoice.user_id == str(user.id)).to_list()
        proformas = [p for p in proformas if not getattr(p, 'is_deleted', False)]
        proformas.sort(key=lambda x: x.created_at, reverse=True)
        results = []
        for p in proformas:
            client = await Client.get(p.client_id)
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
    p = await ProformaInvoice.get(proforma_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proforma not found")
    if user.role != UserRole.SUPER_ADMIN and p.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    p.is_deleted = True
    await p.save()
    return {"detail": "Proforma deleted"}

@app.post("/proformas/{proforma_id}/convert")
async def convert_proforma_to_invoice(
    proforma_id: str,
    body: dict,
    user: User = Depends(get_current_user)
):
    p = await ProformaInvoice.get(proforma_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proforma not found")
    if user.role != UserRole.SUPER_ADMIN and p.user_id != str(user.id):
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
    if user.role != UserRole.SUPER_ADMIN and product.user_id != str(user.id):
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
        adjs = await StockAdjustment.find(StockAdjustment.user_id == str(user.id)).to_list()
    adjs.sort(key=lambda x: x.created_at, reverse=True)
    results = []
    for a in adjs:
        product = await Product.get(a.product_id)
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
        payments = await PaymentRecord.find(PaymentRecord.user_id == str(user.id)).to_list()
    payments.sort(key=lambda x: x.created_at, reverse=True)
    results = []
    for p in payments:
        client = await Client.get(p.client_id)
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
        invoices = await Invoice.find(Invoice.user_id == uid).to_list()
        clients = await Client.find(Client.user_id == uid).to_list()
        products = await Product.find(Product.user_id == uid).to_list()
    
    invoices = [i for i in invoices if not getattr(i, 'is_deleted', False)]
    
    total_revenue = sum(i.paid_amount or 0 for i in invoices)
    total_outstanding = sum((i.total_amount or 0) - (i.paid_amount or 0) for i in invoices if i.status != InvoiceStatus.PAID)
    total_invoiced = sum(i.total_amount or 0 for i in invoices)
    
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
async def get_all_descendants(user_id: str) -> List[str]:
    descendants = []
    children = await User.find(User.created_by_id == user_id).to_list()
    for child in children:
        descendants.append(str(child.id))
        descendants.extend(await get_all_descendants(str(child.id)))
    return descendants

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
            admins = await User.find(User.role == UserRole.ADMIN).to_list()
            return {
                "total_sales": sum((inv.paid_amount or 0) for inv in all_invoices),
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
        managed_users = await User.find(User.created_by_id == str(user.id)).to_list()
        
        return {
            "active_users": len(descendant_ids),
            "total_invoices": len(invoices),
            "total_sales": sum((inv.paid_amount or 0) for inv in invoices),
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

    return {
        "total_sales": sum((inv.paid_amount or 0) for inv in user_invoices),
        "total_clients": clients_count,
        "total_products": len(await Product.find(Product.user_id == str(user.id)).to_list()),
        "total_invoices": len(user_invoices),
        "recent_invoices": recent_invoices
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
