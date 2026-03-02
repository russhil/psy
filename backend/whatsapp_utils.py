"""
WhatsApp Integration for PsyShot CRM via Official WhatsApp Business Cloud API.
Uses the Meta Graph API for sending template messages.
Mirrors the parchi project's whatsapp_utils.py pattern.

Required environment variables:
  WHATSAPP_ACCESS_TOKEN       - Permanent / system-user access token
  WHATSAPP_PHONE_NUMBER_ID    - Phone-number ID registered in Meta Business
  WHATSAPP_GRAPH_API_VERSION  - Graph API version (e.g. v19.0)
"""

import os
import logging
import requests

logger = logging.getLogger(__name__)


def _get_config() -> dict | None:
    """Return WhatsApp Business API config, or None if not configured."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    waba_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "").strip()
    version = os.getenv("WHATSAPP_GRAPH_API_VERSION", "v19.0").strip()

    if not token or not phone_id:
        return None

    return {
        "token": token,
        "phone_id": phone_id,
        "waba_id": waba_id,
        "version": version,
        "base_url": f"https://graph.facebook.com/{version}",
        "messages_url": f"https://graph.facebook.com/{version}/{phone_id}/messages",
    }


def is_configured() -> bool:
    """Check if WhatsApp API is configured."""
    return _get_config() is not None


def fetch_templates() -> dict:
    """
    Fetch available WhatsApp message templates from Meta API.

    Returns:
        dict with 'success' bool and 'templates' list or 'error'
    """
    config = _get_config()
    if not config:
        return {
            "success": False,
            "templates": [],
            "error": "WhatsApp not configured",
        }

    waba_id = config.get("waba_id")
    if not waba_id:
        return {
            "success": False,
            "templates": [],
            "error": "WHATSAPP_BUSINESS_ACCOUNT_ID not set in .env — required for fetching templates",
        }

    headers = {
        "Authorization": f"Bearer {config['token']}",
    }
    url = f"{config['base_url']}/{waba_id}/message_templates"

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp_data = resp.json()

        if resp.ok:
            templates = resp_data.get("data", [])
            # Simplify template data for frontend
            simplified = []
            for t in templates:
                if t.get("status") == "APPROVED":
                    simplified.append({
                        "name": t.get("name"),
                        "language": t.get("language"),
                        "category": t.get("category"),
                        "components": t.get("components", []),
                    })
            return {"success": True, "templates": simplified, "error": None}
        else:
            error_obj = resp_data.get("error", {})
            error_msg = error_obj.get("message", resp.text)
            return {"success": False, "templates": [], "error": str(error_msg)}
    except Exception as e:
        logger.error(f"Failed to fetch WhatsApp templates: {e}")
        return {"success": False, "templates": [], "error": str(e)}


def render_template_preview(template: dict, customer: dict) -> dict:
    """
    Render a preview of what a template message would look like for a customer.

    Args:
        template: Template object from fetch_templates
        customer: Customer dict with name, phone, etc

    Returns:
        dict with 'preview_text' showing the rendered message
    """
    preview_parts = []

    for component in template.get("components", []):
        comp_type = component.get("type", "")
        if comp_type == "BODY":
            text = component.get("text", "")
            # Simple placeholder replacement
            text = text.replace("{{1}}", customer.get("name", "Customer"))
            text = text.replace("{{2}}", customer.get("phone", ""))
            text = text.replace("{{3}}", customer.get("instagram", ""))
            preview_parts.append(text)
        elif comp_type == "HEADER":
            header_text = component.get("text", "")
            if header_text:
                # Substitute variables in header too
                header_text = header_text.replace("{{1}}", customer.get("name", "Customer"))
                preview_parts.insert(0, f"**{header_text}**")
        elif comp_type == "FOOTER":
            footer_text = component.get("text", "")
            if footer_text:
                preview_parts.append(f"_{footer_text}_")

    return {
        "preview_text": "\n\n".join(preview_parts) if preview_parts else "(Template preview unavailable)",
        "customer_name": customer.get("name", ""),
        "customer_phone": customer.get("phone", ""),
    }


def send_template_message(
    phone: str,
    template_name: str,
    language_code: str = "en",
    body_parameters: list[dict] | None = None,
    header_parameters: list[dict] | None = None,
) -> dict:
    """
    Send a WhatsApp template message.

    Args:
        phone: Recipient phone in international format
        template_name: Name of the approved template
        language_code: Template language code
        body_parameters: List of parameter dicts for the template body
        header_parameters: List of parameter dicts for the template header

    Returns:
        dict with 'success' bool and 'data' or 'error'
    """
    config = _get_config()
    if not config:
        return {
            "success": False,
            "error": "WhatsApp not configured",
        }

    clean_phone = phone.replace(" ", "").replace("-", "").lstrip("+")

    headers = {
        "Authorization": f"Bearer {config['token']}",
        "Content-Type": "application/json",
    }

    components = []
    if header_parameters:
        components.append({
            "type": "header",
            "parameters": header_parameters,
        })
    if body_parameters:
        components.append({
            "type": "body",
            "parameters": body_parameters,
        })

    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": components,
        },
    }

    try:
        resp = requests.post(config["messages_url"], json=payload, headers=headers, timeout=30)
        resp_data = resp.json()

        if resp.ok:
            messages = resp_data.get("messages", [])
            msg_id = messages[0]["id"] if messages else None
            logger.info("WhatsApp template '%s' sent to %s — msgId: %s", template_name, clean_phone, msg_id)
            return {"success": True, "data": {"message_id": msg_id}}
        else:
            error_obj = resp_data.get("error", {})
            error_msg = error_obj.get("message", resp.text)
            logger.error("WhatsApp send failed for %s: %s", clean_phone, error_msg)
            return {"success": False, "error": str(error_msg)}
    except Exception as e:
        logger.error("WhatsApp send failed for %s: %s", clean_phone, e)
        return {"success": False, "error": str(e)}


def send_batch_template(
    customers: list[dict],
    template_name: str,
    language_code: str = "en",
) -> list[dict]:
    """
    Send a template message to multiple customers.
    Returns per-customer results.

    Args:
        customers: List of customer dicts (must have 'phone' and 'name')
        template_name: Name of the approved template
        language_code: Template language code

    Returns:
        List of dicts, one per customer, with send status
    """
    results = []

    for customer in customers:
        phone = customer.get("phone", "")
        name = customer.get("name", "Unknown")

        if not phone:
            results.append({
                "customer_id": customer.get("id"),
                "customer_name": name,
                "phone": phone,
                "success": False,
                "error": "No phone number",
            })
            continue

        body_params = [
            {"type": "text", "text": name},
        ]
        header_params = [
            {"type": "text", "text": name},
        ]

        result = send_template_message(
            phone=phone,
            template_name=template_name,
            language_code=language_code,
            body_parameters=body_params,
            header_parameters=header_params,
        )

        results.append({
            "customer_id": customer.get("id"),
            "customer_name": name,
            "phone": phone,
            "success": result.get("success", False),
            "message_id": result.get("data", {}).get("message_id") if result.get("success") else None,
            "error": result.get("error"),
        })

    return results
