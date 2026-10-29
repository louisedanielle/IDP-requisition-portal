"""
Annual Report Excel generator.

Produces a single-company workbook where the reimbursement nature is broken
down into its line-item categories (Transportation, Entertainment, etc.)
instead of being lumped under a single "Reimbursement" row.
"""
from datetime import datetime
from typing import Dict, List, Tuple

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# ---- styles ----
TITLE_FONT = Font(bold=True, size=14)
COMPANY_FONT = Font(bold=True, size=12)
HEADER_FONT = Font(bold=True, size=10, color="FFFFFF")
SECTION_FONT = Font(bold=True, size=11)
ROW_FONT = Font(size=10)
TOTAL_FONT = Font(bold=True, size=11)

HEADER_FILL = PatternFill("solid", fgColor="1A4D8F")   # dark blue
SECTION_FILL = PatternFill("solid", fgColor="E8F0FB")  # light blue
TOTAL_FILL = PatternFill("solid", fgColor="D9E1F2")    # mid blue

THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

RIGHT = Alignment(horizontal="right", vertical="center")
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)

MONEY_FMT = '#,##0.00'


def _split_period(period: str | None) -> Tuple[str, str]:
    if not period or not isinstance(period, str):
        return ("—", "—")
    s = period.strip()
    if len(s) >= 7 and s[4] == "-":
        y, m = s[:4], s[5:7]
        if y.isdigit() and m.isdigit():
            return (y, m)
    if len(s) == 4 and s.isdigit():
        return (s, "—")
    return ("—", "—")


def _is_reimbursement(category_name: str | None, nature: str | None) -> bool:
    hay = f"{category_name or ''} {nature or ''}".lower()
    return "reimburse" in hay


