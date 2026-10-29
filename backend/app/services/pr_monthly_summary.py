"""
Generate a monthly PR Summary workbook matching the HK PRs Summary template.

Sheet 1             : PAYMENT REQUISITION SUMMARY-<D.M.YYYY>
<SHORT>_<YYYY>_PR_N : one tab per requisition (merged header table + bordered line items)
<SHORT>_<YYYY>_RP_N_Detail List : one tab per reimbursement PR (grouped by category, then date)
"""
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import func

from ..config import settings


# ---------- styles ----------
BOLD = Font(bold=True)
ITALIC = Font(italic=True)
TITLE_FONT = Font(bold=True, size=14)
HEADER_FONT = Font(bold=True, size=10)
THIN = Side(style="thin", color="000000")
MEDIUM = Side(style="medium", color="000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_BORDER = Border(left=MEDIUM, right=MEDIUM, top=MEDIUM, bottom=MEDIUM)
RIGHT = Alignment(horizontal="right", vertical="center")
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
HEADER_FILL = PatternFill("solid", fgColor="D9E1F2")

HK_MONEY_FMT = '"HK$"#,##0.00'


# ---------- helpers ----------

def _short_from_pr(pr_number: str) -> str:
    parts = (pr_number or "").split("-")
    return parts[0].upper() if parts else "LSI"


def _clean_pr_suffix(pr_number: str) -> str:
    parts = (pr_number or "").split("-")
    if len(parts) >= 4:
        return f"{parts[2]}_{parts[3]}"
    return (pr_number or "").replace("-", "_")


def _fmt_date(d, fmt="%d/%m/%Y") -> str:
    if not d:
        return ""
    if isinstance(d, str):
        try:
            d = datetime.strptime(d[:10], "%Y-%m-%d")
        except ValueError:
            return d
    return d.strftime(fmt)


def _money(cell, amount, bold=False):
    if amount in (None, 0, 0.0):
        return
    cell.value = float(amount)
    cell.number_format = HK_MONEY_FMT
    cell.alignment = RIGHT
    if bold:
        cell.font = BOLD


# Category display order used on reimbursement tabs
PREFERRED_CAT_ORDER = [
    "Transportation",
    "Drinks & Meals With Clients",
    "Entertainment",
    "Office Equipment & Supplies",
    "Sundry Expenses",
    "Hotel",
    "Travel Expenses",
    "Research and Development Expenses",
]


def _cat_key(cat: str):
    return (
        PREFERRED_CAT_ORDER.index(cat) if cat in PREFERRED_CAT_ORDER else 999,
        cat or "",
    )


# ============================================================
# SHEET 1 — SUMMARY
# ============================================================

def _build_summary_sheet(wb, title_date: datetime, requisitions: List[Any]):
    ws = wb.create_sheet(title=f"Summary-{title_date.strftime('%Y.%m.%d')}")

    ws["A1"] = f"PAYMENT REQUISITION SUMMARY-{title_date.strftime('%-d.%-m.%Y')}"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:I1")

    hk_items = []
    non_hk_items = []
    for r in requisitions:
        payee = (r.payee_name or "").strip().lower()
        if "jason" in payee or "motao" in payee or "matao" in payee:
            non_hk_items.append(r)
        else:
            hk_items.append(r)

    header_labels = ["SN.", "PR No.", "", "Paid Method",
                     "Nature", "Name of Payee:", "Amount payable:"]

    def _header_row(row, labels=header_labels):
        for i, label in enumerate(labels, start=1):
            cell = ws.cell(row=row, column=1 + i, value=label)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = CENTER
            cell.border = HEADER_BORDER

    def _write_block(items, start_row, sn_start):
        row = start_row
        sn = sn_start
        first_data = row
        for req in items:
            ws.cell(row=row, column=2, value=sn).alignment = CENTER
            ws.cell(row=row, column=3, value=req.pr_number).alignment = CENTER
            ws.cell(row=row, column=4, value=_short_from_pr(req.pr_number)).alignment = CENTER
            ws.cell(row=row, column=5, value="Bank Transfer").alignment = LEFT
            ws.cell(row=row, column=6, value=req.category_name or req.nature or "").alignment = LEFT
            ws.cell(row=row, column=7, value=req.payee_name or "").alignment = LEFT
            _money(ws.cell(row=row, column=8), req.total_amount)
            for col in range(2, 9):
                ws.cell(row=row, column=col).border = BORDER
            row += 1
            sn += 1

        last_data = row - 1
        if first_data <= last_data:
            ws.cell(row=row, column=2, value="合计").font = BOLD
            total_cell = ws.cell(
                row=row, column=8,
                value=f"=SUM(H{first_data}:H{last_data})",
            )
            total_cell.number_format = HK_MONEY_FMT
            total_cell.font = BOLD
            total_cell.alignment = RIGHT
            for col in range(2, 9):
                ws.cell(row=row, column=col).border = BORDER
            row += 1

        return row, sn, first_data, last_data

    row = 2
    _header_row(row)
    row += 1
    row, sn_next, hk_first, hk_last = _write_block(hk_items, row, sn_start=1)
    hk_total_row = hk_last + 1

    row += 1
    ws.cell(
        row=row, column=1,
        value="The following items will not be included in the Hong Kong budget.",
    ).font = ITALIC
    row += 1

    _header_row(row, labels=["SN.", "PR No.", "", "Petty Method",
                             "Nature", "Name of Payee:", "Amount payable:"])
    row += 1

    row, sn_next, nonhk_first, nonhk_last = _write_block(
        non_hk_items, row, sn_start=sn_next
    )
    nonhk_total_row = nonhk_last + 1

    row += 1
    ws.cell(row=row, column=7, value="Sub Total").font = BOLD
    ws.cell(row=row, column=7).alignment = RIGHT
    formula_parts = []
    if hk_items:
        formula_parts.append(f"H{hk_total_row}")
    if non_hk_items:
        formula_parts.append(f"H{nonhk_total_row}")
    sub_expr = "=" + "+".join(formula_parts) if formula_parts else 0
    st_cell = ws.cell(row=row, column=8, value=sub_expr)
    st_cell.number_format = HK_MONEY_FMT
    st_cell.font = BOLD
    st_cell.alignment = RIGHT

    widths = {"A": 22, "B": 6, "C": 20, "D": 8, "E": 16, "F": 42, "G": 42, "H": 16, "I": 6}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# ============================================================
# ONE SHEET PER REQUISITION
# ============================================================

def _build_requisition_sheet(wb, req, line_items: List[Any], applicant: str):
    short = _short_from_pr(req.pr_number)
    tab = f"{short}_{_clean_pr_suffix(req.pr_number)}"
    ws = wb.create_sheet(title=tab[:31])

    ws["B2"] = "PAYMENT REQUISITION"
    ws["B2"].font = TITLE_FONT
    ws["B2"].alignment = CENTER
    ws.merge_cells("B2:J2")

    header_fields = [
        ("PR No.:",         req.pr_number or ""),
        ("Applicant:",      applicant or "Juliana"),
        ("Nature:",         req.category_name or req.nature or ""),
        ("Period:",         req.period or ""),
        ("Name of Payee:",  req.payee_name or ""),
        ("Amount payable:", float(req.total_amount or 0)),
    ]

    header_start_row = 4
    for idx, (label, value) in enumerate(header_fields):
        r = header_start_row + idx
        lc = ws.cell(row=r, column=2, value=label)
        lc.font = BOLD
        lc.alignment = LEFT
        lc.border = BORDER
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)

        vc = ws.cell(row=r, column=4, value=value)
        vc.alignment = LEFT
        vc.border = BORDER
        ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=10)

        if isinstance(value, (int, float)):
            vc.number_format = HK_MONEY_FMT
            vc.alignment = RIGHT

    table_start = header_start_row + len(header_fields) + 2

    headers = ["Date", "Particular", "", "", "HK$", "", "", "Rate", "", "US$"]
    hr = table_start
    for idx, text in enumerate(headers, start=2):
        c = ws.cell(row=hr, column=idx, value=text or None)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = CENTER
        c.border = HEADER_BORDER
    ws.merge_cells(start_row=hr, start_column=3, end_row=hr, end_column=4)
    ws.merge_cells(start_row=hr, start_column=5, end_row=hr, end_column=6)
    ws.merge_cells(start_row=hr, start_column=8, end_row=hr, end_column=9)
    ws.cell(row=hr, column=3, value="Particular")
    ws.cell(row=hr, column=5, value="Expenses in HK$")
    ws.cell(row=hr, column=8, value="Exch Rate")

    r = hr + 1
    nature_lc = (req.category_name or req.nature or "").lower()
    is_reimbursement = "reimburse" in nature_lc
    data_start = r

    if is_reimbursement:
        # Aggregate by category; sort by preferred order
        groups: Dict[str, float] = {}
        for li in line_items:
            cat = (li.category or "Miscellaneous").strip() or "Miscellaneous"
            groups[cat] = groups.get(cat, 0.0) + float(li.amount_hkd or 0)
        groups = dict(sorted(groups.items(), key=lambda kv: _cat_key(kv[0])))

        period_label = (req.period or "")[:7]
        for cat, total in groups.items():
            ws.cell(row=r, column=2, value=period_label).alignment = CENTER
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
            ws.cell(row=r, column=3, value=cat).alignment = LEFT
            ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
            _money(ws.cell(row=r, column=5), total)
            ws.merge_cells(start_row=r, start_column=8, end_row=r, end_column=9)
            for col in range(2, 11):
                ws.cell(row=r, column=col).border = BORDER
            r += 1
            if r > data_start + 15:
                break
    else:
        # Non-reimbursement: line items in date order (query already sorted)
        for li in line_items:
            ws.cell(row=r, column=2, value=_fmt_date(li.date)).alignment = CENTER
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
            ws.cell(row=r, column=3, value=li.description or "").alignment = LEFT
            ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
            _money(ws.cell(row=r, column=5), float(li.amount_hkd or 0))
            ws.merge_cells(start_row=r, start_column=8, end_row=r, end_column=9)
            for col in range(2, 11):
                ws.cell(row=r, column=col).border = BORDER
            r += 1
            if r > data_start + 15:
                break

    r_total = r + 1
    ws.merge_cells(start_row=r_total, start_column=2, end_row=r_total, end_column=6)
    ws.cell(row=r_total, column=2, value="Sub Total").font = BOLD
    ws.cell(row=r_total, column=2).alignment = RIGHT
    total_cell = ws.cell(row=r_total, column=7, value=f"=SUM(E{data_start}:E{r-1})")
    total_cell.number_format = HK_MONEY_FMT
    total_cell.font = BOLD
    total_cell.alignment = RIGHT
    for col in range(2, 11):
        ws.cell(row=r_total, column=col).border = BORDER

    cr = r_total + 2
    ws.merge_cells(start_row=cr, start_column=2, end_row=cr, end_column=3)
    ws.cell(row=cr, column=2, value="Cheque No.").font = BOLD
    ws.cell(row=cr, column=2).alignment = LEFT
    ws.merge_cells(start_row=cr, start_column=4, end_row=cr, end_column=5)
    ws.cell(row=cr, column=4, value="-")

    sig_row = cr + 3
    ws.cell(row=sig_row, column=2, value="Juliana").font = ITALIC
    ws.cell(row=sig_row + 1, column=2, value="_________________________")
    ws.cell(row=sig_row + 2, column=2, value="Authorized Signature")
    ws.cell(row=sig_row + 5, column=2, value="Approved by:").font = BOLD
    ws.cell(row=sig_row + 6, column=2, value="_________________________")

    widths = {"A": 3, "B": 14, "C": 20, "D": 20, "E": 15, "F": 8,
              "G": 8, "H": 10, "I": 10, "J": 12}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# ============================================================
