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


def send_realtime_updates():
    """실시간 추적 종목 가격 업데이트 (매 5분)"""
    try:
        from realtime_tracker import get_all_trackers, update_prev_price, remove_tracker
        from collector import yf_quote
        from bot import send
        all_trackers = get_all_trackers()
        for chat_id, tickers in all_trackers.items():
            for ticker, info in list(tickers.items()):
                try:
                    q = yf_quote(ticker)
                    if not q:
                        continue
                    price = q["price"]
                    prev = info.get("prev_price", price)
                    start = info.get("start_price", price)
                    name = info.get("name", ticker)
                    change_from_prev = (price - prev) / prev * 100 if prev else 0
                    change_from_start = (price - start) / start * 100 if start else 0
                    arrow = "▲" if q["change_pct"] >= 0 else "▼"
                    move = "+" if change_from_prev >= 0 else ""
                    msg = (
                        f"📡 <b>{name} ({ticker})</b> 5분 업데이트\n\n"
                        f"현재가: <b>${price:,.2f}</b> {arrow}{abs(q['change_pct']):.2f}%\n"
                        f"5분 변동: {move}{change_from_prev:.2f}%\n"
                        f"추적 시작 대비: {'+' if change_from_start >= 0 else ''}{change_from_start:.2f}%\n\n"
                        f"<i>/실시간 중지 — 추적 중단</i>"
                    )
                    send(chat_id, msg)
                    update_prev_price(chat_id, ticker, price)
                except Exception as e:
                    logger.error("realtime update error %s/%s: %s", chat_id, ticker, e)
    except Exception as e:
        logger.error("send_realtime_updates error: %s", e)


def check_user_alarms():
    """사용자 개인 알람 체크 (매 1분) — user_settings.alarm_time (KST HH:MM)"""
    import datetime, pytz as _pytz
    try:
        from user_settings import _load_all_settings
        from bot import send
        from collector import yf_quote, collect_fear_greed
        all_settings = _load_all_settings()
        now_kst = datetime.datetime.now(_pytz.timezone("Asia/Seoul"))
        current_time = now_kst.strftime("%H:%M")
        for chat_id, settings in all_settings.items():
            alarm_time = settings.get("alarm_time")
            if alarm_time and alarm_time == current_time:
                # 시황 요약 전송
                try:
                    sp = yf_quote("^GSPC")
                    nq = yf_quote("^IXIC")
                    fg = collect_fear_greed()
                    sp_str = f"S&P500 {'▲' if sp.get('change_pct',0)>=0 else '▼'}{abs(sp.get('change_pct',0)):.2f}%" if sp else ""
                    nq_str = f"NASDAQ {'▲' if nq.get('change_pct',0)>=0 else '▼'}{abs(nq.get('change_pct',0)):.2f}%" if nq else ""
                    fg_str = f"F&G {fg.get('score','?')}" if fg else ""
                    msg = (
                        f"<b>🔔 {alarm_time} KST 시황 알람</b>\n\n"
                        f"{sp_str} | {nq_str}\n{fg_str}"
                    )
                    send(chat_id, msg)
                    logger.info("User alarm sent to %s at %s", chat_id, current_time)
                except Exception as e:
                    logger.error("User alarm send error for %s: %s", chat_id, e)
    except Exception as e:
        logger.error("check_user_alarms error: %s", e)


