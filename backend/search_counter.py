"""
종목 검색 카운터 — 텔레그램 봇에서 검색된 종목 횟수를 추적
"""
import json
import logging
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)
COUNTER_PATH = DATA_DIR / "search_counts.json"


def _load() -> dict:
    if not COUNTER_PATH.exists():
        return {}
    try:
        return json.loads(COUNTER_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict):
    try:
        COUNTER_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error("search_counter save error: %s", e)


def increment(ticker: str):
    """종목 검색 횟수 +1"""
    data = _load()
    data[ticker] = data.get(ticker, 0) + 1
    _save(data)


def get_top(n: int = 5) -> list[dict]:
    """가장 많이 검색된 종목 반환 [{ticker, count}]"""
    data = _load()
    sorted_items = sorted(data.items(), key=lambda x: x[1], reverse=True)
    return [{"ticker": t, "count": c} for t, c in sorted_items[:n]]
