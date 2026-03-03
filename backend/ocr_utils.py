"""
OCR pipeline for PsyShot CRM.
Uses Gemini Vision (gemini-2.0-flash) to extract structured data from
handwritten tattoo order form images.
Supports extracting MULTIPLE orders from a single image.
"""

import os
import logging
import re

from google import genai
from google.genai import types

from prompts import OCR_FORM_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)

_ocr_client = None


def _get_ocr_client():
    """Get or create a Gemini client for OCR.
    Tries OAuth → falls back to API key (same as parchi).
    """
    global _ocr_client
    if _ocr_client is not None:
        return _ocr_client

    refresh_token = os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN")
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")

    if refresh_token and client_id and client_secret:
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request

            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                client_id=client_id,
                client_secret=client_secret,
                token_uri="https://oauth2.googleapis.com/token",
            )
            creds.refresh(Request())

            project_id = os.getenv("GCP_PROJECT_ID", "gen-lang-client-0151448461")
            location = os.getenv("GCP_LOCATION", "us-central1")

            _ocr_client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location,
                credentials=creds,
            )
            logger.info("[OCR] Using OAuth/Vertex AI client")
            return _ocr_client
        except Exception as e:
            logger.warning("[OCR] OAuth init failed, falling back to API key: %s", e)

    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise RuntimeError("No GOOGLE_API_KEY — cannot perform OCR")
    _ocr_client = genai.Client(api_key=api_key)
    logger.info("[OCR] Using API key client")
    return _ocr_client


def extract_orders_from_image(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    """
    Extract structured order data from a handwritten form image.
    Supports multiple orders in a single image.

    Returns:
        dict with keys: orders (list of {confidence, fields}),
        raw_text (the raw AI response), error (if any)
    """
    try:
        client = _get_ocr_client()

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(
                            inline_data=types.Blob(
                                data=image_bytes,
                                mime_type=mime_type,
                            )
                        ),
                        types.Part(text=OCR_FORM_EXTRACTION_PROMPT),
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=8000,
            ),
        )

        raw_text = response.text.strip() if response.text else ""
        if not raw_text:
            return {"orders": [], "raw_text": "", "error": "Empty OCR response"}

        return _parse_multi_ocr_response(raw_text)

    except Exception as e:
        logger.error(f"[OCR] Extraction failed: {e}")
        return {"orders": [], "raw_text": "", "error": str(e)}


# Keep backward-compatible single-order function
def extract_order_from_image(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    """Legacy single-order extraction. Wraps extract_orders_from_image."""
    result = extract_orders_from_image(image_bytes, mime_type)
    if result["error"]:
        return {"confidence": 0, "fields": {}, "raw_text": result["raw_text"], "error": result["error"]}
    if result["orders"]:
        first = result["orders"][0]
        return {
            "confidence": first["confidence"],
            "fields": first["fields"],
            "raw_text": result["raw_text"],
            "error": None,
        }
    return {"confidence": 0, "fields": {}, "raw_text": result["raw_text"], "error": "No orders found"}


def _parse_multi_ocr_response(raw_text: str) -> dict:
    """Parse multi-order OCR response with === ORDER N === separators."""
    # Split by order markers
    order_pattern = re.compile(r"===\s*ORDER\s+\d+\s*===", re.IGNORECASE)
    parts = order_pattern.split(raw_text)

    # If no order markers found, try parsing as a single order (backward compat)
    if len(parts) <= 1:
        single = _parse_single_order_block(raw_text)
        if single["fields"]:
            return {"orders": [single], "raw_text": raw_text, "error": None}
        return {"orders": [], "raw_text": raw_text, "error": None}

    orders = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        parsed = _parse_single_order_block(part)
        if parsed["fields"]:  # Only include if we got at least some fields
            orders.append(parsed)

    return {
        "orders": orders,
        "raw_text": raw_text,
        "error": None,
    }


FIELD_MAP = {
    "CONFIDENCE": "confidence",
    "DATE": "date",
    "ARTIST": "artist",
    "CUSTOMER_NAME": "customer_name",
    "PHONE": "phone",
    "INSTAGRAM": "instagram",
    "SERVICE": "service_description",
    "PAYMENT_MODE": "payment_mode",
    "DEPOSIT": "deposit",
    "TOTAL": "total",
    "COMMENTS": "comments",
    "SOURCE": "source",
}


def _parse_single_order_block(text: str) -> dict:
    """Parse a single order block into {confidence, fields}."""
    fields = {}
    confidence = 0

    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue

        key, _, value = line.partition(":")
        key = key.strip().upper()
        value = value.strip()

        if key in FIELD_MAP:
            mapped_key = FIELD_MAP[key]
            if mapped_key == "confidence":
                try:
                    confidence = float(re.sub(r"[^\d.]", "", value))
                except ValueError:
                    confidence = 0
            elif value.upper() == "MISSING":
                fields[mapped_key] = None
            else:
                # Convert numeric fields
                if mapped_key in ("deposit", "total"):
                    try:
                        fields[mapped_key] = float(re.sub(r"[^\d.]", "", value))
                    except ValueError:
                        fields[mapped_key] = 0
                else:
                    fields[mapped_key] = value

    return {
        "confidence": confidence,
        "fields": fields,
    }