def build_company_annual_sheet(
    wb,
    company_name: str,
    year: str,
    requisitions: List,             # list of Requisition ORM rows
    line_items_by_req: Dict[str, List],
):
    """
    Add one worksheet with:

        Category | Jan | Feb | ... | Dec | Total

    Reimbursement PRs are expanded so each line-item category
    (Transportation, Entertainment, ...) gets its own row.
    """
    sheet_name = (company_name[:28] + "..") if len(company_name) > 31 else company_name
    ws = wb.create_sheet(title=sheet_name)

    # ---------- Title block ----------
    ws.merge_cells("A1:N1")
    title = ws["A1"]
    title.value = f"{company_name}"
    title.font = COMPANY_FONT
    title.alignment = LEFT

    ws.merge_cells("A2:N2")
    subtitle = ws["A2"]
    subtitle.value = f"Annual Report {year}"
    subtitle.font = TITLE_FONT
    subtitle.alignment = LEFT

    # ---------- Build the grid ----------
    # grid[top_category][sub_category][month_index] = amount
    grid: Dict[str, Dict[str, List[float]]] = {}
    unknown_month: Dict[str, Dict[str, float]] = {}

    for req in requisitions:
        top_cat = (req.category_name or req.nature or "Uncategorized").strip()
        _, month = _split_period(req.period)

        is_reimb = _is_reimbursement(req.category_name, req.nature)

        if is_reimb:
            # Expand by line-item category
            lines = line_items_by_req.get(str(req.id), [])
            if not lines:
                # fallback: one lump sum under "Miscellaneous"
                sub_cat = "Miscellaneous"
                amount = float(req.total_amount or 0)
                if month.isdigit():
                    grid.setdefault(top_cat, {}).setdefault(sub_cat, [0.0]*12)[int(month)-1] += amount
                else:
                    unknown_month.setdefault(top_cat, {})[sub_cat] = (
                        unknown_month.get(top_cat, {}).get(sub_cat, 0) + amount
                    )
                continue

            for li in lines:
                sub_cat = (li.category or "Miscellaneous").strip() or "Miscellaneous"
                amount = float(li.amount_hkd or 0)
                if month.isdigit():
                    grid.setdefault(top_cat, {}).setdefault(sub_cat, [0.0]*12)[int(month)-1] += amount
                else:
                    unknown_month.setdefault(top_cat, {})[sub_cat] = (
                        unknown_month.get(top_cat, {}).get(sub_cat, 0) + amount
                    )
        else:
            sub_cat = top_cat  # single row
            amount = float(req.total_amount or 0)
            if month.isdigit():
                grid.setdefault(top_cat, {}).setdefault(sub_cat, [0.0]*12)[int(month)-1] += amount
            else:
                unknown_month.setdefault(top_cat, {})[sub_cat] = (
                    unknown_month.get(top_cat, {}).get(sub_cat, 0) + amount
                )

    # ---------- Header row ----------
    header_row = 4
    ws.cell(row=header_row, column=1, value="Category")
    for i, m in enumerate(MONTHS):
        ws.cell(row=header_row, column=2 + i, value=m)
    total_col = 2 + len(MONTHS)
    ws.cell(row=header_row, column=total_col, value="Total")

    for col in range(1, total_col + 1):
        c = ws.cell(row=header_row, column=col)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = CENTER
        c.border = BORDER

    ws.row_dimensions[header_row].height = 24

    # ---------- Data rows ----------
    r = header_row + 1
    grand_monthly = [0.0] * 12

    for top_cat in sorted(grid.keys()):
        # Section header (the top-level nature, e.g. "Reimbursement", "Salary")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=total_col)
        section = ws.cell(row=r, column=1, value=f"▸ {top_cat}")
        section.font = SECTION_FONT
        section.fill = SECTION_FILL
        section.alignment = LEFT
        for col in range(1, total_col + 1):
            ws.cell(row=r, column=col).border = BORDER
            ws.cell(row=r, column=col).fill = SECTION_FILL
        r += 1

        # One row per sub-category
        for sub_cat in sorted(grid[top_cat].keys()):
            amounts = grid[top_cat][sub_cat]
            ws.cell(row=r, column=1, value=f"    {sub_cat}").alignment = LEFT
            for i, amt in enumerate(amounts):
                cell = ws.cell(row=r, column=2 + i,
                               value=round(amt, 2) if amt else None)
                if amt:
                    cell.number_format = MONEY_FMT
                cell.alignment = RIGHT
                grand_monthly[i] += amt
            row_total = ws.cell(row=r, column=total_col,
                                value=f"=SUM(B{r}:M{r})")
            row_total.number_format = MONEY_FMT
            row_total.alignment = RIGHT
            row_total.font = ROW_FONT
            for col in range(1, total_col + 1):
                ws.cell(row=r, column=col).border = BORDER
            r += 1

    # ---------- Unknown-month block ----------
    if unknown_month:
        r += 1
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=total_col)
        ws.cell(row=r, column=1, value="Items with no month").font = Font(italic=True)
        r += 1
        for top_cat, subs in sorted(unknown_month.items()):
            for sub_cat, amt in sorted(subs.items()):
                ws.cell(row=r, column=1, value=f"    {top_cat} / {sub_cat}")
                cell = ws.cell(row=r, column=total_col, value=round(amt, 2))
                cell.number_format = MONEY_FMT
                cell.alignment = RIGHT
                for col in range(1, total_col + 1):
                    ws.cell(row=r, column=col).border = BORDER
                r += 1

    # ---------- Grand total row ----------
    r += 1
    ws.cell(row=r, column=1, value="TOTAL").font = TOTAL_FONT
    for i, amt in enumerate(grand_monthly):
        cell = ws.cell(row=r, column=2 + i,
                       value=round(amt, 2) if amt else None)
        if amt:
            cell.number_format = MONEY_FMT
        cell.font = TOTAL_FONT
        cell.alignment = RIGHT
    grand = ws.cell(row=r, column=total_col,
                    value=f"=SUM(B{r}:M{r})")
    grand.number_format = MONEY_FMT
    grand.font = TOTAL_FONT
    grand.alignment = RIGHT

    for col in range(1, total_col + 1):
        ws.cell(row=r, column=col).fill = TOTAL_FILL
        ws.cell(row=r, column=col).border = BORDER

    # ---------- Column widths ----------
    ws.column_dimensions["A"].width = 38
    for i in range(2, total_col + 1):
        ws.column_dimensions[get_column_letter(i)].width = 12
    ws.column_dimensions["A"].freeze_panes = "B5"
    ws.freeze_panes = "B5"

    # ---------- Print setup ----------
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True