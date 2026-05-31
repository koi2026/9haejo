"""
가격 알림 모듈
alerts.json에 사용자별 알림 저장, APScheduler로 매 5분 체크
"""
import json
import logging
from pathlib import Path
from data_dir import DATA_DIR

logger = logging.getLogger(__name__)

ALERTS_PATH = DATA_DIR / "alerts.json"


def _load() -> dict:
    if not ALERTS_PATH.exists():
        return {}
    try:
        return json.loads(ALERTS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict):
    ALERTS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def add_alert(chat_id: str, ticker: str, target_price: float, direction: str) -> bool:
    """direction: 'above' or 'below'"""
    data = _load()
    user_alerts = data.get(chat_id, [])
    # max 5 alerts per user
    if len(user_alerts) >= 5:
        return False
    user_alerts.append({
        "ticker": ticker.upper(),
        "target": target_price,
        "direction": direction,
        "active": True,
    })
    data[chat_id] = user_alerts
    _save(data)
    return True


def remove_alert(chat_id: str, ticker: str) -> int:
    """Remove all alerts for ticker. Returns count removed."""
    data = _load()
    user_alerts = data.get(chat_id, [])
    before = len(user_alerts)
    user_alerts = [a for a in user_alerts if a["ticker"] != ticker.upper()]
    data[chat_id] = user_alerts
    _save(data)
    return before - len(user_alerts)


def get_alerts(chat_id: str) -> list:
    return _load().get(chat_id, [])


def get_all_alerts() -> dict:
    return _load()


def check_and_fire_alerts():
    """
    매 5분마다 실행: 알림 조건 체크, 발동 시 텔레그램 전송 후 삭제
    """
    from collector import yf_quote
    from bot import send

    data = _load()
    fired = []  # (chat_id, idx)

    for chat_id, alerts in data.items():
        for i, alert in enumerate(alerts):
            if not alert.get("active", True):
                continue
            try:
                q = yf_quote(alert["ticker"])
                if not q:
                    continue
                price = q["price"]
                direction = alert["direction"]
                target = alert["target"]

                triggered = (direction == "above" and price >= target) or \
                            (direction == "below" and price <= target)

                if triggered:
                    arrow = ">=" if direction == "above" else "<="
                    pct = q.get("change_pct", 0) or 0
                    sign = "+" if pct >= 0 else ""
                    # AI 코멘트 생성 (haiku, fast)
                    ai_comment = ""
                    try:
                        from stock_analyzer import claude_call
                        _prompt = (
                            f"{alert['ticker']} just {'broke above' if direction=='above' else 'dropped below'} "
                            f"${target:,.2f} (current: ${price:,.2f}, {sign}{pct:.2f}% today). "
                            f"Give a 1-sentence Korean action advice for retail investors. MAX 80 chars. No emoji."
                        )
                        ai_comment = "\n\nAI: " + claude_call("claude-haiku-4-5", _prompt, max_tokens=100).strip()
                    except Exception:
                        pass
                    msg = (
                        f"🔔 <b>가격 알림 발동!</b>\n\n"
                        f"{alert['ticker']}: ${price:,.2f} ({sign}{pct:.2f}%)\n"
                        f"목표가 {arrow} ${target:,.2f} 도달"
                        f"{ai_comment}\n\n"
                        f"더 자세한 분석: <code>{alert['ticker']}</code>"
                    )
                    send(chat_id, msg)
                    fired.append((chat_id, i))
                    logger.info("Alert fired: %s %s %s %.2f", chat_id, alert["ticker"], direction, target)
            except Exception as e:
                logger.error("Alert check error: %s", e)

    # Remove fired alerts (reverse order to preserve indices)
    for chat_id, idx in reversed(fired):
        data[chat_id][idx]["active"] = False
        data[chat_id] = [a for a in data[chat_id] if a.get("active", True)]

    if fired:
        _save(data)
