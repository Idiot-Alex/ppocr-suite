from typing import Any

from pydantic import BaseModel, Field, HttpUrl


class OCRItem(BaseModel):
    text: str
    score: float | None = None
    bbox: Any = None


class OCRResponseMeta(BaseModel):
    source: str
    elapsed_ms: float
    image_width: int | None = None
    image_height: int | None = None
    engine: str
    text_count: int


class OCRResponse(BaseModel):
    success: bool
    filename: str | None = None
    texts: list[str] = Field(default_factory=list)
    results: list[OCRItem] = Field(default_factory=list)
    raw: Any = None
    meta: OCRResponseMeta | None = None


class OCRUrlRequest(BaseModel):
    image_url: HttpUrl


class OCRBase64Request(BaseModel):
    image_base64: str
    filename: str | None = None
