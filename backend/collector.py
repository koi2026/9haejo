"""
데이터 수집 모듈 v2.1
- 지수/섹터: yfinance (무제한 무료)
- 환율: yfinance
- 뉴스/감성: Alpha Vantage NEWS_SENTIMENT
- Fear & Greed: CNN 공개 API
- 개별주 상세: Alpha Vantage (브리핑용 요약만)
"""
import os, time, logging
import httpx, yfinance as yf
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)
logger = logging.getLogger(__name__)

AV_KEY  = os.getenv("ALPHA_VANTAGE_KEY", "")
AV_BASE = "https://www.alphavantage.co/query"

INDICES = {"S&P500":"^GSPC","NASDAQ":"^IXIC","DOW":"^DJI","VIX":"^VIX","Russell2000":"^RUT"}
SECTORS = {"반도체":"SOXX","기술IT":"XLK","통신미디어":"XLC","소비재":"XLY",
           "에너지":"XLE","금융":"XLF","헬스케어":"XLV","유틸리티":"XLU"}
BIG_STOCKS = {"NVDA":"NVDA","AAPL":"AAPL","MSFT":"MSFT","TSLA":"TSLA",
              "AMZN":"AMZN","META":"META","GOOGL":"GOOGL","AVGO":"AVGO"}
FX = {"USD/KRW":"KRW=X","USD/JPY":"JPY=X","USD/CNY":"CNY=X"}


def yf_quote(symbol: str, retries: int = 3) -> dict:
    """yfinance로 현재가 + 등락률. fast_info -> history(5d) -> download 순으로 시도."""
    import time as _time

    for attempt in range(retries):
        try:
            t = yf.Ticker(symbol)

            # Strategy 1: fast_info (fastest, least rate-limited)
            try:
                fi = t.fast_info
                curr = float(fi.last_price)
                prev = float(fi.previous_close) if fi.previous_close else curr
                if curr and curr > 0:
                    pct = (curr - prev) / prev * 100 if prev else 0
                    vol = getattr(fi, "three_month_average_volume", None) or \
                          getattr(fi, "regular_market_volume", None) or 0
                    return {"price": round(curr, 2), "change_pct": round(pct, 2),
                            "change": round(curr - prev, 2),
                            "volume": int(vol)}
            except Exception as e1:
                logger.debug("yf_quote fast_info %s: %s", symbol, e1)

            # Strategy 2: history period 5d (more data, handles weekends/holidays)
            hist = t.history(period="5d")
            if not hist.empty and len(hist) >= 1:
                curr = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else curr
                pct  = (curr - prev) / prev * 100 if prev else 0
                vol  = hist["Volume"].iloc[-1] if "Volume" in hist.columns else 0
                return {"price": round(curr, 2), "change_pct": round(pct, 2),
                        "change": round(curr - prev, 2), "volume": int(vol)}

            # Strategy 3: yf.download fallback
            import pandas as pd
            df = yf.download(symbol, period="5d", progress=False, auto_adjust=True)
            if not df.empty:
                curr = float(df["Close"].iloc[-1])
                prev = float(df["Close"].iloc[-2]) if len(df) >= 2 else curr
                pct  = (curr - prev) / prev * 100 if prev else 0
                return {"price": round(curr, 2), "change_pct": round(pct, 2),
                        "change": round(curr - prev, 2), "volume": 0}

        except Exception as e:
            logger.warning("yf_quote %s attempt %d/%d: %s", symbol, attempt+1, retries, e)
            if attempt < retries - 1:
                _time.sleep(1.5 * (attempt + 1))
    return {}


def collect_batch_yf(symbols: dict) -> dict:
    """여러 심볼 yfinance 병렬 수집"""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    result = {}
    with ThreadPoolExecutor(max_workers=min(len(symbols), 6)) as pool:
        futures = {pool.submit(yf_quote, sym): name for name, sym in symbols.items()}
        for f in as_completed(futures):
            name = futures[f]
            try:
                result[name] = f.result()
            except Exception as e:
                logger.warning("collect_batch_yf %s: %s", name, e)
                result[name] = {}
    return result


def av_news_sentiment() -> list:
    """Alpha Vantage 뉴스 감성 (하루 1~2회만 호출)"""
    if not AV_KEY:
        return []
    try:
        r = httpx.get(AV_BASE, params={
            "function": "NEWS_SENTIMENT",
            "topics": "financial_markets,earnings,economy_monetary",
            "sort": "LATEST", "limit": 10, "apikey": AV_KEY,
        }, timeout=15)
        items = r.json().get("feed", [])
        news = []
        for item in items[:8]:
            news.append({
                "title":     item.get("title", "")[:100],
                "source":    item.get("source", ""),
                "sentiment": item.get("overall_sentiment_label", "Neutral"),
                "score":     round(float(item.get("overall_sentiment_score", 0)), 3),
                "summary":   item.get("summary", "")[:180],
                "url":       item.get("url", ""),
            })
        return news
    except Exception as e:
        logger.warning("av_news: %s", e)
        return []


def collect_fear_greed() -> dict:
    """CNN Fear & Greed Index"""
    try:
        r = httpx.get(
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
            headers={"User-Agent":"Mozilla/5.0","Referer":"https://edition.cnn.com"},
            timeout=10, follow_redirects=True,
        )
        fg = r.json().get("fear_and_greed", {})
        score  = round(float(fg.get("score", 50)), 1)
        rating = fg.get("rating", "Neutral")
        # 점수 -> 한국어 레이블
        if score >= 75:   label_kr = "극단적 탐욕"
        elif score >= 55: label_kr = "탐욕"
        elif score >= 45: label_kr = "중립"
        elif score >= 25: label_kr = "공포"
        else:             label_kr = "극단적 공포"
        return {"score": score, "rating": rating, "label_kr": label_kr}
    except Exception as e:
        logger.warning("fear_greed: %s", e)
        return {"score": 50, "rating": "Neutral", "label_kr": "중립"}


def collect_all() -> dict:
    logger.info("=== Data collection start (parallel) ===")
    now = datetime.now()
    from concurrent.futures import ThreadPoolExecutor, as_completed

    tasks = {
        "indices": lambda: collect_batch_yf(INDICES),
        "sectors": lambda: collect_batch_yf(SECTORS),
        "big_stocks": lambda: collect_batch_yf(BIG_STOCKS),
        "fx": lambda: collect_batch_yf(FX),
        "news": av_news_sentiment,
        "fear_greed": collect_fear_greed,
    }
    results = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fn): key for key, fn in tasks.items()}
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
            except Exception as e:
                logger.error("collect_all %s error: %s", key, e)
                results[key] = {} if key not in ("news", "fear_greed") else []

    indices    = results.get("indices", {})
    sectors    = results.get("sectors", {})
    stocks     = results.get("big_stocks", {})
    fx         = results.get("fx", {})
    news       = results.get("news", [])
    fear_greed = results.get("fear_greed", {})

    logger.info("=== Data collection done ===")
    return {
        "timestamp":     now.isoformat(),
        "date":          now.strftime("%Y-%m-%d"),
        "date_display":  now.strftime("%-m/%-d") if os.name != "nt" else now.strftime("%m/%d"),
        "weekday":       now.strftime("%A"),
        "indices":       indices,
        "sectors":       sectors,
        "big_stocks":    stocks,
        "fx":            fx,
        "news":          news,
        "fear_greed":    fear_greed,
    }


if __name__ == "__main__":
    import json
    d = collect_all()
    print(json.dumps(d, ensure_ascii=False, indent=2))
