"""
구독자 관리 모듈
subscribers.json에 Chat ID 저장/조회/삭제
"""

import os
import json
import logging
from pathlib import Path
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)

DB_PATH = DATA_DIR / "subscribers.json"


def _load() -> list[str]:
    if not DB_PATH.exists():
        return []
    try:
        return json.loads(DB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save(ids: list[str]):
    DB_PATH.write_text(json.dumps(list(set(ids)), indent=2, ensure_ascii=False), encoding="utf-8")


def subscribe(chat_id: str) -> bool:
    """구독 추가. 이미 있으면 False."""
    ids = _load()
    if chat_id in ids:
        return False
    ids.append(chat_id)
    _save(ids)
    logger.info("Subscribed: %s (total: %d)", chat_id, len(ids))
    return True


def unsubscribe(chat_id: str) -> bool:
    """구독 취소. 없으면 False."""
    ids = _load()
    if chat_id not in ids:
        return False
    ids.remove(chat_id)
    _save(ids)
    logger.info("Unsubscribed: %s (total: %d)", chat_id, len(ids))
    return True


def get_all() -> list[str]:
    return _load()


def count() -> int:
    return len(_load())
