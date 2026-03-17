"""Manufacturing service — ProductionOrder lifecycle, BOM, Product management."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.models.manufacturing import (
    WorkCenter, Product, BOMHeader, BOMComponent, BOMOperation,
    ProductionOrder, ProductionOrderLine, POStatus,
)
from app.models.production import ProductionRecord, ScrapRecord
from app.models.factory import ProductionLine


class ProductService:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, data: dict) -> Product:
        product = Product(factory_id=factory_id, **data)
        db.add(product)
        await db.commit()
        await db.refresh(product)
        return product

    @staticmethod
    async def list_all(db: AsyncSession, factory_id: int, active_only: bool = True):
        q = select(Product).where(Product.factory_id == factory_id)
        if active_only:
            q = q.where(Product.is_active == True)
        q = q.order_by(Product.name)
        result = await db.execute(q)
        return result.scalars().all()

    @staticmethod
    async def get(db: AsyncSession, product_id: int, factory_id: int):
        q = select(Product).where(Product.id == product_id, Product.factory_id == factory_id)
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(db: AsyncSession, product_id: int, factory_id: int, data: dict):
        product = await ProductService.get(db, product_id, factory_id)
        if not product:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(product, k, v)
        await db.commit()
        await db.refresh(product)
        return product


class WorkCenterService:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, data: dict) -> WorkCenter:
        wc = WorkCenter(factory_id=factory_id, **data)
        db.add(wc)
        await db.commit()
        await db.refresh(wc)
        return wc

    @staticmethod
    async def list_all(db: AsyncSession, factory_id: int, line_id: int | None = None):
        q = select(WorkCenter).where(WorkCenter.factory_id == factory_id)
        if line_id:
            q = q.where(WorkCenter.production_line_id == line_id)
        q = q.order_by(WorkCenter.name)
        result = await db.execute(q)
        return result.scalars().all()

    @staticmethod
    async def update(db: AsyncSession, wc_id: int, factory_id: int, data: dict):
        q = select(WorkCenter).where(WorkCenter.id == wc_id, WorkCenter.factory_id == factory_id)
        result = await db.execute(q)
        wc = result.scalar_one_or_none()
        if not wc:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(wc, k, v)
        await db.commit()
        await db.refresh(wc)
        return wc


class BOMService:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, data: dict) -> BOMHeader:
        components_data = data.pop("components", [])
        operations_data = data.pop("operations", [])
        bom = BOMHeader(factory_id=factory_id, **data)
        db.add(bom)
        await db.flush()

        for comp_data in components_data:
            comp = BOMComponent(bom_id=bom.id, **comp_data)
            db.add(comp)

        for op_data in operations_data:
            op = BOMOperation(bom_id=bom.id, **op_data)
            db.add(op)

        await db.commit()
        # Re-fetch with components and operations loaded
        return await BOMService.get(db, bom.id, factory_id)

    @staticmethod
    async def get(db: AsyncSession, bom_id: int, factory_id: int):
        q = (
            select(BOMHeader)
            .options(selectinload(BOMHeader.components), selectinload(BOMHeader.operations))
            .where(BOMHeader.id == bom_id, BOMHeader.factory_id == factory_id)
        )
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(db: AsyncSession, factory_id: int, product_id: int | None = None, line_id: int | None = None):
        q = (
            select(BOMHeader)
            .options(selectinload(BOMHeader.components), selectinload(BOMHeader.operations))
            .where(BOMHeader.factory_id == factory_id)
        )
        if product_id:
            q = q.where(BOMHeader.product_id == product_id)
        if line_id:
            q = q.where(BOMHeader.production_line_id == line_id)
        q = q.order_by(desc(BOMHeader.created_at))
        result = await db.execute(q)
        return result.scalars().unique().all()

    @staticmethod
    async def get_active_for_line(db: AsyncSession, factory_id: int, line_id: int):
        q = (
            select(BOMHeader)
            .options(selectinload(BOMHeader.components), selectinload(BOMHeader.operations))
            .where(
                BOMHeader.factory_id == factory_id,
                BOMHeader.production_line_id == line_id,
                BOMHeader.is_active == True,
            )
        )
        result = await db.execute(q)
        return result.scalars().unique().all()

    @staticmethod
    async def approve(db: AsyncSession, bom_id: int, factory_id: int, user_id: int):
        bom = await BOMService.get(db, bom_id, factory_id)
        if not bom:
            return None
        bom.approved_by_id = user_id
        bom.approved_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(bom)
        return bom


class ProductionOrderService:
    @staticmethod
    async def _generate_order_number(db: AsyncSession, factory_id: int) -> str:
        year = datetime.now(timezone.utc).year
        q = select(func.count(ProductionOrder.id)).where(
            ProductionOrder.factory_id == factory_id,
        )
        result = await db.execute(q)
        count = result.scalar() or 0
        return f"PO-{year}-{count + 1:04d}"

    @staticmethod
    async def create(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> ProductionOrder:
        order_lines_data = data.pop("order_lines", [])
        if not data.get("order_number"):
            data["order_number"] = await ProductionOrderService._generate_order_number(db, factory_id)
        po = ProductionOrder(
            factory_id=factory_id,
            created_by_id=user_id,
            **data,
        )
        db.add(po)
        await db.flush()

        # Create order lines (multi-line support)
        for ol_data in order_lines_data:
            ol = ProductionOrderLine(order_id=po.id, **ol_data)
            db.add(ol)

        await db.commit()
        await db.refresh(po)
        return po

    @staticmethod
    async def get(db: AsyncSession, po_id: int, factory_id: int):
        q = (
            select(ProductionOrder)
            .options(selectinload(ProductionOrder.order_lines))
            .where(ProductionOrder.id == po_id, ProductionOrder.factory_id == factory_id)
        )
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(
        db: AsyncSession, factory_id: int,
        status: str | None = None,
        line_id: int | None = None,
        product_id: int | None = None,
    ):
        q = (
            select(ProductionOrder)
            .options(selectinload(ProductionOrder.order_lines))
            .where(ProductionOrder.factory_id == factory_id)
        )
        if status:
            q = q.where(func.lower(ProductionOrder.status) == status.lower())
        if line_id:
            q = q.where(ProductionOrder.production_line_id == line_id)
        if product_id:
            q = q.where(ProductionOrder.product_id == product_id)
        q = q.order_by(desc(ProductionOrder.created_at))
        result = await db.execute(q)
        return result.scalars().unique().all()

    @staticmethod
    async def update_status(db: AsyncSession, po_id: int, factory_id: int, new_status: str, user_id: int | None = None):
        po = await ProductionOrderService.get(db, po_id, factory_id)
        if not po:
            return None
        po.status = new_status.lower() if new_status else new_status
        if new_status and new_status.lower() == "in_progress" and not po.actual_start:
            po.actual_start = datetime.now(timezone.utc)
        elif new_status and new_status.lower() in ("completed", "closed"):
            po.actual_end = datetime.now(timezone.utc)
            po.closed_at = datetime.now(timezone.utc)
            if user_id:
                po.closed_by_id = user_id
        await db.commit()
        await db.refresh(po)
        return po

    @staticmethod
    async def place_qc_hold(db: AsyncSession, po_id: int, factory_id: int, reason: str):
        po = await ProductionOrderService.get(db, po_id, factory_id)
        if not po:
            return None
        po.qc_hold = True
        po.qc_hold_reason = reason
        po.status = "on_hold"
        await db.commit()
        await db.refresh(po)
        return po

    @staticmethod
    async def release_qc_hold(db: AsyncSession, po_id: int, factory_id: int):
        po = await ProductionOrderService.get(db, po_id, factory_id)
        if not po:
            return None
        po.qc_hold = False
        po.qc_hold_reason = None
        po.status = "in_progress"
        await db.commit()
        await db.refresh(po)
        return po

    @staticmethod
    async def get_productivity_summary(db: AsyncSession, po_id: int, factory_id: int) -> dict | None:
        po = await ProductionOrderService.get(db, po_id, factory_id)
        if not po:
            return None

        # Get linked production records
        q = select(ProductionRecord).where(ProductionRecord.production_order_id == po_id)
        result = await db.execute(q)
        records = result.scalars().all()

        total_good = sum(r.good_pieces for r in records)
        total_pieces = sum(r.total_pieces for r in records)
        total_scrap = total_pieces - total_good

        # Get scrap by defect type
        sq = select(
            ScrapRecord.defect_type,
            func.sum(ScrapRecord.quantity).label("qty"),
        ).where(ScrapRecord.production_order_id == po_id).group_by(ScrapRecord.defect_type)
        scrap_result = await db.execute(sq)
        top_defects = [{"defect_type": r.defect_type, "quantity": r.qty} for r in scrap_result.all()]

        progress = (total_good / po.planned_quantity * 100) if po.planned_quantity > 0 else 0
        scrap_rate = (total_scrap / total_pieces * 100) if total_pieces > 0 else 0
        fpy = (total_good / total_pieces * 100) if total_pieces > 0 else None

        # Fetch product and line names
        pq = select(Product.name).where(Product.id == po.product_id)
        pr = await db.execute(pq)
        product_name = pr.scalar() or "Unknown"

        lq = select(ProductionLine.name).where(ProductionLine.id == po.production_line_id)
        lr = await db.execute(lq)
        line_name = lr.scalar() or "Unknown"

        return {
            "order_id": po.id,
            "order_number": po.order_number,
            "product_name": product_name,
            "line_name": line_name,
            "status": str(po.status).lower() if po.status else po.status,
            "planned_quantity": po.planned_quantity,
            "actual_quantity_good": total_good,
            "actual_quantity_scrap": total_scrap,
            "progress_pct": round(progress, 1),
            "first_pass_yield": round(fpy, 1) if fpy is not None else None,
            "scrap_rate": round(scrap_rate, 1),
            "top_defects": sorted(top_defects, key=lambda d: d["quantity"], reverse=True)[:5],
        }
