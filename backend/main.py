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
                    day_arrow = "▲" if q["change_pct"] >= 0 else "▼"
                    day_color = "+" if q["change_pct"] >= 0 else ""
                    move_arrow = "▲" if change_from_prev >= 0 else "▼"
                    move_sign = "+" if change_from_prev >= 0 else ""
                    start_sign = "+" if change_from_start >= 0 else ""
                    # 5분 변동 크면 강조
                    move_str = f"{move_arrow}{move_sign}{change_from_prev:.2f}%"
                    if abs(change_from_prev) >= 0.5:
                        move_str = f"<b>{move_str}</b>"
                    msg = (
                        f"📡 <b>{ticker}</b> 실시간 업데이트\n"
                        f"━━━━━━━━━━━━━━━━\n\n"
                        f"<b>${price:,.2f}</b>  {day_arrow}{day_color}{q['change_pct']:.2f}% 오늘\n"
                        f"5분 변동: {move_str}\n"
                        f"추적 시작: {start_sign}{change_from_start:.2f}%\n\n"
                        f"<i>/실시간 중지 로 추적 중단</i>"
                    )
                    markup = {"inline_keyboard": [[
                        {"text": f"🔍 {ticker} 심층 분석", "callback_data": f"/{ticker}"},
                        {"text": "⏹ 추적 중단", "callback_data": "/실시간 중지"},
                    ]]}
                    send(chat_id, msg, reply_markup=markup)
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
    # 캐시 만료 항목 정리: 30분마다
    def purge_caches():
        from cache import quote_cache, news_cache, analysis_cache
        n = quote_cache.purge_expired() + news_cache.purge_expired() + analysis_cache.purge_expired()
        if n > 0:
            logger.info("Cache purge: %d expired entries removed", n)
    _scheduler.add_job(
        purge_caches,
        IntervalTrigger(minutes=30),
        id="cache_purge",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started: daily_briefing + price_alerts + user_alarms + realtime_updates + cache_purge")


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

    from cache import quote_cache, news_cache, analysis_cache
    return {
        "subscribers": count(),
        "total_price_alerts": total_alerts,
        "users_with_alerts": len(all_alerts),
        "total_watchlist_items": total_watchlist_items,
        "users_with_watchlist": len(wl_db),
        "last_briefing_date": _last_summary.get("date"),
        "next_briefing_utc": next_briefing,
        "scheduler_running": _scheduler.running,
        "cache": {
            "quote": quote_cache.stats(),
            "news": news_cache.stats(),
            "analysis": analysis_cache.stats(),
        },
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


@app.get("/news/ai-summary")
def news_ai_summary():
    """뉴스 AI 한국어 요약 (캐시 10분)"""
    from cache import news_cache
    cache_key = "news_ai_summary"
    cached = news_cache.get(cache_key)
    if cached:
        return {"summary": cached}
    try:
        from stock_analyzer import summarize_news
        result = summarize_news()
        # strip HTML for the web page
        import re
        plain = re.sub(r"<[^>]+>", "", result).strip()
        news_cache.set(cache_key, plain)
        return {"summary": plain}
    except Exception as e:
        return {"summary": "", "error": str(e)}


@app.get("/stock/history/{ticker}")
def stock_history(ticker: str, days: int = 7):
    """종목 최근 N일 종가 히스토리 (SVG 스파크라인용, 5분 캐시)"""
    from cache import news_cache
    import yfinance as yf
    ticker = ticker.upper().strip()
    days = max(5, min(days, 90))
    cache_key = f"hist:{ticker}:{days}"
    cached = news_cache.get(cache_key)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=f"{days + 5}d")
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


@app.get("/stock/{ticker}/technicals")
def stock_technicals(ticker: str):
    """RSI·MA·MACD 기술 지표 (14일 데이터 기반, 10분 캐시)"""
    import yfinance as yf
    from cache import analysis_cache
    ticker = ticker.upper().strip()
    cache_key = f"tech:{ticker}"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    try:
        hist = yf.Ticker(ticker).history(period="60d", interval="1d")
        if hist.empty or len(hist) < 20:
            return {"error": "데이터 부족"}
        closes = list(hist["Close"])
        volumes = list(hist["Volume"])

        # RSI (14)
        gains, losses = [], []
        for i in range(1, len(closes)):
            diff = closes[i] - closes[i - 1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))
        avg_gain = sum(gains[-14:]) / 14
        avg_loss = sum(losses[-14:]) / 14
        rsi = 100 - (100 / (1 + avg_gain / avg_loss)) if avg_loss else 100

        # MAs
        ma20 = sum(closes[-20:]) / 20
        ma50 = sum(closes[-50:]) / 50 if len(closes) >= 50 else None
        current = closes[-1]

        # MACD (12/26/9 EMA)
        def ema(prices, n):
            k = 2 / (n + 1)
            e = prices[0]
            for p in prices[1:]:
                e = p * k + e * (1 - k)
            return e
        ema12 = ema(closes[-40:], 12) if len(closes) >= 12 else None
        ema26 = ema(closes[-40:], 26) if len(closes) >= 26 else None
        macd = (ema12 - ema26) if (ema12 and ema26) else None

        # Volume vs avg
        vol_avg = sum(volumes[-20:]) / 20
        vol_ratio = volumes[-1] / vol_avg if vol_avg else 1

        # Signal strings
        rsi_signal = "과매수" if rsi > 70 else "과매도" if rsi < 30 else "중립"
        trend = "상승추세" if current > ma20 else "하락추세"

        result = {
            "rsi": round(rsi, 1),
            "rsi_signal": rsi_signal,
            "ma20": round(ma20, 2),
            "ma50": round(ma50, 2) if ma50 else None,
            "current": round(current, 2),
            "above_ma20": current > ma20,
            "above_ma50": current > ma50 if ma50 else None,
            "macd": round(macd, 3) if macd else None,
            "macd_signal": "매수" if macd and macd > 0 else "매도" if macd and macd < 0 else "중립",
            "vol_ratio": round(vol_ratio, 2),
            "vol_spike": vol_ratio > 1.5,
            "trend": trend,
        }
        analysis_cache.set(cache_key, result)
        return result
    except Exception as e:
        return {"error": str(e)}


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


