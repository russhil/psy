"""
PsyShot — Tattoo Studio CRM
Main FastAPI Application
"""

import os
import logging
from contextlib import asynccontextmanager
from datetime import date

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from auth import (
    hash_password, verify_password, create_token,
    get_current_user
)
from database import (
    init_db, get_user_by_username, create_user,
    get_customers, get_customer_by_id, check_duplicate_customer,
    create_customer, update_customer, search_customers_by_conditions,
    get_orders, get_order_by_id, create_order,
    get_expenses, create_expense,
    create_campaign, update_campaign_status,
    create_message_log, get_campaign_messages,
    create_ocr_session, update_ocr_session,
    get_financial_summary, get_artists, create_artist, get_artist_by_name,
)
from llm_provider import init_llm
from ocr_utils import extract_order_from_image, extract_orders_from_image
from nl_filter import parse_nl_filter, build_supabase_query_from_conditions, run_inference
from expense_parser import parse_expense
import whatsapp_utils

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown."""
    logger.info("Starting PsyShot CRM...")
    init_db()
    init_llm()

    # Ensure admin user exists
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    existing = get_user_by_username(admin_user)
    if not existing:
        create_user(admin_user, hash_password(admin_pass))
        logger.info(f"Created admin user: {admin_user}")

    yield
    logger.info("Shutting down PsyShot CRM.")


app = FastAPI(
    title="PsyShot — Tattoo Studio CRM",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Pydantic Models
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class LoginRequest(BaseModel):
    username: str
    password: str


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    instagram: str | None = None
    email: str | None = None
    source: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    instagram: str | None = None
    email: str | None = None
    source: str | None = None
    notes: str | None = None


class DuplicateCheck(BaseModel):
    phone: str = ""
    instagram: str = ""


class OrderCreate(BaseModel):
    customer_id: str
    artist_id: str | None = None
    order_date: str | None = None
    service_description: str | None = None
    payment_mode: str | None = None
    deposit: float = 0
    total: float = 0
    comments: str | None = None
    source: str | None = None


class OCRConfirm(BaseModel):
    session_id: str
    fields: dict
    customer_id: str | None = None
    create_new_customer: bool = False
    customer_data: dict | None = None


class OCRBulkConfirmRow(BaseModel):
    fields: dict
    customer_id: str | None = None
    create_new_customer: bool = True
    customer_data: dict | None = None


class OCRBulkConfirm(BaseModel):
    session_id: str
    orders: list[OCRBulkConfirmRow]


class FilterRequest(BaseModel):
    filter_text: str


class CampaignSend(BaseModel):
    template_name: str
    language_code: str = "en"
    customer_ids: list[str]
    nl_filter_text: str = ""
    resolved_query: str = ""


class ExpenseParseRequest(BaseModel):
    text: str


class ExpenseConfirm(BaseModel):
    amount: float
    category: str = "other"
    description: str = ""
    vendor: str = "UNKNOWN"
    payment_mode: str = "other"
    date: str = ""
    raw_input: str = ""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(req.username)
    return {"token": token, "username": req.username}


@app.get("/api/auth/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Customer Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/customers")
async def list_customers(
    search: str = "",
    source: str = "",
    artist_id: str = "",
    date_from: str = "",
    date_to: str = "",
    spend_min: float = 0,
    spend_max: float = 0,
    limit: int = 100,
    offset: int = 0,
    _user: str = Depends(get_current_user),
):
    customers = get_customers(
        search=search, source=source, artist_id=artist_id,
        date_from=date_from, date_to=date_to,
        spend_min=spend_min, spend_max=spend_max,
        limit=limit, offset=offset,
    )
    return {"customers": customers, "count": len(customers)}


@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: str, _user: str = Depends(get_current_user)):
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    orders = get_orders(customer_id=customer_id)
    customer["orders"] = orders
    return customer


@app.post("/api/customers")
async def add_customer(req: CustomerCreate, _user: str = Depends(get_current_user)):
    # Check for duplicates
    dup = check_duplicate_customer(phone=req.phone or "", instagram=req.instagram or "")
    if dup["matches"]:
        return {
            "created": False,
            "duplicate_detected": True,
            "match_type": dup["match_type"],
            "matches": dup["matches"],
            "message": "Potential duplicate found. Please confirm or merge.",
        }
    customer = create_customer(req.model_dump())
    return {"created": True, "customer": customer}


@app.put("/api/customers/{customer_id}")
async def edit_customer(customer_id: str, req: CustomerUpdate, _user: str = Depends(get_current_user)):
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    customer = update_customer(customer_id, data)
    return {"updated": True, "customer": customer}


@app.post("/api/customers/check-duplicate")
async def check_duplicate(req: DuplicateCheck, _user: str = Depends(get_current_user)):
    result = check_duplicate_customer(phone=req.phone, instagram=req.instagram)
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Order Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/orders")
async def list_orders(
    customer_id: str = "",
    limit: int = 100,
    _user: str = Depends(get_current_user),
):
    orders = get_orders(customer_id=customer_id, limit=limit)
    return {"orders": orders}


@app.get("/api/orders/{order_id}")
async def get_single_order(order_id: str, _user: str = Depends(get_current_user)):
    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.post("/api/orders")
async def add_order(req: OrderCreate, _user: str = Depends(get_current_user)):
    # Verify customer exists
    customer = get_customer_by_id(req.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    order = create_order(req.model_dump())
    return {"created": True, "order": order}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OCR Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/ocr/extract")
async def ocr_extract(
    file: UploadFile = File(...),
    _user: str = Depends(get_current_user),
):
    """Upload an image → extract multiple orders as structured fields."""
    content = await file.read()
    content_type = file.content_type or "image/png"

    result = extract_orders_from_image(content, mime_type=content_type)

    if result["error"]:
        return {
            "success": False,
            "error": result["error"],
            "orders": [],
            "raw_text": result.get("raw_text", ""),
        }

    # Create an OCR session (pending) with all extracted orders
    session = create_ocr_session({
        "extracted_fields": {"orders": [o for o in result["orders"]]},
        "confidence": max((o["confidence"] for o in result["orders"]), default=0),
        "status": "pending",
    })

    return {
        "success": True,
        "session_id": session.get("id"),
        "orders": result["orders"],
        "raw_text": result["raw_text"],
    }


@app.post("/api/ocr/confirm")
async def ocr_confirm(req: OCRConfirm, _user: str = Depends(get_current_user)):
    """Confirm OCR extraction → create order and optionally create/link customer."""
    customer_id = req.customer_id

    # Create new customer if requested
    if req.create_new_customer and req.customer_data:
        customer = create_customer(req.customer_data)
        customer_id = customer.get("id")

    if not customer_id:
        raise HTTPException(status_code=400, detail="Must provide customer_id or create_new_customer")

    # Resolve artist
    artist_id = None
    artist_name = req.fields.get("artist")
    if artist_name:
        artist = get_artist_by_name(artist_name)
        if artist:
            artist_id = artist["id"]
        else:
            # Create artist if not found
            artist = create_artist(artist_name)
            artist_id = artist.get("id")

    # Create order
    order_data = {
        "customer_id": customer_id,
        "artist_id": artist_id,
        "order_date": req.fields.get("date", date.today().isoformat()),
        "service_description": req.fields.get("service_description"),
        "payment_mode": req.fields.get("payment_mode"),
        "deposit": req.fields.get("deposit", 0),
        "total": req.fields.get("total", 0),
        "comments": req.fields.get("comments"),
        "source": req.fields.get("source"),
    }
    order = create_order(order_data)

    # Update OCR session
    update_ocr_session(req.session_id, {
        "status": "confirmed",
        "linked_order_id": order.get("id"),
    })

    return {
        "success": True,
        "order": order,
        "customer_id": customer_id,
    }


@app.post("/api/ocr/bulk-confirm")
async def ocr_bulk_confirm(req: OCRBulkConfirm, _user: str = Depends(get_current_user)):
    """Bulk confirm multiple OCR-extracted orders → create customers + orders."""
    results = []
    for row in req.orders:
        try:
            customer_id = row.customer_id

            # Create new customer if requested
            if row.create_new_customer and row.customer_data:
                # Check for duplicate first
                phone = row.customer_data.get("phone", "") or ""
                instagram = row.customer_data.get("instagram", "") or ""
                dup = check_duplicate_customer(phone=phone, instagram=instagram)
                if dup["matches"]:
                    # Link to existing customer
                    customer_id = dup["matches"][0]["id"]
                else:
                    customer = create_customer(row.customer_data)
                    customer_id = customer.get("id")

            if not customer_id:
                results.append({"success": False, "error": "No customer info"})
                continue

            # Resolve artist
            artist_id = None
            artist_name = row.fields.get("artist")
            if artist_name:
                artist = get_artist_by_name(artist_name)
                if artist:
                    artist_id = artist["id"]
                else:
                    artist = create_artist(artist_name)
                    artist_id = artist.get("id")

            # Create order
            order_data = {
                "customer_id": customer_id,
                "artist_id": artist_id,
                "order_date": row.fields.get("date", date.today().isoformat()),
                "service_description": row.fields.get("service_description"),
                "payment_mode": row.fields.get("payment_mode"),
                "deposit": row.fields.get("deposit", 0),
                "total": row.fields.get("total", 0),
                "comments": row.fields.get("comments"),
                "source": row.fields.get("source"),
            }
            order = create_order(order_data)
            results.append({
                "success": True,
                "order_id": order.get("id"),
                "customer_id": customer_id,
                "customer_name": row.fields.get("customer_name", "Unknown"),
            })
        except Exception as e:
            logger.error(f"[OCR Bulk] Error creating order: {e}")
            results.append({
                "success": False,
                "error": str(e),
                "customer_name": row.fields.get("customer_name", "Unknown"),
            })

    # Update OCR session
    update_ocr_session(req.session_id, {"status": "confirmed"})

    return {
        "success": True,
        "total": len(results),
        "saved": sum(1 for r in results if r.get("success")),
        "failed": sum(1 for r in results if not r.get("success")),
        "results": results,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WhatsApp Campaign Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/whatsapp/templates")
async def list_templates(_user: str = Depends(get_current_user)):
    result = whatsapp_utils.fetch_templates()
    return result


@app.post("/api/campaigns/filter")
async def campaign_filter(req: FilterRequest, _user: str = Depends(get_current_user)):
    """Convert NL filter text into matched customer list. Preview only — no sends."""
    filter_result = parse_nl_filter(req.filter_text)

    if not filter_result["success"]:
        return {
            "success": False,
            "error": filter_result["error"],
            "suggestion": filter_result["suggestion"],
            "customers": [],
            "inference_caution": None,
            "inferred_fields": [],
        }

    # Build and execute query for normal conditions
    conditions = filter_result["conditions"]
    inferred_fields = filter_result.get("inferred_fields", [])

    if conditions:
        query_info = build_supabase_query_from_conditions(conditions)
        customers = search_customers_by_conditions(
            query_info["simple_filters"],
            query_info["computed_filters"],
        )
    else:
        # Only inferred fields, no normal conditions → fetch all customers
        customers = search_customers_by_conditions([], [])

    # Apply AI inference if inferred fields are present
    if inferred_fields:
        customers = run_inference(customers, inferred_fields)

    return {
        "success": True,
        "customers": customers,
        "count": len(customers),
        "filter_conditions": conditions,
        "raw_ai_response": filter_result["raw_response"],
        "inference_caution": filter_result.get("inference_caution"),
        "inferred_fields": inferred_fields,
    }


@app.post("/api/campaigns/preview")
async def campaign_preview(
    template_name: str = Form(""),
    customer_ids: str = Form(""),
    _user: str = Depends(get_current_user),
):
    """Preview rendered template messages for selected customers."""
    # Fetch template
    templates_result = whatsapp_utils.fetch_templates()
    template = None
    if templates_result["success"]:
        for t in templates_result["templates"]:
            if t["name"] == template_name:
                template = t
                break

    if not template:
        return {"success": False, "error": f"Template '{template_name}' not found", "previews": []}

    # Get customers
    ids = [cid.strip() for cid in customer_ids.split(",") if cid.strip()]
    previews = []
    for cid in ids:
        customer = get_customer_by_id(cid)
        if customer:
            preview = whatsapp_utils.render_template_preview(template, customer)
            previews.append(preview)

    return {"success": True, "previews": previews}


@app.post("/api/campaigns/send")
async def campaign_send(req: CampaignSend, _user: str = Depends(get_current_user)):
    """Confirm and send template messages to selected customers."""
    # Create campaign record
    campaign = create_campaign({
        "template_name": req.template_name,
        "nl_filter_text": req.nl_filter_text,
        "resolved_query": req.resolved_query,
        "matched_count": len(req.customer_ids),
        "status": "sending",
    })
    campaign_id = campaign.get("id")

    # Gather customer data
    customers = []
    for cid in req.customer_ids:
        c = get_customer_by_id(cid)
        if c:
            customers.append(c)

    # Send batch
    results = whatsapp_utils.send_batch_template(
        customers=customers,
        template_name=req.template_name,
        language_code=req.language_code,
    )

    # Log each message
    success_count = 0
    for r in results:
        log_data = {
            "campaign_id": campaign_id,
            "customer_id": r.get("customer_id"),
            "phone": r.get("phone", ""),
            "template_name": req.template_name,
            "rendered_payload": {"template": req.template_name, "customer_name": r.get("customer_name")},
            "status": "sent" if r.get("success") else "failed",
            "error_message": r.get("error"),
            "whatsapp_message_id": r.get("message_id"),
        }
        create_message_log(log_data)
        if r.get("success"):
            success_count += 1

    # Update campaign status
    final_status = "completed" if success_count > 0 else "failed"
    update_campaign_status(campaign_id, final_status)

    return {
        "success": True,
        "campaign_id": campaign_id,
        "total": len(results),
        "sent": success_count,
        "failed": len(results) - success_count,
        "results": results,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Expense Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/expenses/parse")
async def expense_parse(req: ExpenseParseRequest, _user: str = Depends(get_current_user)):
    """Parse NL expense text → structured fields. Preview only — no DB write."""
    result = parse_expense(req.text)
    return result


@app.post("/api/expenses/confirm")
async def expense_confirm(req: ExpenseConfirm, _user: str = Depends(get_current_user)):
    """Confirm parsed expense → write to database."""
    expense = create_expense(req.model_dump())
    return {"success": True, "expense": expense}


@app.get("/api/expenses")
async def list_expenses(
    date_from: str = "",
    date_to: str = "",
    category: str = "",
    limit: int = 200,
    _user: str = Depends(get_current_user),
):
    expenses = get_expenses(date_from=date_from, date_to=date_to, category=category, limit=limit)
    return {"expenses": expenses}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Finance Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/finance/summary")
async def finance_summary(
    date_from: str = "",
    date_to: str = "",
    _user: str = Depends(get_current_user),
):
    summary = get_financial_summary(date_from=date_from, date_to=date_to)
    return summary


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Artist Routes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/artists")
async def list_artists(_user: str = Depends(get_current_user)):
    artists = get_artists()
    return {"artists": artists}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Health Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "psyshot-crm"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
