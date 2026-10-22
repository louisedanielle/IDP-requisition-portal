"""
Generate a monthly PR Summary workbook that mirrors the "HK PRs Summary" template:

  Sheet 1             : PAYMENT REQUISITION SUMMARY-<DD.M.YYYY>
  <SHORT>_<YEAR>_PR_N : one tab per requisition
  <SHORT>_<YEAR>_RP_N_Detail List : detail-list tabs for reimbursements
"""
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

from ..config import settings


# ---------- styles ----------
BOLD = Font(bold=True)
ITALIC = Font(italic=True)
HEADER_FILL = PatternFill("solid", fgColor="D9E1F2")
TITLE_FONT = Font(bold=True, size=14)

THIN = Side(style="thin", color="999999")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

RIGHT = Alignment(horizontal="right", vertical="center")
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)


def _short_from_pr(pr_number: str) -> str:
    """LSHK-PR-2026-041 → 'LSHK'; LSI-PR-2026-113 → 'LSI'."""
    parts = (pr_number or "").split("-")
    return parts[0].upper() if parts else "LSI"


def _clean_pr_suffix(pr_number: str) -> str:
    """LSHK-PR-2026-041 → '2026_PR_041' (used for the tab name)."""
    parts = (pr_number or "").split("-")
    if len(parts) >= 4:
        return f"{parts[2]}_{parts[3]}"
    # fallback
    return (pr_number or "").replace("-", "_")


# ============================================================
# SHEET 1 — SUMMARY
# ============================================================

def _build_summary_sheet(wb, title_date: datetime, requisitions: List[Any]):
    ws = wb.create_sheet(title=f"Summary-{title_date.strftime('%Y.%m.%d')}")

    ws["A1"] = f"PAYMENT REQUISITION SUMMARY-{title_date.strftime('%-d.%-m.%Y')}"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:I1")

    row = 2
    ws.cell(row=row, column=2, value="SN.").font = BOLD
    ws.cell(row=row, column=3, value="PR No.").font = BOLD
    ws.cell(row=row, column=5, value="Paid Method").font = BOLD
    ws.cell(row=row, column=6, value="Nature").font = BOLD
    ws.cell(row=row, column=7, value="Name of Payee:").font = BOLD
    ws.cell(row=row, column=8, value="Amount payable:").font = BOLD

    # --- split into HK budget vs not-included ---
    hk_items = []
    non_hk_items = []
    for r in requisitions:
        payee = (r.payee_name or "").strip().lower()
        if "jason" in payee or "motao" in payee or "matao" in payee:
            non_hk_items.append(r)
        else:
            hk_items.append(r)

    def _write_rows(items, start_row, sn_start=1, show_total=True):
        r = start_row
        sn = sn_start
        first_data_row = r
        for req in items:
            ws.cell(row=r, column=2, value=sn)
            ws.cell(row=r, column=3, value=req.pr_number)
            ws.cell(row=r, column=4, value=_short_from_pr(req.pr_number))
            ws.cell(row=r, column=5, value="Bank Transfer")
            ws.cell(row=r, column=6, value=req.category_name or req.nature or "")
            ws.cell(row=r, column=7, value=req.payee_name or "")
            ws.cell(row=r, column=8, value=float(req.total_amount or 0)).number_format = "#,##0.00"
            ws.cell(row=r, column=6).alignment = LEFT
            ws.cell(row=r, column=7).alignment = LEFT
            ws.cell(row=r, column=8).alignment = RIGHT
            r += 1
            sn += 1
        last_data_row = r - 1
        if show_total and first_data_row <= last_data_row:
            ws.cell(row=r, column=2, value="合计").font = BOLD
            ws.cell(row=r, column=8, value=f"=SUM(H{first_data_row}:H{last_data_row})").font = BOLD
            ws.cell(row=r, column=8).number_format = "#,##0.00"
            r += 1
        return r, sn, first_data_row, last_data_row

    # HK block
    row = 3
    row, sn_next, hk_first, hk_last = _write_rows(hk_items, row, sn_start=1)

    # Separator
    row += 1
    ws.cell(
        row=row,
        column=1,
        value="The following items will not be included in the Hong Kong budget.",
    ).font = ITALIC
    row += 1

    # Header again
    ws.cell(row=row, column=2, value="SN.").font = BOLD
    ws.cell(row=row, column=3, value="PR No.").font = BOLD
    ws.cell(row=row, column=5, value="Petty Method").font = BOLD
    ws.cell(row=row, column=6, value="Nature").font = BOLD
    ws.cell(row=row, column=7, value="Name of Payee:").font = BOLD
    ws.cell(row=row, column=8, value="Amount payable:").font = BOLD
    row += 1

    row, sn_next, non_hk_first, non_hk_last = _write_rows(
        non_hk_items, row, sn_start=sn_next
    )

    # Sub-total
    row += 1
    ws.cell(row=row, column=7, value="Sub Total").font = BOLD
    ws.cell(
        row=row,
        column=8,
        value=f"=H{hk_first + len(hk_items) if False else hk_last}+H{non_hk_last}"
        if hk_items and non_hk_items
        else f"=H{hk_last if hk_items else non_hk_last}",
    )

    # Safer: recompute subtotal using explicit SUM ranges
    total_row = row
    formula_parts = []
    if hk_items:
        total_row_hk = hk_last + 1  # the "合计" row
        formula_parts.append(f"H{total_row_hk}")
    if non_hk_items:
        # find the non-hk 合计 row
        # we know it's just after non_hk_last + 1
        formula_parts.append(f"H{non_hk_last + 1}")

    ws.cell(row=total_row, column=8, value="=" + "+".join(formula_parts) if formula_parts else 0)
    ws.cell(row=total_row, column=8).font = BOLD
    ws.cell(row=total_row, column=8).number_format = "#,##0.00"

    # Column widths
    widths = {"A": 22, "B": 6, "C": 20, "D": 8, "E": 16, "F": 42, "G": 42, "H": 16, "I": 6}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# ============================================================