_EARNINGS_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AVGO", "AMD", "NFLX", "COIN", "PLTR", "CRM", "ORCL", "UBER"]

@app.get("/calendar/earnings")
def calendar_earnings():
    """주요 종목 실적 발표 일정 (yfinance, 1시간 캐시)"""
    from cache import news_cache
    from datetime import date, timedelta
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor

    cached = news_cache.get("earnings_calendar")
    if cached:
        return cached

    today = date.today()
    results = []

    def _fetch(ticker):
        try:
            t = yf.Ticker(ticker)
            cal = t.calendar
            if cal is None:
                return None
            if isinstance(cal, dict):
                ed = cal.get("Earnings Date")
                if ed and hasattr(ed, "__iter__") and not isinstance(ed, str):
                    ed = list(ed)[0] if ed else None
            else:
                # DataFrame style
                try:
                    ed = cal.loc["Earnings Date"].iloc[0] if "Earnings Date" in cal.index else None
                except Exception:
                    return None
            if ed is None:
                return None
            if hasattr(ed, "date"):
                ed = ed.date()
            elif isinstance(ed, str):
                from datetime import datetime
                ed = datetime.fromisoformat(ed[:10]).date()
            days_left = (ed - today).days
            if days_left < -7 or days_left > 90:
                return None
            info = t.info or {}
            return {
                "ticker": ticker,
                "name": info.get("shortName", ticker),
                "date": ed.isoformat(),
                "days_left": days_left,
                "is_past": days_left < 0,
            }
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as ex:
        items = list(ex.map(_fetch, _EARNINGS_TICKERS))

    results = sorted(
        [r for r in items if r is not None],
        key=lambda x: x["days_left"]
    )
    result = {"events": results, "today": today.isoformat()}
    news_cache.set("earnings_calendar", result, ttl=3600)
    return result


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

    # 배당 정보
    div_yield = None
    div_rate = None
    payout_ratio = None
    ex_div_date = None
    try:
        info_div = yf.Ticker(ticker).info or {}
        dv = info_div.get("dividendYield")
        dr = info_div.get("dividendRate")
        pr = info_div.get("payoutRatio")
        edd = info_div.get("exDividendDate")
        div_yield = round(dv * 100, 2) if dv else None
        div_rate = round(dr, 4) if dr else None
        payout_ratio = round(pr * 100, 1) if pr else None
        if edd and isinstance(edd, (int, float)):
            from datetime import datetime
            ex_div_date = datetime.fromtimestamp(edd).strftime("%Y-%m-%d")
    except Exception:
        pass

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
        "div_yield": div_yield,
        "div_rate": div_rate,
        "payout_ratio": payout_ratio,
        "ex_div_date": ex_div_date,
    }
    analysis_cache.set(cache_key, result)
    return result


