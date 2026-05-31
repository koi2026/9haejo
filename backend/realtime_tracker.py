"""
실시간 종목 트래킹 모듈
사용자별로 특정 종목을 5분마다 추적해 가격/변동 알림 전송
"""
import json
import logging
from pathlib import Path
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)
TRACKER_PATH = DATA_DIR / "realtime_trackers.json"


def _load() -> dict:
    """{ chat_id: { ticker: { ticker, name, start_price, prev_price } } }"""
    if not TRACKER_PATH.exists():
        return {}
    try:
        return json.loads(TRACKER_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict):
    TRACKER_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def add_tracker(chat_id: str, ticker: str, name: str, start_price: float) -> int:
    """트래킹 추가. 현재 활성 트래커 수 반환"""
    data = _load()
    if chat_id not in data:
        data[chat_id] = {}
    data[chat_id][ticker] = {
        "ticker": ticker,
        "name": name,
        "start_price": start_price,
        "prev_price": start_price,
    }
    _save(data)
    return len(data[chat_id])


def remove_tracker(chat_id: str, ticker: str | None = None):
    """트래킹 제거. ticker=None 이면 해당 사용자 전체 제거"""
    data = _load()
    if chat_id not in data:
        return
    if ticker is None:
        del data[chat_id]
    elif ticker in data[chat_id]:
        del data[chat_id][ticker]
        if not data[chat_id]:
            del data[chat_id]
    _save(data)


def get_trackers(chat_id: str) -> dict:
    return _load().get(chat_id, {})


def get_all_trackers() -> dict:
    return _load()


def update_prev_price(chat_id: str, ticker: str, price: float):
    data = _load()
    if chat_id in data and ticker in data[chat_id]:
        data[chat_id][ticker]["prev_price"] = price
        _save(data)