def register_bot_commands():
    """Telegram setMyCommands -- 봇 커맨드 자동완성 등록"""
    import httpx as _httpx
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return
    commands = [
        # 기본
        {"command": "start", "description": "시작 및 안내"},
        {"command": "help", "description": "전체 커맨드 목록"},
        {"command": "요약", "description": "지금 시장 한줄 요약 (즉시)"},
        # 시황/분석
        {"command": "브리핑", "description": "AI 종합 브리핑 (30초)"},
        {"command": "시황", "description": "미국+한국 시장 현황"},
        {"command": "뉴스", "description": "월가 뉴스 AI 분석"},
        {"command": "환율", "description": "주요 환율 + AI 전망"},
        {"command": "매크로", "description": "금리/DXY/오일/VIX 매크로"},
        # 스크리너
        {"command": "섹터", "description": "SPDR 섹터 ETF 성적표 + AI"},
        {"command": "ETF", "description": "QQQ/SPY/ARKK 등 ETF 분석"},
        {"command": "모멘텀", "description": "RSI/MA 기반 모멘텀 종목 스캔"},
        {"command": "배당", "description": "고배당 TOP10 + AI 분석"},
        {"command": "52주", "description": "52주 신고가/신저가 근접 종목"},
        {"command": "금리", "description": "미국 국채금리 + 수익률 곡선"},
        {"command": "원자재", "description": "금/오일/구리/천연가스 현황"},
        # 종목 도구
        {"command": "상승", "description": "오늘 빅테크 상위 종목"},
        {"command": "하락", "description": "오늘 빅테크 하위 종목"},
        {"command": "비교", "description": "두 종목 비교 (예: /비교 NVDA TSLA)"},
        {"command": "종목전망", "description": "종목 AI 전망 (예: /종목전망 NVDA)"},
        {"command": "차트", "description": "30일 스파크라인 (예: /차트 NVDA)"},
        # 내 계정
        {"command": "ai", "description": "나만의 AI 브리핑 (watchlist 기반)"},
        {"command": "포트폴리오", "description": "관심종목 AI 진단 + 성과 막대"},
        {"command": "watchlist", "description": "관심종목 관리"},
        {"command": "알림", "description": "가격 알림 설정/삭제"},
        {"command": "알람", "description": "매일 원하는 시각 시황 자동 전송"},
        {"command": "구독", "description": "매일 8시 브리핑 구독"},
        {"command": "구독취소", "description": "구독 해제"},
        {"command": "내통계", "description": "내 구독/알림/관심종목 통계"},
        # 정보
        {"command": "캘린더", "description": "FOMC/CPI/NFP 경제지표 일정"},
        {"command": "실적", "description": "Q2 어닝 시즌 주요 일정"},
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
    # 사용자 알람 체크: 매 1분
    _scheduler.add_job(
        check_user_alarms,
        IntervalTrigger(minutes=1),
        id="user_alarms",
        replace_existing=True,
    )
    # 실시간 추적 업데이트: 매 5분
    _scheduler.add_job(
        send_realtime_updates,
        IntervalTrigger(minutes=5),
        id="realtime_updates",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started: daily_briefing + price_alerts + user_alarms + realtime_updates")


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
    # 의존성 상태 확인
    deps = {}
    try:
        import yfinance as _yf
        t = _yf.Ticker("AAPL")
        t.history(period="1d")
        deps["yfinance"] = "ok"
    except Exception as e:
        deps["yfinance"] = f"error: {e}"
    try:
        import anthropic as _ant
        deps["anthropic"] = "ok" if os.getenv("ANTHROPIC_API_KEY") else "missing_key"
    except Exception:
        deps["anthropic"] = "not_installed"
    # 활성 알림 수
    alert_count = 0
    try:
        from alerts import _load_alerts
        all_alerts = _load_alerts()
        alert_count = sum(len(v) for v in all_alerts.values())
    except Exception:
        pass
    # 브리핑 히스토리 수
    briefing_count = 0
    try:
        from briefing_history import get_all_dates
        briefing_count = len(get_all_dates())
    except Exception:
        pass
    return {
        "status": "healthy",
        "version": "3.1.0",
        "subscribers": count(),
        "active_alerts": alert_count,
        "briefing_history_count": briefing_count,
        "scheduler_running": _scheduler.running,
        "next_briefing_utc": next_job,
        "last_briefing_date": _last_summary.get("date"),
        "uptime_check": datetime.utcnow().isoformat(),
        "webhook_url": webhook_url,
        "dependencies": deps,
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


@app.get("/summary/search")
def search_briefing_history(q: str = "", limit: int = 5):
    """브리핑 히스토리 키워드 검색"""
    from briefing_history import get_all_dates, get_briefing
    if not q:
        return {"error": "검색어를 입력해주세요. (?q=NVDA)"}
    q_lower = q.lower()
    dates = get_all_dates()
    results = []
    for date in dates:
        briefing = get_briefing(date)
        if not briefing:
            continue
        tweets = briefing.get("tweets", [])
        matched = [t for t in tweets if q_lower in t.lower()]
        if matched:
            results.append({"date": date, "matches": len(matched), "preview": matched[0][:200]})
        if len(results) >= limit:
            break
    return {"query": q, "results": results, "total": len(results)}


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
    """단일 종목 실시간 시세 + 52주 데이터 (프론트 위젯용, 60초 캐시)"""
    import yfinance as yf
    from cache import news_cache
    from collector import yf_quote
    ticker = ticker.upper().strip()
    cache_key = f"quote2:{ticker}"
    cached = news_cache.get(cache_key)
    if cached:
        return cached
    q = yf_quote(ticker)
    if not q:
        return {"error": "종목을 찾을 수 없습니다", "ticker": ticker}
    # 52주 고/저가 추가
    try:
        info = yf.Ticker(ticker).info
        h52 = info.get("fiftyTwoWeekHigh")
        l52 = info.get("fiftyTwoWeekLow")
        name = info.get("shortName") or info.get("longName") or ticker
        sector = info.get("sector", "")
        pe = info.get("trailingPE")
        mktcap = info.get("marketCap")
        q["week52_high"] = round(h52, 2) if h52 else None
        q["week52_low"] = round(l52, 2) if l52 else None
        q["name"] = name
        q["sector"] = sector
        q["pe_ratio"] = round(pe, 1) if pe else None
        q["market_cap"] = mktcap
        if h52 and l52 and h52 > l52:
            pos = (q["price"] - l52) / (h52 - l52) * 100
            q["week52_position"] = round(pos, 1)
        else:
            q["week52_position"] = None
    except Exception:
        pass
    result = {"ticker": ticker, **q}
    news_cache.set(cache_key, result)
    return result


@app.get("/stock/{ticker}")
def stock_detail(ticker: str):
    """종목 상세 페이지용 — 시세 + AI 분석 + 통계 (캐시 10분)"""
    import yfinance as yf
    from cache import analysis_cache
    from collector import yf_quote
    ticker = ticker.upper().strip()
    cache_key = f"stock_detail:{ticker}"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached
    q = yf_quote(ticker)
    if not q:
        return {"error": "종목을 찾을 수 없습니다", "ticker": ticker}
    try:
        info = yf.Ticker(ticker).info or {}
        name = info.get("shortName") or info.get("longName") or ticker
        sector = info.get("sector", "")
        pe = info.get("trailingPE")
        mktcap = info.get("marketCap")
        h52 = info.get("fiftyTwoWeekHigh")
        l52 = info.get("fiftyTwoWeekLow")
        volume = info.get("volume") or info.get("regularMarketVolume")
        avg_vol = info.get("averageVolume") or info.get("averageDailyVolume10Day")
    except Exception:
        name, sector, pe, mktcap, h52, l52, volume, avg_vol = ticker, "", None, None, None, None, None, None

    # AI 분석
    analysis = ""
    try:
        from stock_analyzer import claude_call
        prompt = f"""Analyze {ticker} ({name}) for Korean retail investors in Korean.
Price: ${q['price']:.2f} ({'+' if q['change_pct']>=0 else ''}{q['change_pct']:.2f}%)
Sector: {sector}, Market Cap: {mktcap}, PE: {pe}
52W High: {h52}, 52W Low: {l52}
Write 3-4 sentences: (1) current momentum, (2) key risk/opportunity, (3) what Korean investors should watch. Max 280 chars. Use plain text, no HTML."""
        analysis = claude_call(prompt, max_tokens=300)
    except Exception:
        pass

    result = {
        "ticker": ticker,
        "name": name,
        "price": q["price"],
        "change_pct": q["change_pct"],
        "sector": sector,
        "pe_ratio": round(pe, 1) if pe else None,
        "market_cap": mktcap,
        "week52_high": round(h52, 2) if h52 else None,
        "week52_low": round(l52, 2) if l52 else None,
        "volume": volume,
        "avg_volume": avg_vol,
        "analysis": analysis,
    }
    analysis_cache.set(cache_key, result)
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
    sectors = {
        "기술(XLK)": yf_quote("XLK"),
        "금융(XLF)": yf_quote("XLF"),
        "헬스케어(XLV)": yf_quote("XLV"),
        "에너지(XLE)": yf_quote("XLE"),
        "소비재(XLY)": yf_quote("XLY"),
        "반도체(SOXX)": yf_quote("SOXX"),
        "통신(XLC)": yf_quote("XLC"),
        "산업(XLI)": yf_quote("XLI"),
    }
    return {"indices": indices, "fx": fx, "fear_greed": fear_greed, "big_stocks": big_stocks, "sectors": sectors}


@app.get("/market/trending-searches")
def trending_searches():
    """가장 많이 검색된 종목 TOP5"""
    from search_counter import get_top
    return {"tickers": get_top(5)}