@app.get("/stock/{ticker}/analyst")
def stock_analyst(ticker: str):
    """애널리스트 컨센서스 (목표주가·추천분포, 1시간 캐시)"""
    import yfinance as yf
    from cache import analysis_cache
    ticker = ticker.upper().strip()
    cache_key = f"analyst:{ticker}"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        # Price targets
        mean_target = info.get("targetMeanPrice")
        high_target = info.get("targetHighPrice")
        low_target = info.get("targetLowPrice")
        num_analysts = info.get("numberOfAnalystOpinions")
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        recommendation = info.get("recommendationKey", "")  # strong_buy, buy, hold, sell
        # Recommendation summary
        strong_buy = info.get("recommendationsBuy", 0) or 0
        buy = 0
        hold = info.get("recommendationsHold", 0) or 0
        sell = info.get("recommendationsSell", 0) or 0
        strong_sell = info.get("recommendationsStrongSell", 0) or 0
        # Try recommendations_summary DataFrame
        try:
            rec_df = t.recommendations_summary
            if rec_df is not None and len(rec_df) > 0:
                latest = rec_df.iloc[0]
                strong_buy = int(latest.get("strongBuy", strong_buy))
                buy = int(latest.get("buy", buy))
                hold = int(latest.get("hold", hold))
                sell = int(latest.get("sell", sell))
                strong_sell = int(latest.get("strongSell", strong_sell))
        except Exception:
            pass
        total = strong_buy + buy + hold + sell + strong_sell
        upside = ((mean_target - current_price) / current_price * 100) if mean_target and current_price else None
        result = {
            "ticker": ticker,
            "current_price": current_price,
            "mean_target": round(mean_target, 2) if mean_target else None,
            "high_target": round(high_target, 2) if high_target else None,
            "low_target": round(low_target, 2) if low_target else None,
            "upside_pct": round(upside, 1) if upside else None,
            "num_analysts": num_analysts,
            "recommendation": recommendation,
            "strong_buy": strong_buy, "buy": buy, "hold": hold,
            "sell": sell, "strong_sell": strong_sell, "total": total,
        }
        analysis_cache.set(cache_key, result, ttl=3600)
        return result
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@app.get("/stock/{ticker}/peers")
def stock_peers(ticker: str):
    """동종 섹터 주요 종목 현황 (5개, 캐시 5분)"""
    from collector import yf_quote
    from cache import news_cache
    import yfinance as yf
    ticker = ticker.upper().strip()
    cache_key = f"peers:{ticker}"
    cached = news_cache.get(cache_key)
    if cached:
        return cached
    # 섹터별 피어 매핑
    SECTOR_PEERS = {
        "Technology": ["NVDA", "MSFT", "AAPL", "META", "GOOGL", "AMD", "AVGO", "INTC", "ORCL", "ADBE"],
        "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "BKNG", "GM"],
        "Communication Services": ["META", "GOOGL", "NFLX", "DIS", "T", "VZ", "SNAP", "PINS"],
        "Financial Services": ["JPM", "BAC", "GS", "MS", "WFC", "V", "MA", "AXP"],
        "Healthcare": ["JNJ", "PFE", "ABBV", "MRK", "UNH", "LLY", "AMGN", "GILD"],
        "Energy": ["XOM", "CVX", "COP", "SLB", "OXY", "MPC", "VLO"],
        "Industrials": ["BA", "CAT", "HON", "GE", "UPS", "RTX", "LMT"],
        "Consumer Defensive": ["WMT", "PG", "KO", "PEP", "COST", "CL", "MDLZ"],
        "Basic Materials": ["LIN", "APD", "SHW", "FCX", "NEM", "AA"],
        "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "SPG", "O"],
        "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC"],
    }
    try:
        info = yf.Ticker(ticker).info or {}
        sector = info.get("sector", "")
        peers_all = SECTOR_PEERS.get(sector, ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN"])
        peers = [p for p in peers_all if p != ticker][:5]
    except Exception:
        peers = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN"]
        sector = ""
    result_peers = []
    for p in peers:
        q = yf_quote(p)
        if q:
            result_peers.append({"ticker": p, "price": q["price"], "change_pct": q["change_pct"]})
    result = {"ticker": ticker, "sector": sector, "peers": result_peers}
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


@app.get("/compare/{ticker_a}/{ticker_b}")
def compare_stocks_api(ticker_a: str, ticker_b: str):
    """두 종목 비교 + AI 판정"""
    from collector import yf_quote
    from stock_analyzer import claude_call
    a = ticker_a.upper()
    b = ticker_b.upper()
    qa = yf_quote(a) or {}
    qb = yf_quote(b) or {}
    if not qa or not qb:
        return {"verdict": ""}
    def _s(q, k, default=None):
        return q.get(k, default)
    prompt = (
        f"Compare {a} vs {b} for retail investors. Data:\n"
        f"{a}: price=${_s(qa,'price',0):.2f}, change={_s(qa,'change_pct',0):+.2f}%, "
        f"mktcap={_s(qa,'market_cap',0):.0f}, pe={_s(qa,'pe','N/A')}\n"
        f"{b}: price=${_s(qb,'price',0):.2f}, change={_s(qb,'change_pct',0):+.2f}%, "
        f"mktcap={_s(qb,'market_cap',0):.0f}, pe={_s(qb,'pe','N/A')}\n\n"
        f"Write a concise Korean comparison (3-4 sentences). State which is better for short-term and which for long-term. "
        f"Be direct and specific. No disclaimers."
    )
    try:
        verdict = claude_call("claude-haiku-4-5", prompt, max_tokens=300).strip()
    except Exception:
        verdict = ""
    return {"ticker_a": a, "ticker_b": b, "verdict": verdict}


@app.get("/alerts/{chat_id}")
def get_alerts_web(chat_id: str):
    """웹용 가격 알림 조회 (텔레그램 chat_id 기반, 실시간 현재가 포함)"""
    from alerts import _load as _load_alerts
    from collector import yf_quote
    from concurrent.futures import ThreadPoolExecutor

    all_alerts = _load_alerts()
    user_alerts = all_alerts.get(str(chat_id), [])
    if not user_alerts:
        return {"chat_id": chat_id, "alerts": [], "found": False}

    tickers = list({a["ticker"] for a in user_alerts})
    def _q(sym):
        try:
            q = yf_quote(sym) or {}
            return sym, q.get("price", 0)
        except Exception:
            return sym, 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        prices = dict(ex.map(_q, tickers))

    result_alerts = []
    for a in user_alerts:
        if not a.get("active", True):
            continue
        ticker = a["ticker"]
        current = prices.get(ticker, 0)
        target = a["target"]
        direction = a.get("direction", "above")
        pct_away = ((target - current) / current * 100) if current else None
        result_alerts.append({
            "ticker": ticker,
            "target": target,
            "direction": direction,
            "current_price": current,
            "pct_away": round(pct_away, 2) if pct_away is not None else None,
            "triggered": (current >= target if direction == "above" else current <= target) if current else False,
        })

    return {"chat_id": chat_id, "alerts": result_alerts, "found": True, "count": len(result_alerts)}


@app.get("/watchlist/{chat_id}")
def get_watchlist_web(chat_id: str):
    """웹용 관심종목 조회 (텔레그램 chat_id 기반, 실시간 시세 포함)"""
    from collector import yf_quote
    from concurrent.futures import ThreadPoolExecutor
    wl_path = DATA_DIR / "watchlists.json"
    try:
        with open(wl_path) as f:
            import json
            wl_db = json.load(f)
    except Exception:
        wl_db = {}
    tickers = wl_db.get(str(chat_id), [])
    if not tickers:
        return {"chat_id": chat_id, "tickers": [], "found": False}

    def _q(sym):
        try:
            q = yf_quote(sym) or {}
            return {"ticker": sym, "price": q.get("price", 0), "change_pct": q.get("change_pct", 0)}
        except Exception:
            return {"ticker": sym, "price": 0, "change_pct": 0}

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(_q, tickers))

    return {"chat_id": chat_id, "tickers": results, "found": True, "count": len(results)}


