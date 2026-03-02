"""
Natural-language filter engine for PsyShot CRM.
Converts user NL queries into structured filter conditions using Gemma.
Supports AI-inferred fields (e.g., gender from name) with caution warnings.
"""

import logging
import re
from datetime import date

from llm_provider import get_llm
from prompts import NL_FILTER_TO_QUERY_PROMPT, FIELD_UNAVAILABLE_TEMPLATE, GENDER_INFERENCE_PROMPT

logger = logging.getLogger(__name__)

# Map of inferable fields → inference prompt + parser
_INFERABLE_FIELDS = {"gender"}


def parse_nl_filter(filter_text: str) -> dict:
    """
    Convert a natural-language filter into structured conditions.

    Returns:
        dict with keys:
            - success (bool)
            - conditions (list of dicts with field/operator/value)
            - inferred_fields (list of dicts with infer/from/condition info)
            - inference_caution (str or None)
            - error (str if field unavailable or AI error)
            - suggestion (str if field unavailable)
            - raw_response (str)
    """
    llm = get_llm()
    if not llm:
        return {
            "success": False,
            "conditions": [],
            "inferred_fields": [],
            "inference_caution": None,
            "error": "AI provider not configured",
            "suggestion": None,
            "raw_response": "",
        }

    today = date.today().isoformat()
    prompt = NL_FILTER_TO_QUERY_PROMPT.format(filter_text=filter_text, today=today)

    try:
        raw_response = llm.generate(prompt, max_tokens=800)
        logger.info(f"[NL Filter] Raw LLM response:\n{raw_response}")
    except Exception as e:
        logger.error(f"[NL Filter] AI generation failed: {e}")
        return {
            "success": False,
            "conditions": [],
            "inferred_fields": [],
            "inference_caution": None,
            "error": f"AI error: {str(e)}",
            "suggestion": None,
            "raw_response": "",
        }

    if not raw_response or raw_response.startswith("AI error:"):
        return {
            "success": False,
            "conditions": [],
            "inferred_fields": [],
            "inference_caution": None,
            "error": raw_response or "Empty AI response",
            "suggestion": None,
            "raw_response": raw_response or "",
        }

    result = _parse_filter_response(raw_response)
    logger.info(f"[NL Filter] Parsed result: success={result['success']}, conditions={result['conditions']}, inferred={result['inferred_fields']}")
    return result


def _parse_filter_response(raw_text: str) -> dict:
    """Parse the structured filter response from Gemma, including INFER blocks."""
    raw_text = raw_text.strip()

    # Check for ERROR response (field unavailable)
    if "ERROR:" in raw_text:
        error_line = ""
        suggestion_line = ""
        for line in raw_text.split("\n"):
            line = line.strip()
            if line.startswith("ERROR:"):
                error_line = line.replace("ERROR:", "").strip()
            elif line.startswith("SUGGESTION:"):
                suggestion_line = line.replace("SUGGESTION:", "").strip()

        return {
            "success": False,
            "conditions": [],
            "inferred_fields": [],
            "inference_caution": None,
            "error": error_line,
            "suggestion": suggestion_line,
            "raw_response": raw_text,
        }

    # Parse conditions and INFER blocks separated by ---
    conditions = []
    inferred_fields = []
    blocks = raw_text.split("---")

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Check if this is an INFER block
        if "INFER:" in block:
            infer_info = {}
            for line in block.split("\n"):
                line = line.strip()
                if not line or ":" not in line:
                    continue
                key, _, value = line.partition(":")
                key = key.strip().upper()
                value = value.strip()

                if key == "INFER":
                    infer_info["field"] = value
                elif key == "FROM":
                    infer_info["source"] = value
                elif key == "CONDITION":
                    # Parse "eq male" → operator=eq, value=male
                    parts = value.split(None, 1)
                    if len(parts) == 2:
                        infer_info["operator"] = parts[0].lower()
                        infer_info["value"] = parts[1]
                    else:
                        infer_info["operator"] = "eq"
                        infer_info["value"] = value

            if infer_info.get("field") and infer_info.get("source"):
                inferred_fields.append(infer_info)
            continue

        # Normal condition block
        condition = {}
        for line in block.split("\n"):
            line = line.strip()
            if not line or ":" not in line:
                continue
            key, _, value = line.partition(":")
            key = key.strip().upper()
            value = value.strip()

            if key == "FIELD":
                condition["field"] = value
            elif key == "OPERATOR":
                condition["operator"] = value.lower()
            elif key == "VALUE":
                condition["value"] = value

        if condition.get("field") and condition.get("operator"):
            conditions.append(condition)

    # Need at least conditions OR inferred fields to succeed
    if not conditions and not inferred_fields:
        return {
            "success": False,
            "conditions": [],
            "inferred_fields": [],
            "inference_caution": None,
            "error": "Could not parse filter conditions from AI response",
            "suggestion": "Try rephrasing your filter with simpler language.",
            "raw_response": raw_text,
        }

    # Build caution message if inferred fields are present
    inference_caution = None
    if inferred_fields:
        field_names = [f["field"] for f in inferred_fields]
        source_names = [f["source"] for f in inferred_fields]
        inference_caution = (
            f"⚠️ {', '.join(field_names)} was inferred from {', '.join(source_names)} "
            f"using AI. This is a best-guess and results may be inaccurate. "
            f"Consider adding a dedicated field for more reliable filtering."
        )

    return {
        "success": True,
        "conditions": conditions,
        "inferred_fields": inferred_fields,
        "inference_caution": inference_caution,
        "error": None,
        "suggestion": None,
        "raw_response": raw_text,
    }


