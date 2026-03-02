"""
OCR pipeline for PsyShot CRM.
Uses Gemini Vision (gemini-2.0-flash) to extract structured data from
handwritten tattoo order form images.
Mirrors the parchi project's ocr_utils.py pattern.
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


def extract_order_from_image(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    """
    Extract structured order data from a handwritten form image.

    Returns:
        dict with keys: confidence, fields (dict of extracted values),
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
                max_output_tokens=2000,
            ),
        )

        raw_text = response.text.strip() if response.text else ""
        if not raw_text:
            return {"confidence": 0, "fields": {}, "raw_text": "", "error": "Empty OCR response"}

        return _parse_ocr_response(raw_text)

    except Exception as e:
        logger.error(f"[OCR] Extraction failed: {e}")
        return {"confidence": 0, "fields": {}, "raw_text": "", "error": str(e)}


def _parse_ocr_response(raw_text: str) -> dict:
    """Parse the structured plain-text OCR response into a dict."""
    fields = {}
    confidence = 0

    field_map = {
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

    for line in raw_text.strip().split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue

        key, _, value = line.partition(":")
        key = key.strip().upper()
        value = value.strip()

        if key in field_map:
            mapped_key = field_map[key]
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
        "raw_text": raw_text,
        "error": None,
    }
