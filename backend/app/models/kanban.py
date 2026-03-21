from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime, JSON, Boolean
from app.models.base import Base, TimestampMixin


class KanbanBoard(TimestampMixin, Base):
    """Production Kanban board for pull-system manufacturing."""
    __tablename__ = "kanban_boards"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    columns = Column(JSON, nullable=False, default=lambda: [
        "backlog", "in_queue", "in_progress", "done", "shipped"
    ])
    wip_limits = Column(JSON, nullable=False, default=lambda: {
        "backlog": 0,
        "in_queue": 5,
        "in_progress": 3,
        "done": 10,
        "shipped": 0,
    })
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class KanbanCard(TimestampMixin, Base):
    """Individual card on a Kanban board representing a production order."""
    __tablename__ = "kanban_cards"

    board_id = Column(Integer, ForeignKey("kanban_boards.id"), nullable=False, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    column_name = Column(String(50), nullable=False, default="backlog")
    position = Column(Integer, nullable=False, default=0)

    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    product_name = Column(String(200), nullable=True)
    order_number = Column(String(100), nullable=True, index=True)
    quantity = Column(Integer, nullable=True, default=0)
    priority = Column(String(20), nullable=False, default="medium")  # LOW, MEDIUM, HIGH, URGENT
    assigned_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    lead_time_hours = Column(Float, nullable=True)
    cycle_time_hours = Column(Float, nullable=True)

    status = Column(String(20), nullable=False, default="active")  # active, archived
    blocked = Column(Boolean, nullable=False, default=False)
    blocked_reason = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