# SHEET 2..N — ONE PER REQUISITION
# ============================================================

def _build_requisition_sheet(wb, req, line_items: List[Any], applicant: str, company_name: str):
    short = _short_from_pr(req.pr_number)
    tab = f"{short}_{_clean_pr_suffix(req.pr_number)}"
    ws = wb.create_sheet(title=tab[:31])

    ws["B3"] = "PAYMENT REQUISITION"
    ws["B3"].font = TITLE_FONT
    ws.merge_cells("B3:J3")

    ws["B5"] = "PR No.:"
    ws["B5"].font = BOLD
    ws["D5"] = req.pr_number

    ws["B6"] = "Applicant:"
    ws["B6"].font = BOLD
    ws["D6"] = applicant or "Juliana"

    ws["B7"] = "Nature:"
    ws["B7"].font = BOLD
    ws["D7"] = req.category_name or req.nature or ""

    ws["B10"] = "Name of Payee:"
    ws["B10"].font = BOLD
    ws["D10"] = req.payee_name or ""

    ws["B11"] = "Amount payable:"
    ws["B11"].font = BOLD
    ws["D11"] = float(req.total_amount or 0)
    ws["D11"].number_format = "#,##0.00"

    # Table header (matches template)
    ws["E14"] = "Expenses in"
    ws["G14"] = "Exch"
    ws["B15"] = "Date"
    ws["D15"] = "Particular"
    ws["F15"] = "HK$"
    ws["H15"] = "Rate"
    ws["J15"] = "US$"
    for cell in ["B15", "D15", "F15", "H15", "J15"]:
        ws[cell].font = BOLD

    # Line items
    r = 16
    for li in line_items:
        d = li.date.strftime("%Y-%m-%d 00:00:00") if li.date else ""
        ws.cell(row=r, column=2, value=d)
        ws.cell(row=r, column=4, value=li.description or "")
        ws.cell(row=r, column=6, value=float(li.amount_hkd or 0)).number_format = "#,##0.00"
        r += 1
        if r > 23:
            break

    # Sum row (matches =SUM(F14:F21) style)
    ws.cell(row=24, column=6, value=f"=SUM(F16:F23)").font = BOLD
    ws.cell(row=24, column=6).number_format = "#,##0.00"

    ws["D26"] = "Cheque No."
    ws["D26"].font = BOLD
    ws["F26"] = "-"

    ws["B30"] = "Juliana"
    ws["B31"] = "=D6"

    ws["B35"] = "Approved by:"
    ws["B35"].font = BOLD

    widths = {"A": 3, "B": 14, "C": 6, "D": 40, "E": 8, "F": 14, "G": 8, "H": 10, "I": 4, "J": 12}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# ============================================================
# DETAIL LIST SHEET — reimbursement breakdown
# ============================================================

