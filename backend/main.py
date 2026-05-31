import os
import sys

if sys.stdout.encoding != "utf-8":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except: pass
if sys.stderr.encoding != "utf-8":
    try: sys.stderr.reconfigure(encoding="utf-8")
    except: pass

import json
import logging
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from data_dir import DATA_DIR
from collector import collect_all
from summarizer import summarize
from telegram_poster import post_summary
from bot import router as bot_router
from subscribers import subscribe, unsubscribe, get_all, count

app = FastAPI(title="9haejo API", version="3.0.0")
app.include_router(bot_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_last_summary = {}


def run_summary_job():
    global _last_summary
    data = collect_all()
    result = summarize(data)
    # 전체 구독자에게 발송
    from bot import send as tg_send
    from collector import yf_quote
    import json

    subscribers = get_all()

    # watchlist.json 로드
    wl_path = DATA_DIR / "watchlists.json"
    try:
        wl_db = json.loads(wl_path.read_text(encoding="utf-8")) if wl_path.exists() else {}
    except Exception:
        wl_db = {}

    share_text = "구해조 AI 브리핑 - 매일 8시 미국 증시 분석"
    share_url = f"https://t.me/share/url?url=https%3A%2F%2F9haejo.vercel.app&text={share_text.replace(' ', '%20')}"
    share_markup = {
        "inline_keyboard": [[
            {"text": "🔗 친구에게 공유", "url": share_url},
            {"text": "🌐 웹에서 보기", "url": "https://9haejo.vercel.app"},
        ], [
            {"text": "📊 지금 시황", "callback_data": "/시황"},
            {"text": "⚡ 종목 분석", "callback_data": "__help_stock"},
        ]]
    }

    for chat_id in subscribers:
        # 브리핑 5개 메시지 전송 (마지막 메시지에 공유 버튼 추가)
        tweets = result["tweets"]
        for i, tweet in enumerate(tweets):
            if i == len(tweets) - 1:
                tg_send(chat_id, tweet, reply_markup=share_markup)
            else:
                tg_send(chat_id, tweet)
        # 관심종목 현황 추가 전송
        user_wl = wl_db.get(chat_id, [])
        if user_wl:
            lines = [f"<b>📋 내 관심종목 오늘 현황</b> ({len(user_wl)}개)\n"]
            for sym in user_wl[:6]:
                q = yf_quote(sym)
                if q:
                    arrow = "▲" if q["change_pct"] >= 0 else "▼"
                    sign = "+" if q["change_pct"] >= 0 else ""
                    lines.append(f"{sym}: ${q['price']:,.2f} {arrow}{sign}{q['change_pct']:.2f}%")
                else:
                    lines.append(f"{sym}: 조회 실패")
            tg_send(chat_id, "\n".join(lines))

    # 브리핑 히스토리 저장
    from briefing_history import save_briefing
    save_briefing(data["date"], result["tweets"])

    # 메인 채널에도 발송
    url = post_summary(result["tweets"])
    _last_summary = {
        "date": data["date"],
        "tweets": result["tweets"],
        "telegram_url": url,
        "subscriber_count": len(subscribers),
    }
    return _last_summary


# ── APScheduler: 매일 KST 08:00 브리핑 자동 발송 ────────────────────────
_scheduler = BackgroundScheduler(timezone=pytz.utc)


def register_bot_commands():
    """Telegram setMyCommands -- 봇 커맨드 자동완성 등록"""
    import httpx as _httpx
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return
    commands = [
        {"command": "start", "description": "시작 및 안내"},
        {"command": "help", "description": "전체 커맨드 목록"},
        {"command": "브리핑", "description": "즉시 AI 브리핑 (30초)"},
        {"command": "시황", "description": "미국+한국 시장 현황"},
        {"command": "뉴스", "description": "오늘의 월가 뉴스 요약"},
        {"command": "환율", "description": "주요 환율 및 AI 전망"},
        {"command": "상승", "description": "오늘 빅테크 상위 종목"},
        {"command": "하락", "description": "오늘 빅테크 하위 종목"},
        {"command": "watchlist", "description": "관심종목 현황"},
        {"command": "포트폴리오", "description": "관심종목 AI 진단"},
        {"command": "알림", "description": "가격 알림 관리"},
        {"command": "설정", "description": "개인 설정"},
        {"command": "구독", "description": "매일 8시 브리핑 구독"},
        {"command": "구독취소", "description": "구독 해제"},
        {"command": "지난브리핑", "description": "어제 브리핑 다시보기"},
        {"command": "매크로", "description": "금리/DXY/오일/VIX 매크로 시황"},
        {"command": "종목전망", "description": "종목 주간 전망 AI 분석 (예: /종목전망 NVDA)"},
        {"command": "랭킹", "description": "암호화폐/빅테크/코스피 시세 랭킹"},
        {"command": "내통계", "description": "내 구독/관심종목/알림 현황 통계"},
        {"command": "한줄", "description": "오늘 시장 한 줄 요약 (공유용)"},
        {"command": "주간", "description": "이번 주 지수 성적표"},
        {"command": "차트", "description": "종목 30일 스파크라인 차트 (예: /차트 NVDA)"},
        {"command": "캘린더", "description": "FOMC/CPI/NFP 주요 경제지표 일정"},
        {"command": "비교", "description": "두 종목 AI 비교 (예: /비교 NVDA TSLA)"},
        {"command": "실적", "description": "Q2 어닝 시즌 주요 종목 발표 일정"},
    ]
    try:
        r = _httpx.post(
            f"https://api.telegram.org/bot{token}/setMyCommands",
            json={"commands": commands},
            timeout=10,
        )
        logger.info("setMyCommands: %s", r.json())
    except Exception as e:
        logger.warning("setMyCommands failed: %s", e)


def register_webhook():
    """Railway 시작시 텔레그램 웹훅 자동 등록"""
    import httpx as _httpx
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    railway_url = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")
    if not token or not railway_url:
        logger.info("Webhook auto-register skipped: missing token or RAILWAY_PUBLIC_DOMAIN")
        return
    webhook_url = f"https://{railway_url}/webhook/telegram"
    try:
        r = _httpx.post(
            f"https://api.telegram.org/bot{token}/setWebhook",
            json={"url": webhook_url, "allowed_updates": ["message", "callback_query"]},
            timeout=10,
        )
        data = r.json()
        if data.get("ok"):
            logger.info("Webhook registered: %s", webhook_url)
        else:
            logger.warning("Webhook registration failed: %s", data)
    except Exception as e:
        logger.warning("Webhook register error: %s", e)


@app.on_event("startup")
def startup_scheduler():
    register_webhook()
    register_bot_commands()
    from alerts import check_and_fire_alerts
    from apscheduler.triggers.interval import IntervalTrigger
    # KST 08:00 = UTC 23:00
    _scheduler.add_job(
        run_summary_job,
        CronTrigger(hour=23, minute=0, timezone=pytz.utc),
        id="daily_briefing",
        replace_existing=True,
        misfire_grace_time=300,
    )
    # 가격 알림 체크: 매 5분
    _scheduler.add_job(
        check_and_fire_alerts,
        IntervalTrigger(minutes=5),
        id="price_alerts",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started: daily_briefing + price_alerts every 5min")


@app.on_event("shutdown")
def shutdown_scheduler():
    _scheduler.shutdown(wait=False)


@app.get("/")
def root():
    return {"status": "ok", "service": "9haejo", "version": "3.0.0", "subscribers": count()}


@app.get("/health")
def health():
    from datetime import datetime
    next_job = None
    try:
        job = _scheduler.get_job("daily_briefing")
        if job and job.next_run_time:
            next_job = job.next_run_time.isoformat()
    except Exception:
        pass
    # 웹훅 상태 확인
    webhook_url = ""
    try:
        import httpx as _httpx
        token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        if token:
            wr = _httpx.get(f"https://api.telegram.org/bot{token}/getWebhookInfo", timeout=5)
            webhook_url = wr.json().get("result", {}).get("url", "")
    except Exception:
        pass
    return {
        "status": "healthy",
        "version": "3.0.0",
        "subscribers": count(),
        "scheduler_running": _scheduler.running,
        "next_briefing_utc": next_job,
        "last_briefing_date": _last_summary.get("date"),
        "uptime_check": datetime.utcnow().isoformat(),
        "webhook_url": webhook_url,
    }


@app.post("/subscribe")
def api_subscribe(body: dict):
    """웹 구독 폼에서 호출"""
    chat_id = str(body.get("chat_id", "")).strip()
    if not chat_id:
        return {"success": False, "message": "chat_id가 필요합니다."}
    is_new = subscribe(chat_id)
    return {
        "success": True,
        "is_new": is_new,
        "message": "구독 완료!" if is_new else "이미 구독 중입니다.",
        "total_subscribers": count(),
    }


@app.delete("/subscribe/{chat_id}")
def api_unsubscribe(chat_id: str):
    removed = unsubscribe(chat_id)
    return {"success": removed, "message": "구독 해제" if removed else "구독 중이 아님"}


@app.get("/subscribers/count")
def subscriber_count():
    return {"count": count()}


@app.get("/summary/latest")
def get_latest_summary():
    if not _last_summary:
        return {"message": "아직 생성된 요약이 없습니다."}
    return _last_summary


@app.post("/summary/run")
def run_summary(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_summary_job)
    return {"message": "브리핑 생성 시작. /summary/latest 에서 확인하세요."}


@app.get("/summary/history")
def get_briefing_history_list():
    from briefing_history import get_all_dates
    dates = get_all_dates()
    return {"dates": dates}


@app.get("/summary/history/{date}")
def get_briefing_by_date(date: str):
    from briefing_history import get_briefing
    b = get_briefing(date)
    if not b:
        return {"error": "해당 날짜의 브리핑이 없습니다."}
    return b


@app.get("/summary/preview")
def preview_summary():
    data = collect_all()
    result = summarize(data)
    return {"date": data["date"], "tweets": result["tweets"], "fear_greed": data.get("fear_greed")}


@app.get("/admin/stats")
def admin_stats():
    """관리자용 통계 (인증 없음 - 내부용)"""
    from alerts import get_all_alerts
    from pathlib import Path
    import json

    all_alerts = get_all_alerts()
    total_alerts = sum(len(v) for v in all_alerts.values())

    wl_path = DATA_DIR / "watchlists.json"
    try:
        wl_db = json.loads(wl_path.read_text(encoding="utf-8")) if wl_path.exists() else {}
    except Exception:
        wl_db = {}
    total_watchlist_items = sum(len(v) for v in wl_db.values())

    next_briefing = None
    try:
        job = _scheduler.get_job("daily_briefing")
        if job and job.next_run_time:
            next_briefing = job.next_run_time.isoformat()
    except Exception:
        pass

    return {
        "subscribers": count(),
        "total_price_alerts": total_alerts,
        "users_with_alerts": len(all_alerts),
        "total_watchlist_items": total_watchlist_items,
        "users_with_watchlist": len(wl_db),
        "last_briefing_date": _last_summary.get("date"),
        "next_briefing_utc": next_briefing,
        "scheduler_running": _scheduler.running,
    }


@app.get("/news/latest")
def news_latest():
    """최신 뉴스 (Alpha Vantage, 5분 캐시)"""
    from cache import news_cache
    from collector import av_news_sentiment
    cached = news_cache.get("raw_news")
    if cached:
        return {"news": cached}
    news = av_news_sentiment()
    if news:
        news_cache.set("raw_news", news)
    return {"news": news}


@app.get("/stock/history/{ticker}")
def stock_history(ticker: str, days: int = 7):
    """종목 최근 N일 종가 히스토리 (SVG 스파크라인용, 5분 캐시)"""
    from cache import news_cache
    import yfinance as yf
    ticker = ticker.upper().strip()
    days = max(5, min(days, 30))
    cache_key = f"hist:{ticker}:{days}"
    cached = news_cache.get(cache_key)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=f"{days + 3}d")
        if hist.empty:
            return {"error": "데이터 없음", "ticker": ticker}
        prices = [round(float(p), 2) for p in hist["Close"].tolist()[-days:]]
        dates = [str(d.date()) for d in hist.index.tolist()[-days:]]
        result = {"ticker": ticker, "prices": prices, "dates": dates}
        news_cache.set(cache_key, result)
        return result
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@app.get("/market/trending")
def market_trending():
    """뉴스 언급량 기반 트렌딩 종목 (5개, 10분 캐시)"""
    from cache import news_cache
    from collector import av_news_sentiment, yf_quote
    cached = news_cache.get("trending_stocks")
    if cached:
        return cached
    news = av_news_sentiment()
    if not news:
        return {"tickers": []}
    # 티커 언급 집계
    from collections import Counter
    ticker_counts: Counter = Counter()
    ticker_sentiments: dict = {}
    for item in news:
        for ts in item.get("ticker_sentiment", []):
            sym = ts.get("ticker", "")
            if sym and len(sym) <= 5 and sym.isalpha():
                ticker_counts[sym] += 1
                s = float(ts.get("ticker_sentiment_score", 0))
                ticker_sentiments.setdefault(sym, []).append(s)
    # 상위 5개 + 시세 조회
    top = [sym for sym, _ in ticker_counts.most_common(8) if sym not in ("N/A", "")][:8]
    tickers_out = []
    for sym in top:
        q = yf_quote(sym)
        if q:
            avg_sent = sum(ticker_sentiments.get(sym, [0])) / max(len(ticker_sentiments.get(sym, [1])), 1)
            tickers_out.append({
                "ticker": sym,
                "price": q["price"],
                "change_pct": q["change_pct"],
                "mentions": ticker_counts[sym],
                "sentiment_score": round(avg_sent, 3),
            })
        if len(tickers_out) >= 5:
            break
    result = {"tickers": tickers_out}
    news_cache.set("trending_stocks", result)
    return result


@app.get("/calendar/upcoming")
def calendar_upcoming():
    """주요 경제지표 일정 (프론트 캘린더 위젯용)"""
    from datetime import date
    today = date.today()
    EVENTS = [
        ("2026-06-03", "NFP", "비농업고용 (5월)"),
        ("2026-06-05", "ISM", "ISM 서비스업 PMI"),
        ("2026-06-11", "CPI", "소비자물가지수 (5월)"),
        ("2026-06-17", "FOMC", "FOMC 회의 시작"),
        ("2026-06-18", "FOMC", "FOMC 결과 발표"),
        ("2026-06-26", "PCE", "PCE 물가지수 (5월)"),
        ("2026-07-02", "NFP", "비농업고용 (6월)"),
        ("2026-07-10", "CPI", "소비자물가지수 (6월)"),
        ("2026-07-29", "FOMC", "FOMC 결과 발표"),
        ("2026-07-31", "GDP", "2Q GDP 속보치"),
    ]
    events_out = []
    for date_str, tag, name in EVENTS:
        d = date.fromisoformat(date_str)
        days_left = (d - today).days
        events_out.append({
            "date": date_str,
            "tag": tag,
            "name": name,
            "days_left": days_left,
            "is_past": days_left < 0,
        })
    return {"events": events_out, "today": today.isoformat()}


@app.get("/stock/quote/{ticker}")
def stock_quote(ticker: str):
    """단일 종목 실시간 시세 + 기본 정보 (프론트 위젯용, 60초 캐시)"""
    from cache import news_cache
    from collector import yf_quote
    ticker = ticker.upper().strip()
    cache_key = f"quote:{ticker}"
    cached = news_cache.get(cache_key)
    if cached:
        return cached
    q = yf_quote(ticker)
    if not q:
        return {"error": "종목을 찾을 수 없습니다", "ticker": ticker}
    result = {"ticker": ticker, **q}
    news_cache.set(cache_key, result)
    return result


@app.get("/market/live")
def market_live():
    """실시간 시장 데이터 (지수·환율·공포탐욕·빅테크) -- 프론트 위젯용"""
    from collector import yf_quote, collect_fear_greed
    indices = {
        "S&P500": yf_quote("^GSPC"),
        "NASDAQ": yf_quote("^IXIC"),
        "DOW": yf_quote("^DJI"),
        "VIX": yf_quote("^VIX"),
    }
    fx = {
        "USD/KRW": yf_quote("KRW=X"),
        "USD/JPY": yf_quote("JPY=X"),
    }
    big_stocks = {
        "NVDA": yf_quote("NVDA"),
        "TSLA": yf_quote("TSLA"),
        "AAPL": yf_quote("AAPL"),
        "MSFT": yf_quote("MSFT"),
        "AMZN": yf_quote("AMZN"),
        "META": yf_quote("META"),
    }
    fear_greed = collect_fear_greed()
    return {"indices": indices, "fx": fx, "fear_greed": fear_greed, "big_stocks": big_stocks}
