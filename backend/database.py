"""
Database operations for PsyShot CRM.
All Supabase CRUD operations in one module.
"""

import os
import logging
from datetime import date, datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_db: Client | None = None


def init_db() -> Client:
    """Initialize Supabase client."""
    global _db
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
    _db = create_client(url, key)
    return _db


def get_db() -> Client:
    """Return the Supabase client."""
    if _db is None:
        return init_db()
    return _db


# ━━━━━━━━━━━━━━━━━━━
# Users
# ━━━━━━━━━━━━━━━━━━━

def get_user_by_username(username: str) -> dict | None:
    resp = get_db().table("users").select("*").eq("username", username).execute()
    data = resp.data
    return data[0] if data else None


def create_user(username: str, password_hash: str) -> dict:
    resp = get_db().table("users").insert({
        "username": username,
        "password_hash": password_hash,
    }).execute()
    return resp.data[0] if resp.data else {}


# ━━━━━━━━━━━━━━━━━━━
# Artists
# ━━━━━━━━━━━━━━━━━━━

def get_artists(active_only: bool = True) -> list[dict]:
    q = get_db().table("artists").select("*")
    if active_only:
        q = q.eq("is_active", True)
    resp = q.order("name").execute()
    return resp.data or []


def create_artist(name: str) -> dict:
    resp = get_db().table("artists").insert({"name": name}).execute()
    return resp.data[0] if resp.data else {}


def get_artist_by_name(name: str) -> dict | None:
    resp = get_db().table("artists").select("*").ilike("name", name).execute()
    return resp.data[0] if resp.data else None


# ━━━━━━━━━━━━━━━━━━━
# Customers
# ━━━━━━━━━━━━━━━━━━━

def _batch_customer_metrics(customer_ids: list[str]) -> dict[str, dict]:
    """Batch-fetch metrics for multiple customers in 2 queries instead of 2*N."""
    if not customer_ids:
        return {}

    # Single query: all orders for all these customers
    orders_resp = get_db().table("orders").select(
        "customer_id, total, order_date, artist_id"
    ).in_("customer_id", customer_ids).order("order_date", desc=True).execute()
    all_orders = orders_resp.data or []

    # Group orders by customer
    orders_by_cust: dict[str, list] = {}
    artist_ids_needed = set()
    for o in all_orders:
        cid = o["customer_id"]
        orders_by_cust.setdefault(cid, []).append(o)
        if o.get("artist_id"):
            artist_ids_needed.add(o["artist_id"])

    # Single query: all artist names we need
    artist_names = {}
    if artist_ids_needed:
        artists_resp = get_db().table("artists").select("id, name").in_(
            "id", list(artist_ids_needed)
        ).execute()
        for a in (artists_resp.data or []):
            artist_names[a["id"]] = a["name"]

    # Compute metrics per customer
    metrics = {}
    for cid in customer_ids:
        orders = orders_by_cust.get(cid, [])
        lifetime_spend = sum(float(o.get("total", 0)) for o in orders)
        visit_count = len(orders)
        last_visit_date = orders[0]["order_date"] if orders else None
        last_artist_id = orders[0]["artist_id"] if orders else None
        last_artist_name = artist_names.get(last_artist_id) if last_artist_id else None

        metrics[cid] = {
            "lifetime_spend": lifetime_spend,
            "visit_count": visit_count,
            "last_visit_date": last_visit_date,
            "last_artist_id": last_artist_id,
            "last_artist_name": last_artist_name,
        }
    return metrics


