# 🎨 PsyShot — Tattoo Studio CRM

A full-stack CRM built for tattoo studios. Manage customers, orders, artists, expenses, and WhatsApp remarketing campaigns — all from a single dashboard.

## ✨ Features

| Module | Description |
|---|---|
| **Customer Management** | Add, search, filter, and deduplicate customers (phone / Instagram) |
| **Order Tracking** | Link orders to customers & artists, track deposits and totals |
| **OCR Intake** | Upload a photo of a handwritten order form → AI extracts fields automatically |
| **WhatsApp Campaigns** | Filter customers with natural language, preview templates, and blast via Meta Cloud API |
| **Expense Tracking** | Describe an expense in plain English → AI parses amount, category, vendor, date |
| **Financial Dashboard** | Revenue vs. expenses summary with date-range filters |
| **Natural-Language Filters** | Type queries like _"customers who spent > ₹5000 this month"_ and the LLM builds the DB query |
| **Auth** | JWT-based login with admin bootstrapping |

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Database** | Supabase (PostgreSQL) |
| **AI / LLM** | Google AI Studio (Gemini) — for OCR, NL filters, expense parsing |
| **Messaging** | WhatsApp Business Cloud API (Meta Graph API) |

## 📁 Project Structure

```
psyshot/
├── backend/
│   ├── main.py              # FastAPI app & routes
│   ├── database.py          # Supabase CRUD helpers
│   ├── auth.py              # JWT authentication
│   ├── llm_provider.py      # Google AI / Gemini wrapper
│   ├── nl_filter.py         # Natural-language → SQL filter engine
│   ├── ocr_utils.py         # Image → structured order (Gemini Vision)
│   ├── expense_parser.py    # NL expense → structured fields
│   ├── prompts.py           # All LLM prompt templates
│   ├── whatsapp_utils.py    # WhatsApp Cloud API helpers
│   ├── seed.py              # Seed script (Faker-based demo data)
│   ├── schema.sql           # Supabase SQL schema (run once)
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # Reusable UI components
│   │   ├── lib/             # API client & utilities
│   │   └── types/           # TypeScript type definitions
│   ├── public/              # Static assets
│   ├── package.json
│   └── .env.example         # Frontend env template
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** & npm
- A **Supabase** project (free tier works)
- A **Google AI Studio** API key
- _(Optional)_ WhatsApp Business API credentials for campaign features

---

### 1. Clone the repository

```bash
git clone https://github.com/Vanshsfront/psy.git
cd psy
```

### 2. Set up the database

1. Go to your [Supabase dashboard](https://supabase.com/dashboard) → SQL Editor.
2. Paste and run the contents of `backend/schema.sql` to create all tables.

### 3. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your credentials (Supabase, Google AI, etc.)
```

### 4. Set up the frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local if your backend runs on a different port
```

### 5. Run the app

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

The app will be available at **http://localhost:3000**.

Default login:
- **Username:** `admin`
- **Password:** `admin123`

> ⚠️ Change `ADMIN_PASSWORD` and `JWT_SECRET` in `backend/.env` for production use.

---

### 6. (Optional) Seed demo data

```bash
cd backend
source venv/bin/activate
python seed.py
```

This populates the database with sample customers, orders, artists, and expenses using Faker.

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `GOOGLE_API_KEY` | Google AI Studio API key (Gemini) |
| `GOOGLE_OAUTH_CLIENT_ID` | _(Optional)_ Google OAuth client ID for Vertex AI fallback |
| `GOOGLE_OAUTH_CLIENT_SECRET` | _(Optional)_ OAuth client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | _(Optional)_ OAuth refresh token |
| `GCP_PROJECT_ID` | _(Optional)_ Google Cloud project ID |
| `GCP_LOCATION` | _(Optional)_ GCP region (default: `us-central1`) |
| `WHATSAPP_ACCESS_TOKEN` | _(Optional)_ Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | _(Optional)_ WhatsApp phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | _(Optional)_ WABA ID |
| `WHATSAPP_GRAPH_API_VERSION` | _(Optional)_ Graph API version (default: `v19.0`) |
| `JWT_SECRET` | Secret key for JWT signing |
| `ADMIN_USERNAME` | Default admin username |
| `ADMIN_PASSWORD` | Default admin password |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (default: `http://localhost:8000`) |

## 📝 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate & receive JWT |
| `GET` | `/api/auth/me` | Get current user |
| `GET` | `/api/customers` | List/search customers |
| `POST` | `/api/customers` | Create customer (with duplicate detection) |
| `PUT` | `/api/customers/:id` | Update customer |
| `GET` | `/api/orders` | List orders |
| `POST` | `/api/orders` | Create order |
| `POST` | `/api/ocr/extract` | Upload image → extract order fields |
| `POST` | `/api/ocr/confirm` | Confirm OCR extraction → create order |
| `POST` | `/api/campaigns/filter` | NL filter → matched customer list |
| `POST` | `/api/campaigns/send` | Send WhatsApp campaign |
| `POST` | `/api/expenses/parse` | Parse NL expense text |
| `POST` | `/api/expenses/confirm` | Confirm & save expense |
| `GET` | `/api/expenses` | List expenses |
| `GET` | `/api/finance/summary` | Revenue & expense summary |
| `GET` | `/api/artists` | List artists |
| `GET` | `/api/health` | Health check |

## 📄 License

This project is proprietary. All rights reserved.
