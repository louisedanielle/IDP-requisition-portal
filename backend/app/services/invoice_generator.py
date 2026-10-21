from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from docx import Document as DocxDocument
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from ..config import settings

class InvoiceGenerator:
    def __init__(self):
        self.output_dir = Path(settings.OUTPUT_DIR)
        self.output_dir.mkdir(exist_ok=True)

    def generate_invoice_docx(self, data: Dict[str, Any]) -> str:
        doc = DocxDocument()

        for section in doc.sections:
            section.top_margin = Cm(1.5)
            section.bottom_margin = Cm(1.5)
            section.left_margin = Cm(2)
            section.right_margin = Cm(2)

        style = doc.styles["Normal"]
        style.font.name = "Calibri"
        style.font.size = Pt(10)
        style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        style.paragraph_format.space_after = Pt(0)

        # ==========================================
        # 1. SELLER HEADER
        # ==========================================
        seller_name = data.get("company_name") or "Leapstack International Limited"
        
        # Header Line 1: Company Name + Address
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(f"{seller_name} ")
        r.bold = True
        r.font.size = Pt(11)
        r2 = p.add_run("Unit 105A, 1/F., Building 5W, Hong Kong Science Park, Shatin, N.T. H.K.")
        r2.font.size = Pt(9)

        # Header Line 2: Contact
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("Tel: +852 3628 5039  Fax: +852 3105 5299")
        r.font.size = Pt(9)

        doc.add_paragraph()

        # Title
        title = doc.add_paragraph()
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = title.add_run("I N V O I C E")
        r.bold = True
        r.font.size = Pt(16)
        title.paragraph_format.space_after = Pt(12)

        # ==========================================
        # 2. INVOICE DETAILS (Left aligned like the PDF)
        # ==========================================
        p = doc.add_paragraph()
        p.add_run("INVOICE NUMBER ").bold = True
        p.add_run(f"{data['invoice_number']}\n")
        
        p = doc.add_paragraph()
        p.add_run("DATE OF ISSUE ").bold = True
        p.add_run(f"{data['date_issued']}\n")

        doc.add_paragraph()

        # ==========================================
        # 3. BILLED TO
        # ==========================================
        p = doc.add_paragraph()
        p.add_run("BILLED TO: ").bold = True
        
        # Customer Name + Company No.
        customer_name = data.get("customer_name", "Unknown Customer")
        customer_address = data.get("customer_address", "")
        
        # Try to split the company no from the address if it exists
        p.add_run(f"{customer_name}\n")
        p.add_run(f"{customer_address}\n")

        doc.add_paragraph()

        # ==========================================
        # 4. LINE ITEMS TABLE
        # ==========================================
        headers = [
            "No.", 
            "KLINIK KITA SDN BHD (BRANCHES) & SERIAL NUMBER", 
            "INVOICE NO", 
            "MACHINE RUN TEST", 
            "Rate (RM)", 
            "AMOUNT"
        ]
        
        table = doc.add_table(rows=1, cols=len(headers))
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        # Set column widths
        widths = [Cm(1.5), Cm(6.5), Cm(3.5), Cm(2.5), Cm(2), Cm(2.5)]
        for i, width in enumerate(widths):
            table.columns[i].width = width

        # Header row
        hdr = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr[i].text = ""
            p = hdr[i].paragraphs[0]
            r = p.add_run(h)
            r.bold = True
            r.font.size = Pt(9)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Data rows
        for idx, li in enumerate(data.get("line_items", []), start=1):
            row = table.add_row().cells
            
            # No.
            row[0].text = str(idx)
            row[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            
            # Description (Branch + S/N)
            branch = li.get("description", "")
            serial = li.get("machine_serial") or ""
            desc_text = f"Revenue Sharing - {branch} Clinic"
            if serial:
                desc_text += f" (S/N : {serial})"
            row[1].text = desc_text
            
            # Invoice No
            row[2].text = li.get("invoice_no") or ""
            row[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            
            # Machine Runs + MOQ
            runs = li.get("machine_runs", 0)
            moq = li.get("moq") or "-30" # Default to -30 if not extracted
            row[3].text = f"{runs}\n(MOQ {moq})"
            row[3].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            
            # Rate
            row[4].text = f"{li.get('rate', 0):.2f}"
            row[4].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            
            # Amount
            row[5].text = f"{li.get('amount', 0):,.2f}"
            row[5].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

        # Totals (Blank rows for formatting, then total)
        for _ in range(2):
            row = table.add_row().cells
            row[0].merge(row[5])

        total_row = table.add_row().cells
        total_row[0].merge(total_row[4])
        p = total_row[0].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = p.add_run("Total")
        r.bold = True
        p = total_row[5].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = p.add_run(f"{data['total_rm']:,.2f}")
        r.bold = True

        # Optional HKD/CNY rows
        for label, amount in [
            ("HKD", data.get("total_hkd")),
            ("CNY", data.get("total_cny")),
        ]:
            if amount:
                r_row = table.add_row().cells
                r_row[0].merge(r_row[4])
                p = r_row[0].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(label)
                r.bold = True
                p = r_row[5].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(f"{amount:,.2f}")
                r.bold = True

        # ==========================================
        # 5. REMARKS
        # ==========================================
        doc.add_paragraph()
        remarks = doc.add_paragraph()
        r = remarks.add_run(data.get("notes") or "Remarks: The Machine Run Test for Revenue Sharing is based on Actual Test Volumes conducted by Machines funded by the Investor's Contribution Amount, subject to a guaranteed minimum of MOQ per month")
        r.italic = True
        r.font.size = Pt(9)

        # ==========================================
        # 6. SIGNATURE & BANK INFO
        # ==========================================
        doc.add_paragraph()
        doc.add_paragraph()

        sig = doc.add_table(rows=1, cols=2)
        sig.autofit = False
        
        left = sig.rows[0].cells[0]
        right = sig.rows[0].cells[1]
        
        # Left: Signature
        p = left.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # Add signature image logic here if you have one, else just text
        p.add_run("\n\n")
        p.add_run("Juliana\n").italic = True
        p.add_run("_________________________\n")
        p.add_run("Authorized Signature\n").font.size = Pt(8)

        # Right: Bank Info
        p = right.paragraphs[0]
        p.add_run("BANK INFORMATION:\n").bold = True
        p.add_run("Bank Name: The Hongkong and Shanghai Banking Corporation Limited\n")
        p.add_run("Bank Address: 1 Queen's Road Central, Hong Kong\n")
        p.add_run("Bank Swift Code: HSBCHKHKHHHKH\n")
        p.add_run(f"Account Name: {seller_name}\n")
        p.add_run("Account Number: 004-809-492960-838\n")
        
        for run in p.runs:
            run.font.size = Pt(8)

        # ==========================================
        # 7. PAYMENT TERMS
        # ==========================================
        doc.add_paragraph()
        terms = doc.add_paragraph()
        period = data.get("period") or ""
        ref = data.get("statement_ref") or ""
        
        terms_text = f"Payment Terms / Remarks: Monthly Revenue Sharing - {period}"
        if ref:
            terms_text += f" (Statement Ref: {ref})"
        terms_text += ". Payment due within 15 days.\n"
        terms_text += f"月度收入分成——{period}（结算单编号：{ref}）·款项须在15日内支付·"
        
        r = terms.add_run(terms_text)
        r.font.size = Pt(8)
        r.italic = True

        # Save
        filename = f"Invoice_{data['invoice_number']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        filepath = self.output_dir / filename
        doc.save(filepath)
        return str(filepath)