def get_customers(
    search: str = "",
    source: str = "",
    artist_id: str = "",
    date_from: str = "",
    date_to: str = "",
    spend_min: float = 0,
    spend_max: float = 0,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Get customers with search and filter support. Returns enriched with metrics."""
    q = get_db().table("customers").select("*")

    if search:
        q = q.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%,instagram.ilike.%{search}%")

    if source:
        q = q.eq("source", source)

    resp = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    customers = resp.data or []

    # Batch-fetch metrics (2 queries instead of 2*N)
    cust_ids = [c["id"] for c in customers]
    all_metrics = _batch_customer_metrics(cust_ids)

    enriched = []
    for c in customers:
        metrics = all_metrics.get(c["id"], {})
        c.update(metrics)

        # Apply post-query filters
        if artist_id and metrics.get("last_artist_id") != artist_id:
            continue
        if date_from and metrics.get("last_visit_date") and metrics["last_visit_date"] < date_from:
            continue
        if date_to and metrics.get("last_visit_date") and metrics["last_visit_date"] > date_to:
            continue
        if spend_min and metrics.get("lifetime_spend", 0) < spend_min:
            continue
        if spend_max and metrics.get("lifetime_spend", 0) > spend_max:
            continue

        enriched.append(c)

    return enriched


def get_customer_by_id(customer_id: str) -> dict | None:
    resp = get_db().table("customers").select("*").eq("id", customer_id).execute()
    if not resp.data:
        return None
    customer = resp.data[0]
    customer.update(get_customer_metrics(customer_id))
    return customer


def get_customer_metrics(customer_id: str) -> dict:
    """Get aggregated metrics for a customer."""
    orders_resp = get_db().table("orders").select(
        "total, order_date, artist_id"
    ).eq("customer_id", customer_id).order("order_date", desc=True).execute()

    orders = orders_resp.data or []

    lifetime_spend = sum(float(o.get("total", 0)) for o in orders)
    visit_count = len(orders)
    last_visit_date = orders[0]["order_date"] if orders else None
    last_artist_id = orders[0]["artist_id"] if orders else None

    # Get last artist name
    last_artist_name = None
    if last_artist_id:
        artist_resp = get_db().table("artists").select("name").eq("id", last_artist_id).execute()
        if artist_resp.data:
            last_artist_name = artist_resp.data[0]["name"]

    return {
        "lifetime_spend": lifetime_spend,
        "visit_count": visit_count,
        "last_visit_date": last_visit_date,
        "last_artist_id": last_artist_id,
        "last_artist_name": last_artist_name,
    }


def check_duplicate_customer(phone: str = "", instagram: str = "") -> dict:
    """
    Check for duplicate customers by phone (primary) and Instagram (secondary).

    Returns:
        dict with 'matches' list and 'match_type' ('exact_phone', 'instagram_only', 'none')
    """
    matches = []
    match_type = "none"

    if phone:
        resp = get_db().table("customers").select("*").eq("phone", phone).execute()
        if resp.data:
            matches = resp.data
            match_type = "exact_phone"
            return {"matches": matches, "match_type": match_type}

    if instagram:
        resp = get_db().table("customers").select("*").ilike("instagram", instagram).execute()
        if resp.data:
            matches = resp.data
            match_type = "instagram_only"

    return {"matches": matches, "match_type": match_type}


def create_customer(data: dict) -> dict:
    """Create a new customer."""
    instagram = data.get("instagram")
    if instagram and isinstance(instagram, str):
        instagram = instagram.lstrip("@")
    payload = {
        "name": data.get("name", ""),
        "phone": data.get("phone"),
        "instagram": instagram,
        "email": data.get("email"),
        "source": data.get("source"),
        "notes": data.get("notes"),
    }
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = get_db().table("customers").insert(payload).execute()
    return resp.data[0] if resp.data else {}


def update_customer(customer_id: str, data: dict) -> dict:
    """Update customer fields."""
    allowed = {"name", "phone", "instagram", "email", "source", "notes"}
    payload = {k: v for k, v in data.items() if k in allowed}
    resp = get_db().table("customers").update(payload).eq("id", customer_id).execute()
    return resp.data[0] if resp.data else {}


def search_customers_by_conditions(simple_filters: list, computed_filters: list) -> list[dict]:
    """
    Search customers using structured filter conditions from NL filter engine.
    Handles customer-level fields, order-level fields, and computed fields.
    """
    ORDER_FIELDS = {"order_date", "service_description", "payment_mode", "deposit", "total", "artist_name"}

    # Separate customer-level and order-level filters
    customer_filters = []
    order_filters = []
    for field, op, value in simple_filters:
        if field in ORDER_FIELDS:
            order_filters.append((field, op, value))
        else:
            customer_filters.append((field, op, value))

    logger.info(f"[NL Filter DB] customer_filters={customer_filters}, order_filters={order_filters}, computed_filters={computed_filters}")

    # Step 1: Find customer IDs that match order-level filters
    order_matched_ids = None  # None = no order filter applied
    if order_filters:
        oq = get_db().table("orders").select("customer_id")
        for field, op, value in order_filters:
            if op == "eq":
                oq = oq.eq(field, value)
            elif op == "neq":
                oq = oq.neq(field, value)
            elif op == "gt":
                oq = oq.gt(field, value)
            elif op == "gte":
                oq = oq.gte(field, value)
            elif op == "lt":
                oq = oq.lt(field, value)
            elif op == "lte":
                oq = oq.lte(field, value)
            elif op == "ilike":
                oq = oq.ilike(field, value)
        order_resp = oq.execute()
        order_matched_ids = set(o["customer_id"] for o in (order_resp.data or []))
        logger.info(f"[NL Filter DB] Order filter matched {len(order_matched_ids)} customer IDs")

        if not order_matched_ids:
            return []  # No orders match → no customers

    # Step 2: Query customers with customer-level filters
    q = get_db().table("customers").select("*")
    for field, op, value in customer_filters:
        if op == "eq":
            q = q.eq(field, value)
        elif op == "neq":
            q = q.neq(field, value)
        elif op == "gt":
            q = q.gt(field, value)
        elif op == "gte":
            q = q.gte(field, value)
        elif op == "lt":
            q = q.lt(field, value)
        elif op == "lte":
            q = q.lte(field, value)
        elif op == "ilike":
            q = q.ilike(field, value)

    resp = q.execute()
    customers = resp.data or []

    # Step 3: Intersect with order-matched IDs if applicable
    if order_matched_ids is not None:
        customers = [c for c in customers if c["id"] in order_matched_ids]

    # Step 4: Enrich with metrics (batch)
    cust_ids = [c["id"] for c in customers]
    all_metrics = _batch_customer_metrics(cust_ids)
    for c in customers:
        c.update(all_metrics.get(c["id"], {}))

    # Step 5: Apply computed filters
    if computed_filters:
        filtered = []
        for customer in customers:
            passes = True
            for cf in computed_filters:
                field_value = customer.get(cf["field"])
                if field_value is None:
                    passes = False
                    break

                op = cf["operator"]
                target_value = cf["value"]

                # Handle 'between' operator (e.g. date ranges)
                if op == "between" and "," in target_value:
                    start, end = target_value.split(",", 1)
                    start = start.strip()
                    end = end.strip()
                    sv = str(field_value)
                    if not (start <= sv <= end):
                        passes = False
                    continue

                # Try numeric comparison first, fall back to string comparison
                try:
                    actual_num = float(field_value)
                    target_num = float(target_value)
                    if op == "gt" and not (actual_num > target_num):
                        passes = False
                    elif op == "gte" and not (actual_num >= target_num):
                        passes = False
                    elif op == "lt" and not (actual_num < target_num):
                        passes = False
                    elif op == "lte" and not (actual_num <= target_num):
                        passes = False
                    elif op == "eq" and not (actual_num == target_num):
                        passes = False
                    elif op == "neq" and not (actual_num != target_num):
                        passes = False
                except (ValueError, TypeError):
                    # String comparison (works for ISO dates since they sort lexicographically)
                    sv = str(field_value)
                    tv = str(target_value)
                    if op == "eq" and sv != tv:
                        passes = False
                    elif op == "neq" and sv == tv:
                        passes = False
                    elif op == "gt" and not (sv > tv):
                        passes = False
                    elif op == "gte" and not (sv >= tv):
                        passes = False
                    elif op == "lt" and not (sv < tv):
                        passes = False
                    elif op == "lte" and not (sv <= tv):
                        passes = False
                    elif op == "ilike" and tv.strip("%").lower() not in sv.lower():
                        passes = False

            if passes:
                filtered.append(customer)
        customers = filtered

    logger.info(f"[NL Filter DB] Final result: {len(customers)} customers")
    return customers


# ━━━━━━━━━━━━━━━━━━━
# Orders
# ━━━━━━━━━━━━━━━━━━━

def get_orders(customer_id: str = "", limit: int = 100) -> list[dict]:
    q = get_db().table("orders").select("*, customers(name, phone), artists(name)")
    if customer_id:
        q = q.eq("customer_id", customer_id)
    resp = q.order("order_date", desc=True).limit(limit).execute()
    return resp.data or []


def get_order_by_id(order_id: str) -> dict | None:
    resp = get_db().table("orders").select(
        "*, customers(name, phone, instagram), artists(name)"
    ).eq("id", order_id).execute()
    return resp.data[0] if resp.data else None


def create_order(data: dict) -> dict:
    payload = {
        "customer_id": data["customer_id"],
        "artist_id": data.get("artist_id"),
        "order_date": data.get("order_date", date.today().isoformat()),
        "service_description": data.get("service_description"),
        "payment_mode": data.get("payment_mode"),
        "deposit": data.get("deposit", 0),
        "total": data.get("total", 0),
        "comments": data.get("comments"),
        "source": data.get("source"),
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = get_db().table("orders").insert(payload).execute()
    return resp.data[0] if resp.data else {}


# ━━━━━━━━━━━━━━━━━━━
# Expenses
# ━━━━━━━━━━━━━━━━━━━

def get_expenses(
    date_from: str = "",
    date_to: str = "",
    category: str = "",
    limit: int = 200,
) -> list[dict]:
    q = get_db().table("expenses").select("*")
    if date_from:
        q = q.gte("expense_date", date_from)
    if date_to:
        q = q.lte("expense_date", date_to)
    if category:
        q = q.eq("category", category)
    resp = q.order("expense_date", desc=True).limit(limit).execute()
    return resp.data or []


def create_expense(data: dict) -> dict:
    payload = {
        "expense_date": data.get("date", date.today().isoformat()),
        "amount": data.get("amount", 0),
        "category": data.get("category", "other"),
        "description": data.get("description"),
        "vendor": data.get("vendor"),
        "payment_mode": data.get("payment_mode"),
        "raw_input": data.get("raw_input"),
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = get_db().table("expenses").insert(payload).execute()
    return resp.data[0] if resp.data else {}


# ━━━━━━━━━━━━━━━━━━━
# Campaigns & Message Logs
# ━━━━━━━━━━━━━━━━━━━

def create_campaign(data: dict) -> dict:
    payload = {
        "template_name": data["template_name"],
        "nl_filter_text": data.get("nl_filter_text"),
        "resolved_query": data.get("resolved_query"),
        "matched_count": data.get("matched_count", 0),
        "status": data.get("status", "draft"),
    }
    resp = get_db().table("campaigns").insert(payload).execute()
    return resp.data[0] if resp.data else {}


def update_campaign_status(campaign_id: str, status: str) -> dict:
    resp = get_db().table("campaigns").update({"status": status}).eq("id", campaign_id).execute()
    return resp.data[0] if resp.data else {}


def create_message_log(data: dict) -> dict:
    resp = get_db().table("message_logs").insert(data).execute()
    return resp.data[0] if resp.data else {}


def get_campaign_messages(campaign_id: str) -> list[dict]:
    resp = get_db().table("message_logs").select("*").eq("campaign_id", campaign_id).execute()
    return resp.data or []


# ━━━━━━━━━━━━━━━━━━━
# OCR Sessions
# ━━━━━━━━━━━━━━━━━━━

def create_ocr_session(data: dict) -> dict:
    resp = get_db().table("ocr_intake_sessions").insert(data).execute()
    return resp.data[0] if resp.data else {}


def update_ocr_session(session_id: str, data: dict) -> dict:
    resp = get_db().table("ocr_intake_sessions").update(data).eq("id", session_id).execute()
    return resp.data[0] if resp.data else {}


def delete_customer(customer_id: str) -> bool:
    """Delete a customer and their associated orders."""
    try:
        # Delete associated orders first
        get_db().table("orders").delete().eq("customer_id", customer_id).execute()
        # Delete the customer
        get_db().table("customers").delete().eq("id", customer_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to delete customer {customer_id}: {e}")
        return False


# ━━━━━━━━━━━━━━━━━━━
# Financial Aggregation
# ━━━━━━━━━━━━━━━━━━━

def get_financial_summary(date_from: str = "", date_to: str = "") -> dict:
    """Get revenue, expenses, and profit for a date range."""
    # Revenue from orders
    oq = get_db().table("orders").select("total")
    if date_from:
        oq = oq.gte("order_date", date_from)
    if date_to:
        oq = oq.lte("order_date", date_to)
    orders_resp = oq.execute()
    revenue = sum(float(o.get("total", 0)) for o in (orders_resp.data or []))

    # Expenses
    eq = get_db().table("expenses").select("amount, category")
    if date_from:
        eq = eq.gte("expense_date", date_from)
    if date_to:
        eq = eq.lte("expense_date", date_to)
    expenses_resp = eq.execute()
    expenses_data = expenses_resp.data or []
    total_expenses = sum(float(e.get("amount", 0)) for e in expenses_data)

    # Category breakdown
    category_totals = {}
    for e in expenses_data:
        cat = e.get("category", "other")
        category_totals[cat] = category_totals.get(cat, 0) + float(e.get("amount", 0))

    return {
        "revenue": revenue,
        "expenses": total_expenses,
        "profit": revenue - total_expenses,
        "category_breakdown": category_totals,
        "order_count": len(orders_resp.data or []),
        "expense_count": len(expenses_data),
    }
