"""
사용자 설정 모듈
user_settings.json에 사용자별 선호도 저장
"""
import json
import logging
from pathlib import Path
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)
SETTINGS_PATH = DATA_DIR / "user_settings.json"

DEFAULTS = {
    "timezone": "Asia/Seoul",
    "extra_alerts": [],  # 추가 알림 시간 ["14:00", "23:00"]
    "watchlist_briefing": True,  # 브리핑 시 watchlist 포함
    "alarm_time": None,  # 개인 시황 알람 시각 (KST HH:MM)
}


def _load() -> dict:
    if not SETTINGS_PATH.exists():
        return {}
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict):
    SETTINGS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_settings(chat_id: str) -> dict:
    data = _load()
    return {**DEFAULTS, **data.get(chat_id, {})}


def update_setting(chat_id: str, key: str, value) -> bool:
    data = _load()
    user = data.get(chat_id, {})
    user[key] = value
    data[chat_id] = user
    _save(data)
    return True


def _load_all_settings() -> dict:
    """모든 사용자 설정 반환 (알람 체크용)"""
    return _load()
