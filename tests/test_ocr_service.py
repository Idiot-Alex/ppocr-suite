from app.services.ocr_service import compact_raw_result, extract_items


def test_extract_items_from_paddleocr_dict() -> None:
    raw = {
        "rec_texts": ["hello", "world"],
        "rec_scores": [0.98, 0.95],
        "rec_polys": [
            [[0, 0], [10, 0], [10, 10], [0, 10]],
            [[20, 0], [30, 0], [30, 10], [20, 10]],
        ],
        "rec_boxes": [[0, 0, 12, 12], [20, 0, 32, 12]],
    }

    items = extract_items(raw)

    assert [item.text for item in items] == ["hello", "world"]
    assert items[0].score == 0.98
    assert items[0].bbox == [[0, 0], [10, 0], [10, 10], [0, 10]]


def test_extract_items_falls_back_to_rec_boxes() -> None:
    raw = {
        "rec_texts": ["hello"],
        "rec_scores": [0.98],
        "rec_boxes": [[0, 0, 12, 12]],
    }

    items = extract_items(raw)

    assert items[0].bbox == [0, 0, 12, 12]


def test_extract_items_skips_empty_preferred_bbox_fields() -> None:
    raw = {
        "rec_texts": ["hello"],
        "rec_scores": [0.98],
        "rec_polys": [],
        "rec_boxes": [[0, 0, 12, 12]],
    }

    items = extract_items(raw)

    assert items[0].bbox == [0, 0, 12, 12]


def test_compact_raw_result_drops_large_image_fields() -> None:
    raw = {
        "rec_texts": ["hello"],
        "rec_scores": [0.98],
        "rec_polys": [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        "input_img": [[0] * 100],
        "page_img": [[255] * 100],
    }

    compact = compact_raw_result(raw)

    assert compact == {
        "rec_texts": ["hello"],
        "rec_scores": [0.98],
        "rec_polys": [[[0, 0], [10, 0], [10, 10], [0, 10]]],
    }
