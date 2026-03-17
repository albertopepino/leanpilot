from pydantic import BaseModel
from datetime import datetime


class CopilotMessageRequest(BaseModel):
    conversation_id: int | None = None
    message: str
    production_line_id: int | None = None


class CopilotMessageResponse(BaseModel):
    conversation_id: int
    response: str
    data_context: dict | None = None


class AIKaizenSuggestionResponse(BaseModel):
    id: int
    production_line_id: int | None
    suggestion_type: str
    title: str
    description: str
    expected_impact: str | None
    lean_tool: str | None
    confidence: float | None
    priority_score: float | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AIRootCauseRequest(BaseModel):
    production_line_id: int
    problem_description: str
    include_data: bool = True  # Include recent production data in analysis


class AIRootCauseResponse(BaseModel):
    five_why: dict  # Generated 5 WHY analysis
    ishikawa: dict  # Generated Ishikawa diagram data
    suggested_countermeasures: list[str]
    confidence: float
    data_used: dict | None = None
