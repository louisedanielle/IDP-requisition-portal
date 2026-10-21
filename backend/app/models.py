from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, JSON,
    Text, Boolean, Uuid, LargeBinary,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .database import Base


# ============ LOOKUP TABLES ============

class Company(Base):
    __tablename__ = "companies"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(200), unique=True, nullable=False)
    short_name = Column(String(20), unique=True, nullable=True)
    address = Column(String(500), nullable=True)
    phone = Column(String(100), nullable=True)
    fax = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_date = Column(DateTime, default=datetime.utcnow)

    categories = relationship("PaymentCategory", back_populates="company")


class PaymentType(Base):
    __tablename__ = "payment_types"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)

    categories = relationship("PaymentCategory", back_populates="payment_type")


class PaymentCategory(Base):
    __tablename__ = "payment_categories"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid, ForeignKey("companies.id"), nullable=False)
    payment_type_id = Column(Uuid, ForeignKey("payment_types.id"), nullable=False)
    name = Column(String(100), nullable=False)
    frequency = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)

    company = relationship("Company", back_populates="categories")
    payment_type = relationship("PaymentType", back_populates="categories")


class Payee(Base):
    __tablename__ = "payees"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(200), unique=True, nullable=False)
    payee_type = Column(String(50), default="staff")
    email = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_date = Column(DateTime, default=datetime.utcnow)


# ============ CORE TABLES ============

class Document(Base):
    __tablename__ = "documents"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_data = Column(LargeBinary, nullable=True)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="pending")
    error_message = Column(Text, nullable=True)

    extracted_data = relationship(
        "ExtractedData", back_populates="document", uselist=False
    )


class ExtractedData(Base):
    __tablename__ = "extracted_data"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid, ForeignKey("documents.id"), nullable=False)
    raw_text = Column(Text, nullable=True)
    structured_data = Column(JSON, nullable=True)
    confidence_score = Column(Float, nullable=True)
    extraction_date = Column(DateTime, default=datetime.utcnow)
    is_verified = Column(Boolean, default=False)

    document = relationship("Document", back_populates="extracted_data")


class Requisition(Base):
    __tablename__ = "requisitions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    pr_number = Column(String(80), unique=True, nullable=False)
    
    company_id = Column(Uuid, ForeignKey("companies.id"), nullable=True)
    payment_category_id = Column(Uuid, ForeignKey("payment_categories.id"), nullable=True)
    payee_id = Column(Uuid, ForeignKey("payees.id"), nullable=True)

    company_name = Column(String(200), nullable=True)
    category_name = Column(String(100), nullable=True)
    payment_type_name = Column(String(50), nullable=True)
    payee_name = Column(String(200), nullable=False)

    applicant = Column(String(100), default="Juliana")
    nature = Column(String(50), default="Payment Requisition")

    period = Column(String(20), nullable=True)
    frequency = Column(String(20), nullable=True)

    sub_group = Column(String(100), nullable=True)

    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default="HKD")
    status = Column(String(50), default="draft")

    created_date = Column(DateTime, default=datetime.utcnow)
    submitted_date = Column(DateTime, nullable=True)
    approved_date = Column(DateTime, nullable=True)

    line_items = relationship(
        "LineItem",
        back_populates="requisition",
        cascade="all, delete-orphan",
    )

class LineItem(Base):
    __tablename__ = "line_items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    requisition_id = Column(
        Uuid, ForeignKey("requisitions.id"), nullable=False
    )
    source_document_id = Column(
        Uuid, ForeignKey("documents.id"), nullable=True
    )

    item_number = Column(Integer, nullable=False)

    date = Column(DateTime, nullable=True)
    description = Column(Text, nullable=False)
    amount_hkd = Column(Float, nullable=False)

    category = Column(String(100), nullable=True)
    meta = Column(JSON, nullable=True)

    requisition = relationship("Requisition", back_populates="line_items")

class Income(Base):
    """
    Revenue Sharing Report → Invoice.
    One Income per (company, customer, period). Line items come from the
    Revenue Sharing Report's per-branch rows.
    """
    __tablename__ = "incomes"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(80), unique=True, nullable=False)
    company_id = Column(Uuid, ForeignKey("companies.id"), nullable=True)
    company_name = Column(String(200), nullable=False)

    customer_name = Column(String(200), nullable=False)   # e.g. "Medicare Solutions Sdn Bhd"
    customer_address = Column(Text, nullable=True)

    period = Column(String(20), nullable=True)            # "2026-08"
    date_issued = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)

    # Currency: RM (primary from the report), plus HKD and USD
    currency = Column(String(10), default="RM")
    total_rm = Column(Float, nullable=False, default=0.0)
    total_hkd = Column(Float, nullable=True)
    total_usd = Column(Float, nullable=True)

    status = Column(String(50), default="draft")          # draft | sent | paid
    statement_ref = Column(String(80), nullable=True)     # e.g. MSCS.2026.08.001
    notes = Column(Text, nullable=True)

    created_date = Column(DateTime, default=datetime.utcnow)
    paid_date = Column(DateTime, nullable=True)

    line_items = relationship(
        "IncomeLineItem",
        back_populates="income",
        cascade="all, delete-orphan",
    )


class IncomeLineItem(Base):
    __tablename__ = "income_line_items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    income_id = Column(Uuid, ForeignKey("incomes.id"), nullable=False)
    item_number = Column(Integer, nullable=False)

    description = Column(Text, nullable=False)
    invoice_no = Column(String(100), nullable=True)
    machine_serial = Column(String(100), nullable=True)
    machine_runs = Column(Integer, nullable=True)
    rate = Column(Float, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="RM")

    income = relationship("Income", back_populates="line_items")