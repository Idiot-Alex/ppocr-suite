from typing import Any

from pydantic import BaseModel, Field


class OCRItem(BaseModel):
    text: str
    score: float | None = None
    bbox: Any = None


class OCRResponse(BaseModel):
    success: bool
    filename: str | None = None
    texts: list[str] = Field(default_factory=list)
    results: list[OCRItem] = Field(default_factory=list)
    raw: Any = None
