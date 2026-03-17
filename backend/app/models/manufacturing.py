"""
Manufacturing Tree Models
─────────────────────────
WorkCenter, Product, BOMHeader, BOMComponent, BOMOperation,
ProductionOrder, ProductionOrderLine

These extend the existing Factory → ProductionLine hierarchy with:
  Factory → ProductionLine → WorkCenter
  Product + BOM (normative) + BOM Operations (routing)
  ProductionOrder → ProductionOrderLine (multi-line support)
"""

from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, DateTime, Text,
    Boolean, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

from app.models.base import Base, TimestampMixin


# ─── Enums ────────────────────────────────────────────────────────────────────


class POStatus(str, enum.Enum):
    PLANNED = "planned"
    RELEASED = "released"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CLOSED = "closed"


# ─── Work Center ──────────────────────────────────────────────────────────────


class WorkCenter(TimestampMixin, Base):
    """
    A work center sits inside a production line.
    E.g. Line 3 → Filling Station, Capping Station, Labeling Station.
    """
    __tablename__ = "work_centers"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    machine_type = Column(String)  # e.g. "CNC", "assembly", "filling"
    capacity_units_per_hour = Column(Float)
    is_active = Column(Boolean, default=True)

    production_line = relationship("ProductionLine")


# ─── Product ──────────────────────────────────────────────────────────────────


class Product(TimestampMixin, Base):
    """Master product catalog for a factory."""
    __tablename__ = "products"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    code = Column(String, nullable=False)  # SKU or internal code
    name = Column(String, nullable=False)
    description = Column(Text)
    unit_of_measure = Column(String, default="pcs")  # pcs, kg, liters
    product_family = Column(String)  # links to VSM product_family
    labor_minutes_per_unit = Column(Float, nullable=True)  # manual labor per unit (minutes)
    is_active = Column(Boolean, default=True)

    boms = relationship("BOMHeader", back_populates="product")


# ─── Bill of Materials ────────────────────────────────────────────────────────


class BOMHeader(TimestampMixin, Base):
    """
    Normative for producing one unit of a product on a specific line.
    Holds the ideal cycle time, batch size, and component list.
    """
    __tablename__ = "bom_headers"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    version = Column(String, default="1.0")
    is_active = Column(Boolean, default=True)

    ideal_cycle_time_sec = Column(Float, nullable=False)
    batch_size = Column(Integer)  # standard batch/order quantity
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text)

    product = relationship("Product", back_populates="boms")
    components = relationship("BOMComponent", back_populates="bom", cascade="all, delete-orphan")
    operations = relationship("BOMOperation", back_populates="bom", cascade="all, delete-orphan")


class BOMComponent(TimestampMixin, Base):
    """Materials/components consumed per unit of the parent BOM."""
    __tablename__ = "bom_components"

    bom_id = Column(Integer, ForeignKey("bom_headers.id"), nullable=False)
    sequence = Column(Integer, default=0)
    material_code = Column(String)
    material_name = Column(String, nullable=False)
    quantity_per_unit = Column(Float, nullable=False)
    unit_of_measure = Column(String)
    is_critical = Column(Boolean, default=False)  # flagged for line clearance
    notes = Column(Text)

    bom = relationship("BOMHeader", back_populates="components")


class BOMOperation(TimestampMixin, Base):
    """
    Routing step within a BOM — which machine/work center processes this product,
    how long it takes per piece or per 100 pieces, and labor required.
    """
    __tablename__ = "bom_operations"

    bom_id = Column(Integer, ForeignKey("bom_headers.id"), nullable=False)
    sequence = Column(Integer, default=0)
    work_center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    operation_name = Column(String, nullable=False)
    cycle_time_seconds = Column(Float, nullable=False)
    cycle_time_basis = Column(String, default="per_piece")  # "per_piece" or "per_100"
    labor_minutes = Column(Float, nullable=True)
    notes = Column(Text)

    bom = relationship("BOMHeader", back_populates="operations")
    work_center = relationship("WorkCenter")


# ─── Production Order ────────────────────────────────────────────────────────


class ProductionOrder(TimestampMixin, Base):
    """
    A production order drives a production run.
    All production records, scrap, and QC checks link back to a PO.
    """
    __tablename__ = "production_orders"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    bom_id = Column(Integer, ForeignKey("bom_headers.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    closed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    order_number = Column(String, nullable=False, index=True)
    status = Column(String, default="planned", nullable=False)
    planned_quantity = Column(Integer, nullable=False)
    actual_quantity_good = Column(Integer, default=0)
    actual_quantity_scrap = Column(Integer, default=0)

    planned_start = Column(DateTime(timezone=True), nullable=True)
    planned_end = Column(DateTime(timezone=True), nullable=True)
    actual_start = Column(DateTime(timezone=True), nullable=True)
    actual_end = Column(DateTime(timezone=True), nullable=True)

    customer_ref = Column(String, nullable=True)  # for make-to-order
    notes = Column(Text)

    # QC hold management
    qc_hold = Column(Boolean, default=False)
    qc_hold_reason = Column(Text, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    product = relationship("Product")
    production_line = relationship("ProductionLine")
    bom = relationship("BOMHeader")
    order_lines = relationship("ProductionOrderLine", back_populates="order", cascade="all, delete-orphan")


class ProductionOrderLine(TimestampMixin, Base):
    """
    A single line allocation within a production order.
    Supports multi-line production: one order can span several production lines.
    """
    __tablename__ = "production_order_lines"

    order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    bom_id = Column(Integer, ForeignKey("bom_headers.id"), nullable=True)
    planned_quantity = Column(Integer, nullable=False)
    actual_quantity_good = Column(Integer, default=0)
    actual_quantity_scrap = Column(Integer, default=0)
    status = Column(String, default="planned")
    notes = Column(Text)

    order = relationship("ProductionOrder", back_populates="order_lines")
    production_line = relationship("ProductionLine")
    bom = relationship("BOMHeader")
