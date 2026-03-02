"""
Seed script for PsyShot CRM.
Generates demo data: artists, customers, orders, expenses.
"""

import os
import sys
import random
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_db, get_user_by_username, create_user
from auth import hash_password


def seed():
    print("Initializing database...")
    init_db()
    db = get_db()

    # ━━━ Admin user ━━━
    if not get_user_by_username("admin"):
        create_user("admin", hash_password(os.getenv("ADMIN_PASSWORD", "admin123")))
        print("✓ Created admin user")
    else:
        print("• Admin user already exists")

    # ━━━ Artists ━━━
    artists_data = [
        {"name": "Arjun Mehta"},
        {"name": "Priya Sharma"},
        {"name": "Vikram Singh"},
    ]
    artist_ids = []
    for a in artists_data:
        existing = db.table("artists").select("id").eq("name", a["name"]).execute()
        if existing.data:
            artist_ids.append(existing.data[0]["id"])
            print(f"• Artist '{a['name']}' already exists")
        else:
            resp = db.table("artists").insert(a).execute()
            artist_ids.append(resp.data[0]["id"])
            print(f"✓ Created artist: {a['name']}")

    # ━━━ Customers ━━━
    customers_data = [
        {"name": "Rahul Verma", "phone": "+919876543210", "instagram": "rahul.ink", "source": "instagram"},
        {"name": "Sneha Patel", "phone": "+919876543211", "instagram": "sneha_tattoos", "source": "walk-in"},
        {"name": "Aditya Kumar", "phone": "+919876543212", "instagram": "adi_art", "source": "referral"},
        {"name": "Meera Joshi", "phone": "+919876543213", "instagram": "meera.j", "source": "instagram"},
        {"name": "Karan Malhotra", "phone": "+919876543214", "instagram": "karan_m", "source": "google"},
        {"name": "Ananya Reddy", "phone": "+919876543215", "instagram": "ananya.ink", "source": "instagram"},
        {"name": "Rohan Gupta", "phone": "+919876543216", "instagram": "rohan_g", "source": "walk-in"},
        {"name": "Divya Nair", "phone": "+919876543217", "instagram": "divya.tattoo", "source": "referral"},
        {"name": "Aryan Shah", "phone": "+919876543218", "instagram": "aryan_shah", "source": "instagram"},
        {"name": "Pooja Deshmukh", "phone": "+919876543219", "instagram": "pooja_d", "source": "walk-in"},
        {"name": "Siddharth Rao", "phone": "+919876543220", "instagram": "sid_rao", "source": "google"},
        {"name": "Kavya Menon", "phone": "+919876543221", "instagram": "kavya_m", "source": "referral"},
        {"name": "Nikhil Chauhan", "phone": "+919876543222", "instagram": "nikhil_ink", "source": "instagram"},
        {"name": "Ritu Bhat", "phone": "+919876543223", "instagram": "ritu_art", "source": "walk-in"},
        {"name": "Varun Tiwari", "phone": "+919876543224", "instagram": "varun_t", "source": "instagram"},
        {"name": "Ishaan Kapoor", "phone": "+919876543225", "instagram": "ishaan_k", "source": "google"},
        {"name": "Tanvi Agarwal", "phone": "+919876543226", "instagram": "tanvi_a", "source": "referral"},
        {"name": "Manav Sinha", "phone": "+919876543227", "instagram": "manav_s", "source": "walk-in"},
        {"name": "Nisha Pillai", "phone": "+919876543228", "instagram": "nisha_tattoo", "source": "instagram"},
        {"name": "Raj Kulkarni", "phone": "+919876543229", "instagram": "raj_k", "source": "referral"},
    ]

    customer_ids = []
    for c in customers_data:
        existing = db.table("customers").select("id").eq("phone", c["phone"]).execute()
        if existing.data:
            customer_ids.append(existing.data[0]["id"])
            print(f"• Customer '{c['name']}' already exists")
        else:
            resp = db.table("customers").insert(c).execute()
            customer_ids.append(resp.data[0]["id"])
            print(f"✓ Created customer: {c['name']}")

    # ━━━ Orders ━━━
    services = [
        "Full sleeve tattoo", "Small wrist tattoo", "Back piece", "Forearm band",
        "Portrait tattoo", "Geometric design", "Watercolor tattoo", "Lettering",
        "Cover-up work", "Touch-up", "Piercing - ear", "Piercing - nose",
        "Custom design consultation", "Tribal tattoo", "Minimalist tattoo",
    ]
    payment_modes = ["cash", "UPI", "card"]
    sources = ["instagram", "walk-in", "referral", "google"]

    today = date.today()
    order_count = 0

    # Check if orders already exist
    existing_orders = db.table("orders").select("id").limit(1).execute()
    if existing_orders.data:
        print(f"• Orders already seeded")
    else:
        for i, cid in enumerate(customer_ids):
            # Each customer gets 1-4 orders
            num_orders = random.randint(1, 4)
            for j in range(num_orders):
                days_ago = random.randint(1, 365)
                order_date = (today - timedelta(days=days_ago)).isoformat()
                total = random.choice([1500, 2000, 3000, 5000, 7000, 8000, 10000, 12000, 15000, 20000, 25000])
                deposit = random.choice([0, 500, 1000, 2000, int(total * 0.3)])

                order = {
                    "customer_id": cid,
                    "artist_id": random.choice(artist_ids),
                    "order_date": order_date,
                    "service_description": random.choice(services),
                    "payment_mode": random.choice(payment_modes),
                    "deposit": deposit,
                    "total": total,
                    "comments": random.choice(["", "Repeat customer", "First timer", "Referred by friend", "Custom design"]),
                    "source": random.choice(sources),
                }
                db.table("orders").insert(order).execute()
                order_count += 1

        print(f"✓ Created {order_count} orders")

    # ━━━ Expenses ━━━
    expense_entries = [
        {"amount": 2300, "category": "supplies", "description": "Tattoo inks - black and color set", "vendor": "InkMaster Supplies", "payment_mode": "UPI"},
        {"amount": 1500, "category": "supplies", "description": "Needles - assorted pack", "vendor": "TattooGear Pro", "payment_mode": "card"},
        {"amount": 35000, "category": "rent", "description": "Studio rent - monthly", "vendor": "Landlord", "payment_mode": "bank_transfer"},
        {"amount": 4500, "category": "utilities", "description": "Electricity bill", "vendor": "MSEDCL", "payment_mode": "UPI"},
        {"amount": 2000, "category": "utilities", "description": "Internet bill", "vendor": "Airtel", "payment_mode": "UPI"},
        {"amount": 800, "category": "supplies", "description": "Gloves and disposable grips", "vendor": "MedSupply", "payment_mode": "cash"},
        {"amount": 5000, "category": "marketing", "description": "Instagram ads - monthly", "vendor": "Meta", "payment_mode": "card"},
        {"amount": 12000, "category": "equipment", "description": "New tattoo machine - rotary", "vendor": "FK Irons", "payment_mode": "card"},
        {"amount": 3000, "category": "maintenance", "description": "AC servicing", "vendor": "CoolAir Services", "payment_mode": "cash"},
        {"amount": 1200, "category": "supplies", "description": "Transfer paper and stencil supplies", "vendor": "InkMaster Supplies", "payment_mode": "UPI"},
        {"amount": 15000, "category": "salary", "description": "Assistant salary", "vendor": "Staff", "payment_mode": "bank_transfer"},
        {"amount": 2500, "category": "marketing", "description": "Business cards and flyers", "vendor": "PrintShop", "payment_mode": "cash"},
        {"amount": 900, "category": "supplies", "description": "Aftercare cream stock", "vendor": "Hustle Butter", "payment_mode": "UPI"},
        {"amount": 6000, "category": "equipment", "description": "LED ring light for studio", "vendor": "Amazon", "payment_mode": "card"},
        {"amount": 1800, "category": "maintenance", "description": "Deep cleaning service", "vendor": "CleanPro", "payment_mode": "UPI"},
    ]

    # Check if expenses already exist
    existing_expenses = db.table("expenses").select("id").limit(1).execute()
    if existing_expenses.data:
        print(f"• Expenses already seeded")
    else:
        for i, exp in enumerate(expense_entries):
            days_ago = random.randint(1, 90)
            exp["expense_date"] = (today - timedelta(days=days_ago)).isoformat()
            exp["raw_input"] = f"Spent {exp['amount']} on {exp['description'].lower()} from {exp['vendor']} paid via {exp['payment_mode']}"
            db.table("expenses").insert(exp).execute()

        print(f"✓ Created {len(expense_entries)} expenses")

    print("\n✅ Seed complete!")


if __name__ == "__main__":
    seed()
