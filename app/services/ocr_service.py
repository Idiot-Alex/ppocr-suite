from typing import Any

from app.core.ocr_engine import get_ocr_engine
from app.schemas.ocr import OCRItem

RAW_FIELD_ALLOWLIST = {
    "rec_texts",
    "rec_scores",
    "rec_boxes",
    "dt_polys",
    "boxes",
    "scores",
    "det_boxes",
}


def _to_plain(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return value.tolist()
    if hasattr(value, "item"):
        try:
            return value.item()
        except ValueError:
            pass
    if isinstance(value, dict):
        return {str(key): _to_plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_plain(item) for item in value]
    return value


def _as_list(value: Any) -> list[Any] | None:
    plain_value = _to_plain(value)
    return plain_value if isinstance(plain_value, list) else None


def _first_present(raw_item: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in raw_item and raw_item[key] is not None:
            return raw_item[key]
    return None


def _items_from_dict(raw_item: dict[str, Any]) -> list[OCRItem]:
    rec_texts = _as_list(raw_item.get("rec_texts"))
    rec_scores = _as_list(_first_present(raw_item, ("rec_scores", "scores")))
    rec_boxes = _as_list(_first_present(raw_item, ("rec_boxes", "dt_polys", "boxes", "det_boxes")))

    if rec_texts is None:
        return []

    items: list[OCRItem] = []
    for index, text in enumerate(rec_texts):
        score = rec_scores[index] if rec_scores is not None and index < len(rec_scores) else None
        bbox = rec_boxes[index] if rec_boxes is not None and index < len(rec_boxes) else None
        items.append(OCRItem(text=str(text), score=score, bbox=_to_plain(bbox)))
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
                                        bbox=_to_plain(bbox),
                                    )
                                )
    except Exception:
        return items

    return items


def compact_raw_result(raw_result: Any) -> Any:
    plain_result = _to_plain(raw_result)

    if isinstance(plain_result, dict):
        return {key: plain_result[key] for key in RAW_FIELD_ALLOWLIST if key in plain_result}

    if isinstance(plain_result, list):
        compact_items = []
        for item in plain_result:
            if isinstance(item, dict):
                compact_items.append(
                    {key: item[key] for key in RAW_FIELD_ALLOWLIST if key in item}
                )
            elif isinstance(item, list):
                compact_items.append(item)
        return compact_items

    return None


def run_ocr(image_path: str, include_raw: bool = False) -> tuple[Any, list[str], list[OCRItem]]:
    raw = get_ocr_engine().predict(image_path)
    items = extract_items(raw)
    texts = [item.text for item in items]
    compact_raw = compact_raw_result(raw) if include_raw else None

    return compact_raw, texts, items
