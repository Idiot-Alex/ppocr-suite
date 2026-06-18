from typing import Any

from fastapi.encoders import jsonable_encoder

from app.core.ocr_engine import get_ocr_engine
from app.schemas.ocr import OCRItem


def _to_jsonable(value: Any) -> Any:
    try:
        return jsonable_encoder(value)
    except Exception:
        if hasattr(value, "tolist"):
            return value.tolist()
        if isinstance(value, dict):
            return {str(key): _to_jsonable(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [_to_jsonable(item) for item in value]
        return str(value)


def _items_from_dict(raw_item: dict[str, Any]) -> list[OCRItem]:
    rec_texts = raw_item.get("rec_texts")
    rec_scores = raw_item.get("rec_scores") or raw_item.get("scores")
    rec_boxes = raw_item.get("rec_boxes") or raw_item.get("dt_polys") or raw_item.get("boxes")

    if not isinstance(rec_texts, list):
        return []

    items: list[OCRItem] = []
    for index, text in enumerate(rec_texts):
        score = rec_scores[index] if isinstance(rec_scores, list) and index < len(rec_scores) else None
        bbox = rec_boxes[index] if isinstance(rec_boxes, list) and index < len(rec_boxes) else None
        items.append(OCRItem(text=str(text), score=score, bbox=_to_jsonable(bbox)))
    return items


def extract_items(raw_result: Any) -> list[OCRItem]:
    items: list[OCRItem] = []

    if raw_result is None:
        return items

    try:
        if isinstance(raw_result, dict):
            items.extend(_items_from_dict(raw_result))
        elif isinstance(raw_result, list):
            for item in raw_result:
                if isinstance(item, dict):
                    items.extend(_items_from_dict(item))
                elif isinstance(item, list):
                    for sub in item:
                        if isinstance(sub, (list, tuple)) and len(sub) >= 2:
                            bbox = sub[0]
                            maybe_text = sub[1]
                            if isinstance(maybe_text, (list, tuple)) and maybe_text:
                                score = maybe_text[1] if len(maybe_text) > 1 else None
                                items.append(
                                    OCRItem(
                                        text=str(maybe_text[0]),
                                        score=score,
                                        bbox=_to_jsonable(bbox),
                                    )
                                )
    except Exception:
        return items

    return items


def run_ocr(image_path: str) -> tuple[Any, list[str], list[OCRItem]]:
    raw = get_ocr_engine().predict(image_path)
    items = extract_items(raw)
    texts = [item.text for item in items]

    return _to_jsonable(raw), texts, items
