"""
Centralized AI prompt templates for PsyShot CRM.
All prompts are plain-text (no JSON mode) since Gemma doesn't support JSON output.
Uses structured markers for parsing.
"""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OCR — Gemini Vision (gemini-2.0-flash)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OCR_FORM_EXTRACTION_PROMPT = """You are an intelligent OCR assistant for a tattoo studio CRM. Your job is to extract structured order data from images.

The image may contain ONE or MULTIPLE customer orders. It could be:
- A register page with many entries (rows in a table/list)
- A single handwritten order note or scribble
- A casual text note, WhatsApp screenshot, or printed receipt
- A mix of languages (English, Hindi, Hinglish)
- Scattered text with no consistent layout
- Abbreviations and informal shorthand (e.g. "dep", "amt", "insta", "gpay")

Your task is to INTELLIGENTLY extract ALL orders/customers found in the image.
If a field is not present, not visible, or illegible, write MISSING.

For EACH order found, output a block in this EXACT format, separated by === ORDER N === markers:

=== ORDER 1 ===
CONFIDENCE: <number 0-100>
DATE: <date in YYYY-MM-DD format, use today's date if not specified>
ARTIST: <artist name>
CUSTOMER_NAME: <customer name>
PHONE: <phone number with country code if visible>
INSTAGRAM: <instagram handle without @>
SERVICE: <service or product description — tattoo type, piercing, etc.>
PAYMENT_MODE: <cash/card/UPI/gpay/other — normalize gpay/phonepay to UPI>
DEPOSIT: <deposit/advance amount as number, 0 if none>
TOTAL: <total amount as number>
COMMENTS: <any additional comments, notes, or special requests>
SOURCE: <how customer found the studio: instagram/walk-in/referral/google/other>
=== ORDER 2 ===
CONFIDENCE: <number 0-100>
DATE: ...
...and so on for each order found.

If there is only ONE order, still use the === ORDER 1 === header.

Important rules:
- Extract ALL orders/entries visible in the image. Do NOT stop at the first one.
- A new name + phone or new name + amount usually means a new/separate order.
- The order may be written in ANY format — do NOT expect structured fields. Parse intelligently.
- Phone numbers: include country code if visible (e.g. +91...). 10-digit Indian numbers → prepend +91.
- Amounts: numbers only, no currency symbols. Look for ₹, Rs, rs, INR prefixes/suffixes.
- Common abbreviations: "dep" = deposit, "amt"/"total" = total amount, "insta" = instagram, "gpay"/"gpe" = UPI
- If something looks like a name near a phone number, that's likely the customer name.
- If the note mentions "walk-in", "walkin", "referred by", "from insta", etc. → extract as SOURCE.
- If handwriting is unclear, make your best guess but lower the confidence score.
- Do NOT add any extra text, explanation, or commentary — ONLY the structured output."""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NL Filter → Query (Gemma-3-27b-it)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NL_FILTER_TO_QUERY_PROMPT = """You are a query translator for a tattoo studio CRM database.

The database has these CUSTOMER fields:
- name (text) — customer's full name
- phone (text)
- instagram (text)
- source (text) — values like: instagram, walk-in, referral, google
- created_at (timestamp)

COMPUTED fields (derived from orders, use "computed:" prefix):
- computed:lifetime_spend (sum of all order totals for a customer)
- computed:last_visit_date (most recent order_date, a date value in YYYY-MM-DD format)
- computed:visit_count (number of orders)

ORDER fields (for filtering by individual order data):
- order_date (date)
- service_description (text)
- payment_mode (text) — values like: cash, card, UPI
- deposit (number)
- total (number)
- artist_name (text) — the artist who did the work
- comments (text)

Today's date is {today}.

The user wants to filter customers using natural language.
User filter: "{filter_text}"

Convert this to structured filter conditions. Return EXACTLY in this format:

FIELD: <field_name>
OPERATOR: <eq/neq/gt/gte/lt/lte/like/between/in>
VALUE: <value>

Use --- to separate multiple conditions.

RULES:
1. For name searches, ALWAYS use OPERATOR: like (case-insensitive partial match).
2. For "last order today" or "last visit today", use FIELD: computed:last_visit_date with OPERATOR: eq and VALUE: {today}.
3. For "last order this week/month", use FIELD: computed:last_visit_date with OPERATOR: between and VALUE: start_date,end_date.
4. For lifetime_spend, visit_count, or last_visit_date, ALWAYS prefix the FIELD with "computed:".
5. For date ranges, use BETWEEN operator with VALUE as "start_date,end_date" in YYYY-MM-DD format.
6. For "last month" calculate the actual date range from {today}.
7. If multiple conditions exist, separate each block with --- on its own line.

EXAMPLES:

User: "all customers with name russhil"
FIELD: name
OPERATOR: like
VALUE: russhil

User: "customers with last order today"
FIELD: computed:last_visit_date
OPERATOR: eq
VALUE: {today}

User: "customers who spent more than 10000"
FIELD: computed:lifetime_spend
OPERATOR: gt
VALUE: 10000

User: "walk-in customers"
FIELD: source
OPERATOR: eq
VALUE: walk-in

User: "customers named john who visited last month" (if today is 2026-03-03)
FIELD: name
OPERATOR: like
VALUE: john
---
FIELD: computed:last_visit_date
OPERATOR: between
VALUE: 2026-02-01,2026-02-28

IMPORTANT — Inferred fields:
If the filter references a field that DOES NOT EXIST in the schema but CAN BE REASONABLY INFERRED from an existing field, output an INFER block:

INFER: <inferred_field>
FROM: <source_field>
CONDITION: <eq/neq/like> <value>
---

Examples of inferable fields:
- gender → infer from name
- age_group → infer from name

Only use INFER for fields that have a plausible mapping from an existing field.

If the filter references a field that CANNOT be inferred at all, return:
ERROR: Field "<field_name>" is not tracked in the system.
AVAILABLE_FIELDS: name, phone, instagram, source, order_date, service_description, payment_mode, deposit, total, artist_name, lifetime_spend, last_visit_date, visit_count
SUGGESTION: <suggest what the user could use instead>

Output ONLY the structured format. No extra text, no explanation."""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Expense Parsing (Gemma-3-27b-it)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXPENSE_PARSE_PROMPT = """You are an expense parser for a tattoo studio.

Parse this natural-language expense entry into structured fields.

Input: "{expense_text}"
Today's date is {today}.

Return EXACTLY in this format:

AMOUNT: <number, no currency symbols>
CATEGORY: <one of: supplies, rent, utilities, equipment, marketing, salary, maintenance, other>
DESCRIPTION: <brief description>
VENDOR: <vendor/supplier name, or UNKNOWN>
PAYMENT_MODE: <cash/card/UPI/bank_transfer/other>
DATE: <YYYY-MM-DD format, use today if "today" is mentioned>

If you cannot determine a field with reasonable confidence, use UNKNOWN for text fields or today's date for DATE.
Do NOT add any extra text or explanation."""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Field Unavailable Response Template
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIELD_UNAVAILABLE_TEMPLATE = """We do not track "{field_name}" in the system.

Available customer fields: name, phone, instagram, source
Available order fields: order_date, service_description, payment_mode, deposit, total, artist_name
Computed fields: lifetime_spend, last_visit_date, visit_count

If you want AI to infer "{field_name}" from an existing field, type:
INFER {field_name} FROM <source_field>

Example: INFER gender FROM instagram"""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Inference Prompts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENDER_INFERENCE_PROMPT = """You are a name-to-gender classifier for an Indian tattoo studio CRM.

Given a list of customer names, infer the most likely gender for each.
This is a best-guess — accuracy is NOT guaranteed.

Names:
{names_list}

Return EXACTLY one line per name in this format:
<name> | <male/female/unknown>

Rules:
- Use common Indian and international name patterns
- If the name is ambiguous or you are unsure, output "unknown"
- Do NOT add any extra text, headers, or explanation
- Maintain the exact same order as the input list"""