# DETAIL LIST (one per reimbursement)
# ============================================================

def _build_detail_sheet(wb, req, line_items: List[Any], applicant: str):
    short = _short_from_pr(req.pr_number)
    base = f"{short}_{_clean_pr_suffix(req.pr_number)}_Detail List"
    ws = wb.create_sheet(title=base[:31])

    title_name = applicant or req.payee_name or "Mr"
    ws["A1"] = f"{title_name} Reimbursement - {(req.period or '').strip()}"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:L1")

    headers = ["", "Item", "No.", "Date", "Description",
               "RMB", "HKD", "RMB", "HKD", "HKD"]
    hr = 3
    for idx, text in enumerate(headers, start=1):
        c = ws.cell(row=hr, column=idx, value=text or None)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = CENTER
        c.border = HEADER_BORDER
    ws.merge_cells(start_row=hr, start_column=8, end_row=hr, end_column=9)

    # Group by category
    groups: Dict[str, List[Any]] = {}
    for li in line_items:
        cat = (li.category or "Miscellaneous").strip() or "Miscellaneous"
        groups.setdefault(cat, []).append(li)

    # Categories in the reference order
    groups = dict(sorted(groups.items(), key=lambda kv: _cat_key(kv[0])))

    # Within each category, sort items by date ascending (nulls last)
    for cat in groups:
        groups[cat].sort(
            key=lambda li: (
                li.date is None,
                li.date or datetime.max,
                li.item_number or 0,
            )
        )

    r = hr + 1
    for cat, items in groups.items():
        cat_start = r
        for idx, li in enumerate(items):
            if idx == 0:
                ws.cell(row=r, column=2, value=cat).font = BOLD
                ws.cell(row=r, column=2).alignment = LEFT
            ws.cell(row=r, column=3, value=f"=ROW()-{hr}").alignment = CENTER
            ws.cell(row=r, column=4, value=_fmt_date(li.date)).alignment = CENTER
            ws.cell(row=r, column=5, value=li.description or "").alignment = LEFT
            _money(ws.cell(row=r, column=9), float(li.amount_hkd or 0))
            for col in range(2, 13):
                ws.cell(row=r, column=col).border = BORDER
            r += 1

        ws.cell(row=cat_start, column=12,
                value=f"=SUM(I{cat_start}:I{r-1})").number_format = HK_MONEY_FMT
        ws.cell(row=cat_start, column=12).font = BOLD
        ws.cell(row=cat_start, column=12).alignment = RIGHT

    tr = r + 1
    ws.merge_cells(start_row=tr, start_column=6, end_row=tr, end_column=8)
    ws.cell(row=tr, column=6, value="Sub Total").font = BOLD
    ws.cell(row=tr, column=6).alignment = RIGHT
    ws.cell(row=tr, column=9, value=f"=SUM(I{hr+1}:I{r-1})").number_format = HK_MONEY_FMT
    ws.cell(row=tr, column=9).font = BOLD
    ws.cell(row=tr, column=9).alignment = RIGHT
    ws.cell(row=tr, column=12, value=f"=SUM(L{hr+1}:L{r-1})").number_format = HK_MONEY_FMT
    ws.cell(row=tr, column=12).font = BOLD
    ws.cell(row=tr, column=12).alignment = RIGHT
    for col in range(2, 13):
        ws.cell(row=tr, column=col).border = BORDER

    ws.merge_cells(start_row=tr + 2, start_column=5, end_row=tr + 2, end_column=8)
    ws.cell(row=tr + 2, column=5, value="HKD sub-total").font = BOLD
    ws.cell(row=tr + 2, column=5).alignment = RIGHT
    ws.cell(row=tr + 2, column=9, value=f"=SUM(I{hr+1}:I{r-1})").number_format = HK_MONEY_FMT
    ws.cell(row=tr + 2, column=9).font = BOLD
    ws.cell(row=tr + 2, column=9).alignment = RIGHT

    ws.merge_cells(start_row=tr + 4, start_column=5, end_row=tr + 4, end_column=7)
    ws.cell(row=tr + 4, column=5, value="Total").font = BOLD
    ws.cell(row=tr + 4, column=5).alignment = RIGHT
    ws.cell(row=tr + 4, column=8,
            value=f"=H{tr+2}+I{tr+2}").number_format = HK_MONEY_FMT
    ws.cell(row=tr + 4, column=8).font = BOLD
    ws.cell(row=tr + 4, column=8).alignment = RIGHT

    widths = {"A": 3, "B": 32, "C": 6, "D": 14, "E": 60, "F": 6, "G": 6,
              "H": 10, "I": 12, "J": 10, "K": 12, "L": 14}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# ============================================================