def run_inference(customers: list[dict], inferred_fields: list[dict]) -> list[dict]:
    """
    Apply AI inference to filter customers by inferred fields.

    For each inferred field spec, runs the appropriate inference prompt
    and filters customers based on the inferred values.

    Returns the filtered customer list with inferred values attached.
    """
    llm = get_llm()
    if not llm or not customers or not inferred_fields:
        return customers

    for infer_spec in inferred_fields:
        field = infer_spec.get("field", "").lower()
        source = infer_spec.get("source", "")
        operator = infer_spec.get("operator", "eq")
        target_value = infer_spec.get("value", "").lower()

        if field == "gender" and source == "name":
            customers = _infer_gender_from_name(
                llm, customers, operator, target_value
            )
        else:
            logger.warning(
                f"[NL Filter] Unsupported inference: {field} from {source}, skipping"
            )

    return customers


def _infer_gender_from_name(
    llm, customers: list[dict], operator: str, target_value: str
) -> list[dict]:
    """Batch-infer gender from customer names and filter."""
    if not customers:
        return []

    names = [c.get("name", "Unknown") for c in customers]
    names_list = "\n".join(f"{i+1}. {name}" for i, name in enumerate(names))

    prompt = GENDER_INFERENCE_PROMPT.format(names_list=names_list)

    try:
        raw = llm.generate(prompt, max_tokens=2000)
    except Exception as e:
        logger.error(f"[NL Filter] Gender inference failed: {e}")
        # On failure, return all customers (don't silently drop)
        for c in customers:
            c["_inferred_gender"] = "unknown"
        return customers

    # Parse response: "Name | male/female/unknown"
    inferred_genders = []
    for line in raw.strip().split("\n"):
        line = line.strip()
        if not line or "|" not in line:
            continue
        parts = line.rsplit("|", 1)
        if len(parts) == 2:
            gender = parts[1].strip().lower()
            if gender not in ("male", "female", "unknown"):
                gender = "unknown"
            inferred_genders.append(gender)

    # Attach inferred gender and filter
    result = []
    for i, customer in enumerate(customers):
        gender = inferred_genders[i] if i < len(inferred_genders) else "unknown"
        customer["_inferred_gender"] = gender

        # Apply filter condition
        if operator == "eq" and gender == target_value:
            result.append(customer)
        elif operator == "neq" and gender != target_value:
            result.append(customer)
        elif operator == "like" and target_value in gender:
            result.append(customer)
        # If operator doesn't match, skip this customer

    return result


def build_supabase_query_from_conditions(conditions: list[dict]) -> dict:
    """
    Convert parsed conditions into Supabase query parameters.

    Returns a dict describing:
        - simple_filters: list of (field, operator, value) for direct .filter() calls
        - computed_filters: list of conditions that need aggregation queries
        - needs_aggregation: bool
    """
    simple_filters = []
    computed_filters = []

    for cond in conditions:
        field = cond.get("field", "")
        op = cond.get("operator", "eq")
        value = cond.get("value", "")

        if field.startswith("computed:"):
            computed_field = field.replace("computed:", "")
            computed_filters.append({
                "field": computed_field,
                "operator": op,
                "value": value,
            })
        else:
            # Map operator to Supabase PostgREST operators
            supabase_op_map = {
                "eq": "eq",
                "neq": "neq",
                "gt": "gt",
                "gte": "gte",
                "lt": "lt",
                "lte": "lte",
                "like": "ilike",
                "in": "in_",
            }
            mapped_op = supabase_op_map.get(op, "eq")

            if op == "between" and "," in value:
                start, end = value.split(",", 1)
                simple_filters.append((field, "gte", start.strip()))
                simple_filters.append((field, "lte", end.strip()))
            elif op == "like":
                simple_filters.append((field, "ilike", f"%{value}%"))
            else:
                simple_filters.append((field, mapped_op, value))

    return {
        "simple_filters": simple_filters,
        "computed_filters": computed_filters,
        "needs_aggregation": len(computed_filters) > 0,
    }
