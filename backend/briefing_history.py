"""
브리핑 히스토리 모듈
최근 7일 브리핑을 briefing_history.json에 저장
"""
import json
import logging
from pathlib import Path
from datetime import datetime, timedelta
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)
HISTORY_PATH = DATA_DIR / "briefing_history.json"
MAX_DAYS = 7


def save_briefing(date: str, tweets: list):
    try:
        data = {}
        if HISTORY_PATH.exists():
            data = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
        data[date] = tweets
        # 7일 이상 지난 것 삭제
        cutoff = (datetime.now() - timedelta(days=MAX_DAYS)).strftime("%Y-%m-%d")
        data = {k: v for k, v in data.items() if k >= cutoff}
        HISTORY_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("Briefing saved: %s", date)
    except Exception as e:
        logger.error("save_briefing error: %s", e)


def get_briefing(date: str) -> dict:
    if not HISTORY_PATH.exists():
        return {}
    try:
        data = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
        tweets = data.get(date)
        if tweets is None:
            return {}
        return {"date": date, "tweets": tweets}
    except Exception:
        return {}


def get_latest_briefing() -> tuple[str, list]:
    """가장 최근 브리핑 (날짜, tweets)"""
    if not HISTORY_PATH.exists():
        return "", []
    try:
        data = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
        if not data:
            return "", []
        latest = sorted(data.keys())[-1]
        return latest, data[latest]
    except Exception:
        return "", []


def get_all_dates() -> list:
    """저장된 모든 날짜 목록 (최신순)"""
    if not HISTORY_PATH.exists():
        return []
    try:
        data = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
        return sorted(data.keys(), reverse=True)
    except Exception:
        return []


def get_yesterday_briefing() -> tuple[str, list]:
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    return yesterday, get_briefing(yesterday)