# PUBLIC ENTRY POINT
# ============================================================

def build_monthly_pr_summary_workbook(db, year: str, month: str) -> str:
    from ..models import Requisition, LineItem

    period = f"{year}-{str(month).zfill(2)}"

    # Sort requisitions by earliest line-item date; nulls last; tie-break PR number
    rows = (
        db.query(Requisition)
        .outerjoin(LineItem, LineItem.requisition_id == Requisition.id)
        .filter(Requisition.period == period)
        .group_by(Requisition.id)
        .order_by(
            func.coalesce(func.min(LineItem.date), Requisition.created_date),
            Requisition.pr_number.asc(),
        )
        .all()
    )

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    title_date = datetime.utcnow()
    _build_summary_sheet(wb, title_date, rows)

    for req in rows:
        line_items = (
            db.query(LineItem)
            .filter(LineItem.requisition_id == req.id)
            .order_by(
                LineItem.date.is_(None),   # nulls last
                LineItem.date.asc(),
                LineItem.item_number.asc(),
            )
            .all()
        )
        _build_requisition_sheet(wb, req, line_items, req.applicant)

        nature = (req.category_name or req.nature or "").lower()
        if "reimburse" in nature:
            _build_detail_sheet(wb, req, line_items, req.applicant or req.payee_name)

    out_dir = Path(settings.OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = f"HK PRs Summary_{year}{str(month).zfill(2)}.xlsx"
    path = out_dir / fname
    wb.save(path)
    return str(path)