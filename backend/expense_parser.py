"""
Natural-language expense parser for PsyShot CRM.
Uses Gemma to extract structured expense data from natural language input.
"""

import logging
import re
from datetime import date

from llm_provider import get_llm
from prompts import EXPENSE_PARSE_PROMPT

logger = logging.getLogger(__name__)


def parse_expense(expense_text: str) -> dict:
    """
    Parse a natural-language expense description into structured fields.

    Returns:
        dict with keys:
            - success (bool)
            - fields (dict with amount, category, description, vendor, payment_mode, date)
            - error (str or None)
            - raw_response (str)
    """
    llm = get_llm()
    if not llm:
        return {
            "success": False,
            "fields": {},
            "error": "AI provider not configured",
            "raw_response": "",
        }

    today = date.today().isoformat()
    prompt = EXPENSE_PARSE_PROMPT.format(expense_text=expense_text, today=today)

    try:
        raw_response = llm.generate(prompt, max_tokens=500)
    except Exception as e:
        logger.error(f"[Expense Parser] AI generation failed: {e}")
        return {
            "success": False,
            "fields": {},
            "error": f"AI error: {str(e)}",
            "raw_response": "",
        }

    if not raw_response or raw_response.startswith("AI error:"):
        return {
            "success": False,
            "fields": {},
            "error": raw_response or "Empty AI response",
            "raw_response": raw_response or "",
        }

    return _parse_expense_response(raw_response, expense_text)


def _parse_expense_response(raw_text: str, original_input: str) -> dict:
    """Parse the structured expense response from Gemma."""
    fields = {
        "amount": 0,
        "category": "other",
        "description": "",
        "vendor": "UNKNOWN",
        "payment_mode": "other",
        "date": date.today().isoformat(),
        "raw_input": original_input,
    }

    valid_categories = {
        "supplies", "rent", "utilities", "equipment",
        "marketing", "salary", "maintenance", "other"
    }

    for line in raw_text.strip().split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue

        key, _, value = line.partition(":")
        key = key.strip().upper()
        value = value.strip()

        if key == "AMOUNT":
            try:
                fields["amount"] = float(re.sub(r"[^\d.]", "", value))
            except ValueError:
                fields["amount"] = 0

        elif key == "CATEGORY":
            cat = value.lower().strip()
            fields["category"] = cat if cat in valid_categories else "other"

        elif key == "DESCRIPTION":
            fields["description"] = value

        elif key == "VENDOR":
            fields["vendor"] = value if value.upper() != "UNKNOWN" else "UNKNOWN"

        elif key == "PAYMENT_MODE":
            fields["payment_mode"] = value.lower().strip()

        elif key == "DATE":
            # Validate date format
            try:
                from datetime import datetime
                datetime.strptime(value, "%Y-%m-%d")
                fields["date"] = value
            except ValueError:
                fields["date"] = date.today().isoformat()

    # Basic validation
    if fields["amount"] <= 0:
        return {
            "success": False,
            "fields": fields,
            "error": "Could not extract a valid amount from the input",
            "raw_response": raw_text,
        }

    return {
        "success": True,
        "fields": fields,
        "error": None,
        "raw_response": raw_text,
    }
