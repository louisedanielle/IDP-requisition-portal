import base64
import json
import re
from datetime import datetime
from typing import Dict, Any, List

from mistralai import Mistral

from ..config import settings


class RevenueService:
    """
    Extracts structured data from a Revenue Sharing Report (Medicare
    Solutions Sdn Bhd format) or similar B2B invoice-style reports.
    """

    def __init__(self):
        self.client = Mistral(api_key=settings.MISTRAL_API_KEY)
        self.vision_model = settings.MISTRAL_VISION_MODEL

    async def extract_revenue_report(self, file_path: str) -> Dict[str, Any]:
        try:
            with open(file_path, "rb") as f:
                image_data = f.read()

            if file_path.lower().endswith(".pdf"):
                b64 = base64.b64encode(image_data).decode("utf-8")
                mime = "application/pdf"
            else:
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
  "customer_name": "string",
  "customer_address": "string",
  "statement_ref": "string or null",
  "period": "YYYY-MM (the collection period, e.g. 2026-08)",
  "date_issued": "YYYY-MM-DD",
  "lines": [
    {
      "branch": "string (e.g. Desa Pandan)",
      "invoice_no": "string or null",
      "machine_serial": "string or null",
      "machine_runs": number,
      "rate_rm": number,
      "amount_rm": number
    }
  ],
  "total_rm": number,
  "total_hkd": number or null,
  "total_usd": number or null,
  "total_cny": number or null
}

Rules:
- If currency is RM (Malaysian Ringgit) use "RM" in amounts.
- Include EVERY row from the "Klinik Kita Sdn Bhd" table.
- Extract the totals exactly as printed.
- Period: derive from "Collection Period" line (e.g. "2026 AUGUST" → "2026-08").
- If any field is missing, use null.
"""

        user_prompt = "Read this Revenue Sharing Report and return JSON per the schema. Return JSON only."

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
            return json.loads(content)

        except Exception as e:
            print(f"❌ Extraction error: {e}")
            return {"error": str(e), "lines": []}

    def _mime_for(self, path: str) -> str:
        ext = path.lower().split(".")[-1]
        return {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "pdf": "application/pdf",
        }.get(ext, "image/jpeg")