def _build_detail_sheet(wb, req, line_items: List[Any], applicant: str):
    short = _short_from_pr(req.pr_number)
    base = f"{short}_{_clean_pr_suffix(req.pr_number)}_Detail List"
    ws = wb.create_sheet(title=base[:31])

    header_title = f"{applicant or 'Mr'} Reimbursement - {(req.period or '').strip()}"
    ws["A1"] = header_title
    ws["A1"].font = TITLE_FONT

    ws["B3"] = "Item"
    ws["C3"] = "No."
    ws["D3"] = "Date"
    ws["E3"] = "Description"
    ws["H3"] = "RMB"
    ws["I3"] = "HKD"
    ws["J3"] = "RMB"
    ws["K3"] = "HKD"
    ws["L3"] = "HKD"
    for cell in ["B3","C3","D3","E3","H3","I3","J3","K3","L3"]:
        ws[cell].font = BOLD

    # Group line items by category
    groups: Dict[str, List[Any]] = {}
    for li in line_items:
        cat = (li.category or "Miscellaneous").strip() or "Miscellaneous"
        groups.setdefault(cat, []).append(li)

    r = 4
    cat_start_rows = {}
    for cat, items in groups.items():
        cat_start_rows[cat] = r
        for idx, li in enumerate(items):
            if idx == 0:
                ws.cell(row=r, column=2, value=cat).font = BOLD
            ws.cell(row=r, column=3, value=f"=ROW()-3")
            if li.date:
                ws.cell(row=r, column=4, value=li.date)
                ws.cell(row=r, column=4).number_format = "yyyy-mm-dd hh:mm:ss"
            ws.cell(row=r, column=5, value=li.description or "")
            ws.cell(row=r, column=5).alignment = LEFT
            ws.cell(row=r, column=9, value=float(li.amount_hkd or 0)).number_format = "#,##0.00"
            r += 1

    # Totals
    total_row = r + 1
    ws.cell(row=total_row, column=9, value=f"=SUM(I4:I{r-1})").font = BOLD
    ws.cell(row=total_row, column=9).number_format = "#,##0.00"

    # Sub-total row
    ws.cell(row=total_row + 2, column=5, value="HKD sub-total").font = BOLD
    ws.cell(row=total_row + 2, column=9, value=f"=SUM(I4:I{r-1})").font = BOLD
    ws.cell(row=total_row + 2, column=9).number_format = "#,##0.00"

    # Grand total
    ws.cell(row=total_row + 4, column=5, value="Total").font = BOLD
    ws.cell(row=total_row + 4, column=8, value=f"=H{total_row+2}+I{total_row+2}").font = BOLD
    ws.cell(row=total_row + 4, column=8).number_format = "#,##0.00"

    widths = {"A": 3, "B": 32, "C": 6, "D": 20, "E": 60, "F": 3, "G": 3, "H": 10, "I": 10, "J": 10, "K": 10, "L": 10, "M": 4}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# ============================================================
# PUBLIC ENTRY POINT
# ============================================================

def build_monthly_pr_summary_workbook(db, year: str, month: str) -> str:
    """
    `db` is an SQLAlchemy Session. Returns the path to the generated .xlsx.
    """
    from ..models import Requisition, LineItem  # avoid circular import

    period = f"{year}-{month:0>2}"
    rows = (
        db.query(Requisition)
        .filter(Requisition.period == period)
        .order_by(Requisition.pr_number.asc())
        .all()
    )

    wb = openpyxl.Workbook()
    # remove default sheet later; we build our own
    wb.remove(wb.active)

    title_date = datetime.utcnow()
    _build_summary_sheet(wb, title_date, rows)

    for req in rows:
        line_items = (
            db.query(LineItem)
            .filter(LineItem.requisition_id == req.id)
            .order_by(LineItem.item_number)
            .all()
        )
        _build_requisition_sheet(wb, req, line_items, req.applicant, req.company_name)

        # Only emit a Detail List tab for reimbursements
        nature = (req.category_name or req.nature or "").lower()
        if "reimburse" in nature or "reimbursment" in nature:
            _build_detail_sheet(wb, req, line_items, req.applicant or req.payee_name)

    out_dir = Path(settings.OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = f"HK PRs Summary_{year}{month:0>2}{title_date.strftime('%d')}.xlsx"
    path = out_dir / fname
    wb.save(path)
    return str(path)