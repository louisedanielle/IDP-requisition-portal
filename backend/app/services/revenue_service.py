import base64
import json
import re
from datetime import datetime
from typing import Dict, Any

from mistralai import Mistral

from ..config import settings


def _pdf_to_png_base64(pdf_path: str) -> str:
    """Convert the first page of a PDF to a PNG and return it as base64."""
    import fitz
    import base64 as _b64

    doc = fitz.open(pdf_path)
    if doc.page_count == 0:
        raise ValueError("PDF has no pages")

    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=200)
    png_bytes = pix.tobytes("png")
    doc.close()

    return _b64.b64encode(png_bytes).decode("utf-8")


class RevenueService:
    def __init__(self):
        self.client = Mistral(api_key=settings.MISTRAL_API_KEY)
        self.vision_model = settings.MISTRAL_VISION_MODEL

    async def extract_revenue_report(self, file_path: str) -> Dict[str, Any]:
        try:
            if file_path.lower().endswith(".pdf"):
                b64 = _pdf_to_png_base64(file_path)
                mime = "image/png"
            else:
                with open(file_path, "rb") as f:
                    image_data = f.read()
                b64 = base64.b64encode(image_data).decode("utf-8")
                mime = self._mime_for(file_path)

            return await self._extract(b64, mime)
        except Exception as e:
            print(f"❌ Revenue extraction error: {e}")
            return {"error": str(e), "lines": []}

    async def _extract(self, b64: str, mime: str) -> Dict[str, Any]:
        system_prompt = """You extract structured data from a Revenue Sharing Report or invoice.

Return ONLY valid JSON matching this schema:

{
  "customer_name": "string (e.g. MEDICARE SOLUTIONS SDN. BHD.)",
  "customer_address": "string (full address exactly as printed)",
  "statement_ref": "string or null (e.g. MSCS.2026.08.001)",
  "period": "YYYY-MM (the collection period, e.g. 2026-08)",
  "date_issued": "YYYY-MM-DD",
  "lines": [
    {
      "branch": "string (e.g. Desa Pandan)",
      "invoice_no": "string or null",
      "machine_serial": "string or null (e.g. XQ022509003216)",
      "machine_runs": number,
      "moq": string or null (e.g. -30),
      "rate_rm": number,
      "amount_rm": number
    }
  ],
  "total_rm": number,
  "total_hkd": number or null,
  "total_cny": number or null,
  "notes": "string (the exact Remarks block at the bottom)"
}

Rules:
- Include EVERY row from the "Klinik Kita Sdn Bhd" table.
- Extract the totals exactly as printed (RM, HKD, CNY).
- Period: derive from "Collection Period" line (e.g. "2026 AUGUST" → "2026-08").
- If a field is missing, use null.
"""
        user_prompt = (
            "Read this Revenue Sharing Report and return JSON per the schema. "
            "Return JSON only."
        )

        try:
            response = self.client.chat.complete(
                model=self.vision_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{b64}"},
                            },
                        ],
                    },
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            result = json.loads(content)
            
            if "period" in result and result["period"]:
                result["period"] = self._normalize_period(result["period"])
            if "date_issued" in result and result["date_issued"]:
                result["date_issued"] = self._normalize_date(result["date_issued"])

            return result

        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            return {"error": "Failed to parse JSON", "lines": []}
        except Exception as e:
            print(f"❌ Extraction error: {e}")
            return {"error": str(e), "lines": []}

    def _mime_for(self, path: str) -> str:
        ext = path.lower().split(".")[-1]
        return {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "tiff": "image/tiff", "bmp": "image/bmp",
        }.get(ext, "image/jpeg")

    def _normalize_period(self, value: str) -> str:
        if not value:
            return value
        s = str(value).strip().upper()
        months = {
            "JAN": "01", "JANUARY": "01", "FEB": "02", "FEBRUARY": "02",
            "MAR": "03", "MARCH": "03", "APR": "04", "APRIL": "04",
            "MAY": "05", "JUN": "06", "JUNE": "06", "JUL": "07", "JULY": "07",
            "AUG": "08", "AUGUST": "08", "SEP": "09", "SEPTEMBER": "09",
            "OCT": "10", "OCTOBER": "10", "NOV": "11", "NOVEMBER": "11",
            "DEC": "12", "DECEMBER": "12",
        }
        match = re.search(r"(\d{4})\s+([A-Z]+)", s)
        if match:
            year, month_name = match.groups()
            if month_name in months:
                return f"{year}-{months[month_name]}"
        match = re.search(r"(\d{4})[-/.](\d{1,2})", s)
        if match:
            year, month = match.groups()
            return f"{year}-{int(month):02d}"
        return value

    def _normalize_date(self, value: str) -> str:
        if not value:
            return value
        s = str(value).strip()
        for fmt in ("%d-%b-%Y", "%d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return s