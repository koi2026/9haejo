"""
포트폴리오 포지션 추적 모듈
사용자별 매수가+수량 저장 및 현재 수익률 계산
"""
import json
import logging
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)
POSITIONS_PATH = DATA_DIR / "portfolio_positions.json"


def _load() -> dict:
    """{ chat_id: { ticker: { qty, cost_basis } } }"""
    if not POSITIONS_PATH.exists():
        return {}
    try:
        return json.loads(POSITIONS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict):
    POSITIONS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def add_position(chat_id: str, ticker: str, qty: float, cost_basis: float):
    """포지션 추가/업데이트"""
    data = _load()
    if chat_id not in data:
        data[chat_id] = {}
    data[chat_id][ticker] = {"qty": qty, "cost_basis": cost_basis}
    _save(data)


def remove_position(chat_id: str, ticker: str):
    data = _load()
    if chat_id in data and ticker in data[chat_id]:
        del data[chat_id][ticker]
        if not data[chat_id]:
            del data[chat_id]
        _save(data)


def get_positions(chat_id: str) -> dict:
    return _load().get(chat_id, {})