@app.get("/market/insight")
def market_insight():
    """오늘의 AI 투자 인사이트 (매 30분 갱신)"""
    from cache import news_cache
    from collector import yf_quote, collect_fear_greed
    from stock_analyzer import claude_call
    from datetime import date

    cached = news_cache.get("market_insight")
    if cached:
        return cached

    try:
        sp = yf_quote("^GSPC") or {}
        nq = yf_quote("^IXIC") or {}
        vix = yf_quote("^VIX") or {}
        fg = collect_fear_greed()
        today = date.today().strftime("%Y년 %m월 %d일")

        prompt = f"""오늘({today}) 미국 증시 상황:
S&P500: {sp.get('change_pct', 0):+.2f}%, NASDAQ: {nq.get('change_pct', 0):+.2f}%, VIX: {vix.get('price', 0):.1f}, 공포탐욕: {fg.get('score', 50)}

한국 개인 투자자를 위한 오늘의 투자 인사이트를 2-3문장으로 작성해주세요.
- 시장 분위기를 한 단어로 시작 (예: 🔥 과열, 📈 상승, 🟡 혼조, 📉 조정, 🔴 위험)
- 지금 주목해야 할 핵심 포인트 1가지
- 오늘 투자자가 취해야 할 액션 힌트 1가지
- 마케팅 관점에서 매력적이고 명확하게, 100자 이내"""

        insight = claude_call("claude-haiku-4-5", prompt, max_tokens=200).strip()
        result = {
            "insight": insight,
            "date": today,
            "sp500_pct": sp.get("change_pct", 0),
            "vix": vix.get("price", 0),
            "fg_score": fg.get("score", 50),
        }
        news_cache.set("market_insight", result, ttl=1800)
        return result
    except Exception as e:
        return {"insight": "시장 인사이트를 불러오는 중입니다.", "error": str(e)}


@app.get("/market/trending-searches")
def trending_searches():
    """가장 많이 검색된 종목 TOP5"""
    from search_counter import get_top
    return {"tickers": get_top(5)}


_MOVERS_POOL = [
    "NVDA","TSLA","AAPL","MSFT","AMZN","META","GOOGL","AVGO","AMD","PLTR",
    "NFLX","CRM","ORCL","COIN","MSTR","JPM","GS","BAC","LLY","UNH",
    "XOM","V","MA","INTC","QCOM","UBER","SNOW","SHOP","SQ","RBLX",
    "SOFI","RIVN","LCID","NIO","BABA","JD","PDD","ARM","SMCI","MU",
]

@app.get("/market/movers")
def market_movers():
    """당일 상승/하락 상위 종목 (5분 캐시)"""
    from cache import quote_cache
    from collector import yf_quote
    from concurrent.futures import ThreadPoolExecutor
    cached = quote_cache.get("market_movers")
    if cached:
        return cached

    def _q(sym):
        try:
            return sym, yf_quote(sym)
        except Exception:
            return sym, None

    with ThreadPoolExecutor(max_workers=16) as ex:
        results = list(ex.map(_q, _MOVERS_POOL))

    stocks = []
    for sym, q in results:
        if q and q.get("price") and q.get("change_pct") is not None:
            stocks.append({"ticker": sym, "price": q["price"], "change_pct": q["change_pct"]})

    gainers = sorted(stocks, key=lambda x: -x["change_pct"])[:5]
    losers = sorted(stocks, key=lambda x: x["change_pct"])[:5]
    result = {"gainers": gainers, "losers": losers}
    quote_cache.set("market_movers", result)
    return result
