"""
종목 분석 모듈
Alpha Vantage API로 실시간 주가 데이터 수집
"""

import os
import logging
import httpx
import anthropic
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

logger = logging.getLogger(__name__)

AV_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")


def claude_call(model: str, prompt: str, max_tokens: int = 700, max_retries: int = 3) -> str:
    """Anthropic API 호출 with rate limit 자동 재시도.
    429/rate_limit_error 발생 시 retry-after 헤더(또는 60s) 대기 후 재시도.
    """
    import time as _time
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    for attempt in range(max_retries):
        try:
            msg = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        except anthropic.RateLimitError as e:
            wait = 60
            # 헤더에서 retry-after 파싱 시도
            try:
                hdr = getattr(e, "response", None)
                if hdr is not None:
                    ra = hdr.headers.get("retry-after") or hdr.headers.get("x-ratelimit-reset-requests")
                    if ra:
                        wait = max(int(float(ra)), 5)
            except Exception:
                pass
            if attempt < max_retries - 1:
                logger.warning("Claude rate limit (attempt %d/%d). Waiting %ds...", attempt + 1, max_retries, wait)
                _time.sleep(wait)
            else:
                logger.error("Claude rate limit exhausted after %d attempts", max_retries)
                raise
        except anthropic.APIStatusError as e:
            if e.status_code == 529 and attempt < max_retries - 1:
                # Overloaded
                logger.warning("Claude overloaded, waiting 30s...")
                _time.sleep(30)
            else:
                raise
AV_BASE = "https://www.alphavantage.co/query"

KR_TO_TICKER = {
    # 한국 대형주
    "삼성전자": "005930.KS", "sk하이닉스": "000660.KS", "하이닉스": "000660.KS",
    "lg에너지솔루션": "373220.KS", "lg에너지": "373220.KS",
    "삼성바이오로직스": "207940.KS", "삼성바이오": "207940.KS",
    "현대차": "005380.KS", "현대자동차": "005380.KS",
    "기아": "000270.KS", "기아차": "000270.KS",
    "카카오": "035720.KS", "카카오뱅크": "323410.KS",
    "네이버": "035420.KS",
    "셀트리온": "068270.KS", "포스코": "005490.KS", "포스코홀딩스": "005490.KS",
    "lg전자": "066570.KS", "엘지전자": "066570.KS",
    "한화에어로스페이스": "012450.KS", "한화에어로": "012450.KS",
    "두산에너빌리티": "034020.KS", "두산": "034020.KS",
    "크래프톤": "259960.KS", "하이브": "352820.KS",
    "kb금융": "105560.KS", "신한지주": "055550.KS",
    # 미국 빅테크
    "엔비디아": "NVDA", "애플": "AAPL", "마이크로소프트": "MSFT",
    "테슬라": "TSLA", "아마존": "AMZN", "메타": "META",
    "알파벳": "GOOGL", "구글": "GOOGL", "넷플릭스": "NFLX",
    "팔란티어": "PLTR", "브로드컴": "AVGO", "암": "ARM",
    # 미국 반도체
    "마이크론": "MU", "인텔": "INTC", "에이엠디": "AMD",
    "퀄컴": "QCOM", "램리서치": "LRCX",
    # 미국 기타
    "코인베이스": "COIN", "우버": "UBER", "에어비앤비": "ABNB",
    "버크셔해서웨이": "BRK-B", "워렌버핏": "BRK-B",
    # 암호화폐
    "비트코인": "BTC-USD", "bitcoin": "BTC-USD", "btc": "BTC-USD",
    "이더리움": "ETH-USD", "ethereum": "ETH-USD", "eth": "ETH-USD",
    "솔라나": "SOL-USD", "xrp": "XRP-USD", "리플": "XRP-USD",
    "도지코인": "DOGE-USD", "도지": "DOGE-USD",
}


def resolve_ticker(query: str) -> str:
    q = query.strip().lower()
    for kr, ticker in KR_TO_TICKER.items():
        if kr in q:
            return ticker
    upper = query.strip().upper()
    if all(c.isalpha() or c in (".", "-") for c in upper) and len(upper) <= 10:
        return upper
    return None


def fetch_quote(ticker: str) -> dict | None:
    """Alpha Vantage GLOBAL_QUOTE — 현재가, 등락률, 거래량 (60s TTL cached)"""
    from cache import quote_cache, analysis_cache
    cached = quote_cache.get(ticker)
    if cached is not None:
        return cached
    import time
    for attempt in range(3):
        try:
            r = httpx.get(AV_BASE, params={
                "function": "GLOBAL_QUOTE",
                "symbol": ticker,
                "apikey": AV_KEY,
            }, timeout=15)
            body = r.json()
            logger.info("AV GLOBAL_QUOTE ok: symbol=%s", ticker)

            # Rate limit 메시지 감지 → 재시도
            if "Note" in body or "Information" in body:
                logger.warning(f"AV rate limit attempt {attempt+1}")
                if attempt < 2:
                    time.sleep(15)
                    continue
                return None

            q = body.get("Global Quote", {})
            if not q or not q.get("05. price"):
                return None

            result = {
                "ticker": ticker,
                "price": float(q["05. price"]),
                "change": float(q["09. change"]),
                "change_pct": float(q["10. change percent"].replace("%", "")),
                "high": float(q["03. high"]),
                "low": float(q["04. low"]),
                "prev_close": float(q["08. previous close"]),
                "volume": q["06. volume"],
                "latest_day": q["07. latest trading day"],
            }
            quote_cache.set(ticker, result)
            return result
        except Exception as e:
            logger.error(f"fetch_quote error: {e}")
            return None
    return None


def fetch_overview(ticker: str) -> dict:
    """Alpha Vantage OVERVIEW — 회사명, PER, 52주 고저, 섹터 등"""
    try:
        r = httpx.get(AV_BASE, params={
            "function": "OVERVIEW",
            "symbol": ticker,
            "apikey": AV_KEY,
        }, timeout=15)
        d = r.json()
        if not d or "Symbol" not in d:
            return {}
        return {
            "name": d.get("Name", ticker),
            "sector": d.get("Sector", "N/A"),
            "pe_ratio": d.get("TrailingPE", "N/A"),
            "market_cap": d.get("MarketCapitalization"),
            "52w_high": d.get("52WeekHigh"),
            "52w_low": d.get("52WeekLow"),
            "description": d.get("Description", "")[:250],
            "eps": d.get("EPS", "N/A"),
        }
    except Exception as e:
        logger.warning(f"fetch_overview error: {e}")
        return {}


def fmt_market_cap(val: str | None) -> str:
    if not val or val == "None":
        return "N/A"
    try:
        v = int(val)
        if v >= 1_000_000_000_000:
            return f"${v/1_000_000_000_000:.1f}T"
        if v >= 1_000_000_000:
            return f"${v/1_000_000_000:.1f}B"
        return f"${v/1_000_000:.1f}M"
    except Exception:
        return val


def analyze_stock(query: str) -> str:
    ticker = resolve_ticker(query)
    if not ticker:
        return f"❌ '{query}'에 해당하는 종목을 찾을 수 없어요.\n\n예시: NVDA, 삼성전자, 테슬라"

    if not AV_KEY:
        return "⚠️ 종목 분석 API 키가 설정되지 않았습니다. 관리자에게 문의하세요."

    quote = fetch_quote(ticker)
    if not quote:
        return f"❌ {ticker} 데이터를 가져올 수 없어요. 잠시 후 다시 시도해주세요."

    overview = fetch_overview(ticker)

    arrow = "▲" if quote["change_pct"] >= 0 else "▼"
    direction = "상승" if quote["change_pct"] >= 0 else "하락"
    name = overview.get("name") or ticker

    lines = [
        "Write a Korean stock analysis report for individual Korean investors.",
        "Use Telegram message format, emojis, under 350 chars, note it is not investment advice.",
        "",
        f"=== Real-time Data ({quote['latest_day']}) ===",
        f"Stock: {name} ({ticker})",
        f"Price: ${quote['price']:.2f} ({arrow}{abs(quote['change_pct']):.2f}% {direction})",
        f"Change: ${quote['change']:+.2f} vs prev close ${quote['prev_close']:.2f}",
        f"Day range: ${quote['low']:.2f} ~ ${quote['high']:.2f}",
        f"Volume: {quote['volume']}",
        f"Market Cap: {fmt_market_cap(overview.get('market_cap'))}",
        f"52W High: ${overview.get('52w_high', 'N/A')} / Low: ${overview.get('52w_low', 'N/A')}",
        f"PER: {overview.get('pe_ratio', 'N/A')} / EPS: {overview.get('eps', 'N/A')}",
        f"Sector: {overview.get('sector', 'N/A')}",
        f"Description: {overview.get('description', '')}",
        "",
        "Output format (Korean):",
        f"<emoji> {name} ({ticker}) analysis",
        "(current price and change 1-2 lines)",
        "(52W position and valuation 1 line)",
        "(key investment points 1-2 lines)",
        "Warning: not investment advice.",
    ]
    prompt = "\n".join(lines)

    return claude_call("claude-haiku-4-5", prompt, max_tokens=500)


if __name__ == "__main__":
    for q in ["NVDA", "삼성전자", "테슬라"]:
        print(f"\n=== {q} ===")
        print(analyze_stock(q))


def compare_stocks(query: str) -> str:
    """두 종목 비교: /compare NVDA TSLA"""
    parts = query.strip().split()
    tickers = [resolve_ticker(p) for p in parts if resolve_ticker(p)]
    tickers = list(dict.fromkeys(tickers))[:2]  # 중복 제거, 최대 2개

    if len(tickers) < 2:
        return "비교할 종목 2개를 입력해주세요.\n예시: /compare NVDA TSLA\n예시: /compare 엔비디아 테슬라"

    t1, t2 = tickers[0], tickers[1]
    q1, q2 = fetch_quote(t1), fetch_quote(t2)

    if not q1 or not q2:
        return f"데이터 조회 실패: {t1 if not q1 else t2}\n잠시 후 다시 시도해주세요."

    ov1 = fetch_overview(t1)
    ov2 = fetch_overview(t2)

    def pct_bar(pct):
        if pct is None: return "N/A"
        arrow = "▲" if pct >= 0 else "▼"
        return f"{arrow}{abs(pct):.2f}%"

    n1 = ov1.get("name") or t1
    n2 = ov2.get("name") or t2

    # 데이터 테이블 먼저 구성 (AI 전에 즉시 표시)
    def pos_52w(price, high, low):
        try:
            h, l = float(high), float(low)
            pct = (price - l) / (h - l) * 100
            return f"{pct:.0f}% (52주 범위)"
        except Exception:
            return "N/A"

    table = (
        f"<b>⚖️ {t1} vs {t2} 비교</b>\n\n"
        f"<code>"
        f"{'항목':<8} {t1:<10} {t2:<10}\n"
        f"{'현재가':<8} ${q1['price']:>8.2f} ${q2['price']:>8.2f}\n"
        f"{'등락률':<8} {pct_bar(q1['change_pct']):>10} {pct_bar(q2['change_pct']):>10}\n"
        f"{'PER':<8} {str(ov1.get('pe_ratio','N/A')):>10} {str(ov2.get('pe_ratio','N/A')):>10}\n"
        f"{'52주위치':<8} {pos_52w(q1['price'],ov1.get('52w_high',0),ov1.get('52w_low',0)):>10} {pos_52w(q2['price'],ov2.get('52w_high',0),ov2.get('52w_low',0)):>10}\n"
        f"</code>"
    )

    prompt = f"""You are comparing {t1} ({n1}) vs {t2} ({n2}) for Korean retail investors.
Write ONLY the AI analysis part in Korean. No data table (already shown). MAX 280 chars.

Data:
{t1}: ${q1['price']:.2f} {pct_bar(q1['change_pct'])} PER={ov1.get('pe_ratio','N/A')} mktcap={fmt_market_cap(ov1.get('market_cap'))}
{t2}: ${q2['price']:.2f} {pct_bar(q2['change_pct'])} PER={ov2.get('pe_ratio','N/A')} mktcap={fmt_market_cap(ov2.get('market_cap'))}

Format:
[단기 퍼포먼스 비교 한줄]
[밸류에이션 관점 비교 한줄]
[결론: 🏆 {t1} 우위 or 🏆 {t2} 우위 + 이유]
*투자 참고용*"""

    ai_text = claude_call("claude-haiku-4-5", prompt, max_tokens=400)
    return table + "\n\n" + ai_text


def summarize_news(ticker: str = "") -> str:
    """Alpha Vantage 뉴스를 Claude로 한국어 요약 (5분 캐싱). ticker 지정시 종목별 뉴스."""
    import yfinance as yf
    from cache import news_cache

    if ticker:
        cache_key = f"news_{ticker}"
        cached = news_cache.get(cache_key)
        if cached:
            return cached
        # yfinance 뉴스 사용 (AV 무료 한도 절약)
        try:
            t = yf.Ticker(ticker)
            raw_news = t.news or []
            if not raw_news:
                return f"{ticker} 관련 뉴스를 찾을 수 없습니다."
            # 가격 정보도 함께 가져오기
            q = fetch_quote(ticker)
            price_ctx = f"{ticker} 현재가: ${q['price']:.2f} ({'+' if q['change_pct']>=0 else ''}{q['change_pct']:.2f}%)\n" if q else ""
            news_text = "\n".join([
                f"- {item.get('content',{}).get('title', item.get('title',''))}"
                for item in raw_news[:5]
            ])
            prompt = f"""You are a sharp Korean financial analyst. Analyze these {ticker} news for Korean retail investors.
{price_ctx}
For EACH headline: write one Korean sentence with SPECIFIC numbers/facts + 🟢호재/🔴악재/🟡중립 tag.
End with: "투자 포인트: [1 actionable sentence for Korean investors]"
Korean only. Max 550 chars total.

Headlines:
{news_text}"""
            result = (
                f"📰 <b>{ticker} 뉴스 분석</b>"
                + (f"\n현재가 <b>${q['price']:.2f}</b> ({'+' if q['change_pct']>=0 else ''}{q['change_pct']:.2f}%)" if q else "")
                + "\n\n"
                + claude_call("claude-haiku-4-5", prompt, max_tokens=600)
            )
            news_cache.set(cache_key, result)
            return result
        except Exception as e:
            return f"{ticker} 뉴스 조회 중 오류: {e}"

    today_key = f"news_summary_{__import__('datetime').date.today().isoformat()}"
    cached = news_cache.get(today_key)
    if cached:
        return cached

    from collector import av_news_sentiment
    news = av_news_sentiment()
    if not news:
        return "뉴스 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요."

    # 감성별 분류
    bullish = [n for n in news if n.get("sentiment") == "Bullish"][:2]
    bearish = [n for n in news if n.get("sentiment") == "Bearish"][:2]
    neutral = [n for n in news if n.get("sentiment") not in ("Bullish","Bearish")][:2]
    ordered_news = bullish + bearish + neutral

    news_text = "\n".join([
        f"- [{item['sentiment']}] {item['title']}"
        for item in ordered_news[:6]
    ])

    today_str = __import__('datetime').date.today().strftime('%m/%d')
    prompt = f"""You are a sharp Korean financial analyst for retail investors. Today is {today_str}.

Rules (MUST FOLLOW):
- For EACH news: 1 Korean sentence with SPECIFIC stock name/number if possible + 🟢호재/🔴악재/🟡중립
- Mention which Korean stocks (삼성전자, SK하이닉스, etc.) could be affected
- End with: "오늘의 핵심: [1 bold actionable Korean sentence]"
- Korean only. Max 700 chars total.

News (already sentiment-tagged):
{news_text}"""

    result = claude_call("claude-haiku-4-5", prompt, max_tokens=750)
    # 헤더 추가
    result = f"📰 <b>{today_str} 월가 뉴스 분석</b>\n\n" + result
    news_cache.set(today_key, result)
    return result


def portfolio_health_score(quotes: dict) -> tuple[int, str]:
    """포트폴리오 건강도 점수 (0-100) + 등급"""
    if not quotes:
        return 0, "F"
    score = 70  # 기본점수

    # 분산도: 종목 수 (2~10개 최적)
    n = len(quotes)
    if n >= 5:
        score += 10
    elif n >= 3:
        score += 5
    elif n == 1:
        score -= 15  # 단일종목 리스크

    # 등락률 분포: 상승 비율
    pcts = [q.get("change_pct", 0) for q in quotes.values()]
    up_ratio = sum(1 for p in pcts if p > 0) / len(pcts)
    score += int(up_ratio * 20) - 10  # -10 ~ +10

    # 변동성: 최대 등락 차이
    if pcts:
        spread = max(pcts) - min(pcts)
        if spread > 10:
            score -= 10  # 고변동성 패널티
        elif spread < 3:
            score += 5   # 안정성 보너스

    score = max(0, min(100, score))
    if score >= 80:
        grade = "A"
    elif score >= 65:
        grade = "B"
    elif score >= 50:
        grade = "C"
    elif score >= 35:
        grade = "D"
    else:
        grade = "F"
    return score, grade


def analyze_portfolio(tickers: list[str]) -> str:
    """관심종목 포트폴리오 AI 진단 (종목별 매수/매도/관망 + 총평)"""
    if not tickers:
        return "관심종목이 없습니다. /watchlist add NVDA 로 추가해주세요."

    from concurrent.futures import ThreadPoolExecutor, as_completed
    quotes = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fetch_quote, t): t for t in tickers[:8]}
        for f in as_completed(futures):
            t = futures[f]
            try:
                q = f.result()
                if q:
                    quotes[t] = q
            except Exception:
                pass

    if not quotes:
        return "종목 데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요."

    # 성과 데이터 계산
    pcts = [(t, quotes[t].get("change_pct", 0) or 0) for t in tickers[:8] if t in quotes]
    pcts_sorted = sorted(pcts, key=lambda x: x[1], reverse=True)
    best = pcts_sorted[0] if pcts_sorted else None
    worst = pcts_sorted[-1] if pcts_sorted else None
    up_count = sum(1 for _, p in pcts if p >= 0)
    down_count = len(pcts) - up_count

    def mini_bar(pct: float) -> str:
        blocks = min(abs(int(pct // 0.5)), 6)
        filled = "█" * blocks
        empty = "░" * (6 - blocks)
        arrow = "+" if pct >= 0 else ""
        if pct >= 0:
            return f"{filled}{empty} {arrow}{pct:.2f}%"
        else:
            return f"{empty}{filled} {pct:.2f}%"

    # 종목별 성과 표
    stock_table_lines = []
    for ticker in tickers[:8]:
        q = quotes.get(ticker)
        if not q:
            continue
        pct = q.get("change_pct", 0) or 0
        bar = mini_bar(pct)
        stock_table_lines.append(f"{ticker:<6} {bar}")

    stock_table = "\n".join(stock_table_lines)

    # AI 프롬프트
    portfolio_text = "\n".join(
        f"- {t}: ${quotes[t]['price']:.2f} ({'+' if quotes[t]['change_pct']>=0 else ''}{quotes[t]['change_pct']:.2f}%)"
        for t in tickers[:8] if t in quotes
    )
    prompt = f"""You are a portfolio advisor for Korean retail investors.
For EACH stock below, give ONE short Korean line: signal emoji + reason.
Then 2-line 총평.
Signals: 🟢 매수, 🟡 관망, 🔴 매도
Max 550 chars total. Korean only.

Format exactly:
[TICKER] 🟢/🟡/🔴: reason
...

총평: two-line comment

Holdings:
{portfolio_text}"""

    score, grade = portfolio_health_score(quotes)
    score_bar = "█" * (score // 10) + "░" * (10 - score // 10)
    grade_emoji = {"A": "🟢", "B": "🟡", "C": "🟠", "D": "🔴", "F": "⚫"}.get(grade, "⚪")

    best_str = f"{best[0]} {'+' if best[1]>=0 else ''}{best[1]:.2f}%" if best else "N/A"
    worst_str = f"{worst[0]} {worst[1]:.2f}%" if worst else "N/A"

    header = (
        f"<b>📊 포트폴리오 AI 진단</b>\n\n"
        f"<b>건강도</b>: {grade_emoji} {score}/100 (등급 {grade})\n"
        f"<code>{score_bar}</code>\n\n"
        f"<b>오늘 성과</b> | 상승 {up_count}개 · 하락 {down_count}개\n"
        f"<code>{'종목':<6} {'성과 막대':>20}\n"
        f"{stock_table}</code>\n\n"
        f"<b>베스트</b>: {best_str}  <b>워스트</b>: {worst_str}\n\n"
        f"<b>AI 신호</b>\n"
    )
    ai_text = claude_call("claude-haiku-4-5", prompt, max_tokens=600)
    return header + ai_text + "\n\n<i>*투자 참고용. 실제 결정은 본인 판단으로*</i>"


def analyze_outlook(ticker: str) -> str:
    """단기 주간 전망 AI 분석"""
    q = fetch_quote(ticker)
    ov = fetch_overview(ticker)

    if not q:
        return f"{ticker} 데이터를 가져올 수 없습니다."

    price_info = f"{ticker}: ${q['price']:.2f} ({'+' if q['change_pct']>=0 else ''}{q['change_pct']:.2f}%)"
    pe_info = f"PER: {ov.get('pe_ratio','N/A')}" if ov else ""
    sector_info = f"섹터: {ov.get('sector','N/A')}" if ov else ""
    high52 = ov.get('52w_high', 'N/A') if ov else 'N/A'
    low52 = ov.get('52w_low', 'N/A') if ov else 'N/A'

    prompt = f"""You are a Korean stock market analyst providing a weekly outlook.
Write a concise Korean-language weekly outlook for {ticker}.
Be specific, mention key catalysts, risks, and price targets if relevant.
Use emojis. MAX 450 chars.

Current data:
{price_info}
52W High: ${high52} | 52W Low: ${low52}
{pe_info} | {sector_info}

Format:
[ticker + current price line]
[positioning: where in 52W range, momentum]
[2 key catalysts to watch this week]
[risk factor]
[1-line verdict: buy/hold/watch with reasoning]"""

    return claude_call("claude-haiku-4-5", prompt, max_tokens=600)


def analyze_macro() -> str:
    """매크로 시황: 금리/DXY/오일/VIX/금 + AI 한국어 해설"""
    import yfinance as yf
    from cache import quote_cache, analysis_cache

    cached = quote_cache.get("macro_analysis")
    if cached:
        return cached

    MACRO_TICKERS = {
        "VIX": "^VIX",
        "DXY": "DX-Y.NYB",
        "US10Y": "^TNX",
        "US2Y": "^IRX",
        "OIL(WTI)": "CL=F",
        "GOLD": "GC=F",
        "TLT(Bond)": "TLT",
        "BTC": "BTC-USD",
    }
    rows = []
    for label, sym in MACRO_TICKERS.items():
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="2d", interval="1d")
            if len(hist) >= 2:
                prev = hist["Close"].iloc[-2]
                cur  = hist["Close"].iloc[-1]
                pct  = (cur - prev) / prev * 100
                sign = "+" if pct >= 0 else ""
                rows.append(f"{label}: {cur:.2f} ({sign}{pct:.2f}%)")
            elif len(hist) == 1:
                rows.append(f"{label}: {hist['Close'].iloc[-1]:.2f}")
        except Exception:
            pass

    data_text = "\n".join(rows) if rows else "No data"
    prompt = f"""You are a macro analyst briefing Korean retail investors.
Interpret these macro indicators and explain what they mean for Korean stock investors (KOSPI/KOSDAQ, Samsung, SK Hynix, etc).
Write ONLY in Korean. Use emojis. Be specific and actionable. MAX 600 chars.

Format:
Line 1: Bold header "매크로 시황 {__import__('datetime').date.today()}"
Lines 2-4: Key observations (VIX fear level, dollar strength impact on KRW, oil impact on inflation)
Line 5: One concrete Korean stock action item

Data:
{data_text}"""

    ai_text = claude_call("claude-haiku-4-5", prompt, max_tokens=700)
    result = "<b>🌐 매크로 시황</b>\n\n" + "<code>" + "\n".join(rows) + "</code>\n\n" + ai_text
    quote_cache.set("macro_analysis", result)
    return result


def one_line_summary() -> str:
    """오늘 시장 150자 한줄 요약"""
    from cache import quote_cache, analysis_cache
    cached = quote_cache.get("one_line")
    if cached:
        return cached

    import yfinance as yf
    from datetime import date
    try:
        sp = yf.Ticker("^GSPC").history(period="2d")
        nq = yf.Ticker("^IXIC").history(period="2d")
        sp_pct = ((sp["Close"].iloc[-1] - sp["Close"].iloc[-2]) / sp["Close"].iloc[-2] * 100) if len(sp) >= 2 else 0
        nq_pct = ((nq["Close"].iloc[-1] - nq["Close"].iloc[-2]) / nq["Close"].iloc[-2] * 100) if len(nq) >= 2 else 0
        vix = yf.Ticker("^VIX").history(period="1d")["Close"].iloc[-1] if True else 20
        sp_str = f"S&P500 {'+' if sp_pct>=0 else ''}{sp_pct:.1f}%"
        nq_str = f"NASDAQ {'+' if nq_pct>=0 else ''}{nq_pct:.1f}%"
        context = f"Date: {date.today()}, {sp_str}, {nq_str}, VIX: {vix:.1f}"
    except Exception:
        context = f"Date: {date.today()}"

    prompt = (
        f"Write a single Korean sentence (max 100 chars) summarizing today's US market for Korean investors. "
        f"Start with an emoji. Include 1 key number. End with '내일 주목:' + one thing to watch.\n"
        f"Data: {context}\nOutput ONLY the sentence, no explanation."
    )
    result = claude_call("claude-haiku-4-5", prompt, max_tokens=150).strip()
    quote_cache.set("one_line", result)
    return result


def weekly_summary() -> str:
    """이번 주 시장 성적표"""
    from cache import quote_cache, analysis_cache
    cached = quote_cache.get("weekly_summary")
    if cached:
        return cached

    import yfinance as yf
    symbols = {"S&P500": "^GSPC", "NASDAQ": "^IXIC", "DOW": "^DJI", "반도체(SMH)": "SMH", "빅테크(QQQ)": "QQQ"}
    lines = ["<b>📅 이번 주 시장 성적표</b>\n"]
    for name, sym in symbols.items():
        try:
            hist = yf.Ticker(sym).history(period="5d")
            if len(hist) >= 2:
                start = hist["Close"].iloc[0]
                end = hist["Close"].iloc[-1]
                pct = (end - start) / start * 100
                sign = "+" if pct >= 0 else ""
                arrow = "▲" if pct >= 0 else "▼"
                lines.append(f"{name}: {arrow}{sign}{pct:.2f}%")
        except Exception:
            pass
    result = "\n".join(lines)
    quote_cache.set("weekly_summary", result)
    return result


def sparkline(prices: list) -> str:
    """리스트를 스파크라인 문자열로 변환 (▁▂▃▄▅▆▇█)"""
    if not prices or len(prices) < 2:
        return ""
    chars = "▁▂▃▄▅▆▇█"
    mn, mx = min(prices), max(prices)
    rng = mx - mn or 1
    return "".join(chars[int((p - mn) / rng * 7)] for p in prices)


def get_price_chart(ticker: str, days: int = 30) -> str:
    """종목 가격 스파크라인 + 요약 통계"""
    import yfinance as yf
    from cache import quote_cache, analysis_cache
    cache_key = f"chart_{ticker}_{days}"
    cached = quote_cache.get(cache_key)
    if cached:
        return cached
    try:
        hist = yf.Ticker(ticker).history(period=f"{days}d")
        if hist.empty:
            return f"{ticker} 차트 데이터 없음"
        prices = [round(float(p), 2) for p in hist["Close"].tolist()]
        spark = sparkline(prices)
        start_price = prices[0]
        end_price = prices[-1]
        pct = (end_price - start_price) / start_price * 100
        high = max(prices)
        low = min(prices)
        sign = "+" if pct >= 0 else ""
        trend_arrow = "📈" if pct >= 0 else "📉"
        result = (
            f"{trend_arrow} <b>{ticker} {days}일 차트</b>\n\n"
            f"<code>{spark}</code>\n\n"
            f"현재: ${end_price:,.2f} ({sign}{pct:.2f}%)\n"
            f"고가: ${high:,.2f} | 저가: ${low:,.2f}\n"
            f"기간: {days}일"
        )
        quote_cache.set(cache_key, result)
        return result
    except Exception as e:
        return f"{ticker} 차트 조회 실패: {e}"


# ── 섹터 ETF 분석 ────────────────────────────────────────────────
SECTOR_ETFS = {
    "XLK": "기술",
    "XLF": "금융",
    "XLE": "에너지",
    "XLV": "헬스케어",
    "XLC": "커뮤니케이션",
    "XLI": "산업재",
    "XLY": "경기소비재",
    "XLP": "필수소비재",
    "XLRE": "부동산",
    "XLB": "소재",
    "XLU": "유틸리티",
}

SECTOR_KR_STOCKS = {
    "XLK": "삼성전자, SK하이닉스, 네이버",
    "XLF": "카카오뱅크, 신한지주, KB금융",
    "XLE": "S-Oil, SK이노베이션",
    "XLV": "삼성바이오로직스, 셀트리온",
    "XLC": "카카오, NAVER, LG유플러스",
    "XLI": "현대차, 기아, LG전자",
    "XLY": "현대차, 기아, 롯데쇼핑",
    "XLP": "CJ제일제당, 농심",
    "XLRE": "삼성물산, GS건설",
    "XLB": "POSCO홀딩스, LG화학",
    "XLU": "한국전력, 한국가스공사",
}


def analyze_sectors() -> str:
    """SPDR 섹터 ETF 현황 + 섹터 로테이션 AI 분석"""
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "sector_analysis"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def fetch_etf(sym: str):
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="2d")
            if hist.empty or len(hist) < 2:
                return sym, None
            prev = float(hist["Close"].iloc[-2])
            curr = float(hist["Close"].iloc[-1])
            pct = (curr - prev) / prev * 100
            return sym, {"price": curr, "change_pct": pct}
        except Exception:
            return sym, None

    etf_data = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_etf, sym): sym for sym in SECTOR_ETFS}
        for f in as_completed(futures):
            sym, data = f.result()
            if data:
                etf_data[sym] = data

    if not etf_data:
        return "섹터 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요."

    # 성과 순으로 정렬
    sorted_etfs = sorted(etf_data.items(), key=lambda x: x[1]["change_pct"], reverse=True)

    def bar(pct: float) -> str:
        blocks = min(abs(int(pct // 0.3)), 8)
        filled = chr(9608) * blocks  # '█'
        empty = chr(9617) * (8 - blocks)  # '░'
        sign = "+" if pct >= 0 else ""
        return f"{filled}{empty} {sign}{pct:.2f}%"

    lines = ["<b>📊 섹터 ETF 성적표</b>\n"]
    data_for_ai = []
    for sym, d in sorted_etfs:
        name = SECTOR_ETFS.get(sym, sym)
        b = bar(d["change_pct"])
        icon = "▲" if d["change_pct"] >= 0 else "▼"
        lines.append(f"<code>{name[:4]:<4} {b}</code>")
        data_for_ai.append(f"{sym}({name}): {'+' if d['change_pct']>=0 else ''}{d['change_pct']:.2f}%")

    header = "\n".join(lines) + "\n"

    # 1위/꼴찌 섹터
    top_sym, top_d = sorted_etfs[0]
    bot_sym, bot_d = sorted_etfs[-1]
    top_name = SECTOR_ETFS[top_sym]
    bot_name = SECTOR_ETFS[bot_sym]
    top_kr = SECTOR_KR_STOCKS.get(top_sym, "")
    bot_kr = SECTOR_KR_STOCKS.get(bot_sym, "")

    prompt = f"""You are a sector rotation expert analyst for Korean retail investors.
Given today's US sector ETF performance, analyze in Korean (max 400 chars):
1. Why the top sector ({top_name} +{top_d['change_pct']:.2f}%) is leading — specific catalyst
2. Why the bottom sector ({bot_name} {bot_d['change_pct']:.2f}%) is lagging — specific reason
3. One actionable sentence for Korean investors considering {top_kr} (top) and {bot_kr} (bottom)

Be specific with numbers. Korean only.

All sectors: {', '.join(data_for_ai)}"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=500)
    result = header + "\n" + ai
    analysis_cache.set(cache_key, result)
    return result


# ── 52주 신고가/신저가 스캐너 ─────────────────────────────────────
WATCHLIST_50 = [
    "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","BRK-B","JPM","V",
    "UNH","XOM","JNJ","WMT","LLY","MA","PG","AVGO","HD","CVX",
    "MRK","ABBV","KO","PEP","COST","ADBE","MCD","CRM","BAC","AMD",
    "ACN","TMO","DHR","LIN","NEE","TXN","QCOM","ORCL","INTC","INTU",
    "IBM","GS","BLK","AMGN","GILD","REGN","MDLZ","DUK","SO","GE",
]


def scan_52week() -> str:
    """S&P500 주요 50종목 중 52주 신고가/신저가 5% 이내 종목 스캔"""
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "scan_52w"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    near_high = []
    near_low = []

    def check_ticker(sym: str):
        try:
            t = yf.Ticker(sym)
            info = t.info
            curr = info.get("currentPrice") or info.get("regularMarketPrice")
            h52 = info.get("fiftyTwoWeekHigh")
            l52 = info.get("fiftyTwoWeekLow")
            if not curr or not h52 or not l52:
                return sym, None
            pct_from_high = (curr - h52) / h52 * 100  # 음수
            pct_from_low = (curr - l52) / l52 * 100   # 양수
            return sym, {"price": curr, "h52": h52, "l52": l52,
                         "pct_from_high": pct_from_high, "pct_from_low": pct_from_low}
        except Exception:
            return sym, None

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(check_ticker, s): s for s in WATCHLIST_50[:30]}
        for f in as_completed(futures):
            sym, data = f.result()
            if not data:
                continue
            if data["pct_from_high"] >= -5:  # 고가 5% 이내
                near_high.append((sym, data))
            elif data["pct_from_low"] <= 5:  # 저가 5% 이내
                near_low.append((sym, data))

    near_high.sort(key=lambda x: x[1]["pct_from_high"], reverse=True)
    near_low.sort(key=lambda x: x[1]["pct_from_low"])

    lines = ["<b>📈 52주 신고가 근접 (5% 이내)</b>"]
    if near_high:
        for sym, d in near_high[:5]:
            pct = d["pct_from_high"]
            lines.append(f"  {sym}: ${d['price']:.1f} | 고가 ${d['h52']:.1f} ({pct:.1f}%)")
    else:
        lines.append("  해당 종목 없음")

    lines.append("\n<b>📉 52주 신저가 근접 (5% 이내)</b>")
    if near_low:
        for sym, d in near_low[:5]:
            pct = d["pct_from_low"]
            lines.append(f"  {sym}: ${d['price']:.1f} | 저가 ${d['l52']:.1f} (+{pct:.1f}%)")
    else:
        lines.append("  해당 종목 없음")

    lines.append(f"\n<i>S&P500 상위 30종목 기준 | 5분 캐시</i>")

    result = "\n".join(lines)
    analysis_cache.set(cache_key, result)
    return result


# ── 고배당 종목 스크리너 ──────────────────────────────────────────
DIVIDEND_STOCKS = ["T", "VZ", "XOM", "CVX", "PFE", "MO", "PM", "IBM", "KO", "PEP",
                   "JNJ", "MMM", "WBA", "ABBV", "INTC", "VLO", "MPC", "OKE", "EPD", "ET"]


def analyze_dividend_stocks() -> str:
    """고배당 종목 스크리너: 배당수익률 상위 + AI 분석"""
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "dividend_analysis"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def fetch_div(sym: str):
        try:
            info = yf.Ticker(sym).info
            price = info.get("currentPrice") or info.get("regularMarketPrice", 0)
            div_yield = info.get("dividendYield", 0) or 0
            div_rate = info.get("dividendRate", 0) or 0
            payout = info.get("payoutRatio", 0) or 0
            name = info.get("shortName", sym)
            sector = info.get("sector", "")
            return sym, {
                "name": name, "sector": sector, "price": price,
                "div_yield": div_yield * 100, "div_rate": div_rate,
                "payout": payout * 100 if payout else None,
            }
        except Exception:
            return sym, None

    data = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_div, s): s for s in DIVIDEND_STOCKS}
        for f in as_completed(futures):
            sym, d = f.result()
            if d and d["div_yield"] > 0:
                data[sym] = d

    if not data:
        return "배당 데이터를 가져올 수 없습니다."

    sorted_stocks = sorted(data.items(), key=lambda x: x[1]["div_yield"], reverse=True)[:10]

    lines = ["<b>💰 고배당 TOP 10</b> (배당수익률 기준)\n"]
    ai_data = []
    for sym, d in sorted_stocks:
        payout_str = f" 지급률:{d['payout']:.0f}%" if d["payout"] else ""
        lines.append(
            f"<b>{sym}</b> {d['div_yield']:.2f}% | ${d['price']:.1f} | 연${d['div_rate']:.2f}{payout_str}"
        )
        ai_data.append(f"{sym}({d['name']}): 수익률{d['div_yield']:.1f}%, 지급률{d['payout']:.0f}%" if d["payout"] else f"{sym}: {d['div_yield']:.1f}%")

    top3 = sorted_stocks[:3]
    prompt = f"""You are a dividend investing expert for Korean retail investors.
Briefly analyze in Korean (max 380 chars):
1. Which of the top 3 dividend stocks ({', '.join(s for s,_ in top3)}) is most attractive now and why (1 line each)
2. Warning: any stocks with unsustainably high payout ratio (>80%)?
3. One sentence: are dividend stocks a good idea right now vs growth stocks?
Korean only.

Data: {', '.join(ai_data[:6])}"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=450)
    result = "\n".join(lines) + "\n\n" + ai + "\n\n<i>*배당 투자는 장기 보유 기준. 세금 고려 필수*</i>"
    analysis_cache.set(cache_key, result)
    return result


# ── 모멘텀 스크리너 ─────────────────────────────────────────────
MOMENTUM_UNIVERSE = [
    "NVDA","AAPL","MSFT","GOOGL","AMZN","META","TSLA","AMD","AVGO","ORCL",
    "PLTR","ARM","SMCI","MSTR","COIN","RBLX","SNAP","UBER","LYFT","ABNB",
    "SHOP","CRWD","PANW","SNOW","DDOG","ZS","NET","OKTA","MDB","GTLB",
]


def analyze_momentum() -> str:
    """모멘텀 스크리너: RSI + MA 돌파 + 거래량 급증"""
    import yfinance as yf
    import numpy as np
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "momentum_scan"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def compute_rsi(closes: list, period: int = 14) -> float:
        if len(closes) < period + 1:
            return 50.0
        deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
        gains = [d if d > 0 else 0 for d in deltas[-period:]]
        losses = [-d if d < 0 else 0 for d in deltas[-period:]]
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return round(100 - 100 / (1 + rs), 1)

    def scan_stock(sym: str):
        try:
            hist = yf.Ticker(sym).history(period="60d")
            if hist.empty or len(hist) < 25:
                return sym, None
            closes = hist["Close"].tolist()
            volumes = hist["Volume"].tolist()
            curr = closes[-1]
            prev = closes[-2]
            pct = (curr - prev) / prev * 100
            ma20 = sum(closes[-20:]) / 20
            ma50 = sum(closes[-50:]) / min(50, len(closes))
            vol_avg = sum(volumes[-20:]) / 20
            vol_curr = volumes[-1]
            vol_ratio = vol_curr / vol_avg if vol_avg > 0 else 1
            rsi = compute_rsi(closes)
            above_ma = curr > ma20
            vol_spike = vol_ratio > 1.5
            # 모멘텀 점수
            score = 0
            if rsi >= 50 and rsi <= 75: score += 2
            if rsi > 75: score -= 1  # 과매수
            if above_ma: score += 2
            if curr > ma50: score += 1
            if vol_spike: score += 2
            if pct > 0: score += 1
            return sym, {"price": round(curr, 2), "pct": round(pct, 2), "rsi": rsi,
                         "above_ma": above_ma, "vol_ratio": round(vol_ratio, 1), "score": score}
        except Exception:
            return sym, None

    results = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(scan_stock, s): s for s in MOMENTUM_UNIVERSE}
        for f in as_completed(futures):
            sym, d = f.result()
            if d:
                results[sym] = d

    sorted_stocks = sorted(results.items(), key=lambda x: x[1]["score"], reverse=True)
    top = sorted_stocks[:8]
    bottom = sorted_stocks[-3:]

    lines = ["<b>🚀 모멘텀 스크리너</b>\n"]
    lines.append("<b>강한 모멘텀 (매수 관심):</b>")
    for sym, d in top[:5]:
        vol_tag = f" 거래량{d['vol_ratio']:.1f}x" if d["vol_ratio"] > 1.5 else ""
        ma_tag = " MA위" if d["above_ma"] else " MA아래"
        lines.append(f"  <b>{sym}</b> {'+' if d['pct']>=0 else ''}{d['pct']:.2f}% | RSI {d['rsi']}{ma_tag}{vol_tag}")

    lines.append("\n<b>약한 모멘텀 (주의):</b>")
    for sym, d in bottom:
        lines.append(f"  {sym} {'+' if d['pct']>=0 else ''}{d['pct']:.2f}% | RSI {d['rsi']}")

    top_syms = [s for s, _ in top[:3]]
    top_data = {s: results[s] for s in top_syms}
    prompt = f"""You are a momentum trading expert for Korean retail investors.
Briefly analyze in Korean (max 350 chars):
Which of {', '.join(top_syms)} has the best momentum setup right now? Give a specific 1-line reason each + overall "지금 모멘텀 장세인가?" judgment.
Korean only.
Data: {', '.join(f"{s} RSI{top_data[s]['rsi']} vol{top_data[s]['vol_ratio']}x" for s in top_syms)}"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=400)
    result = "\n".join(lines) + "\n\n" + ai + "\n\n<i>*스크리너는 참고용. 손절선 설정 필수*</i>"
    analysis_cache.set(cache_key, result)
    return result


# ── 개인화 AI 종합보고서 ─────────────────────────────────────────
def personalized_ai_report(chat_id: str, watchlist: list) -> str:
    """사용자 watchlist 기반 개인화 AI 브리핑"""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import datetime

    # 시장 현황 + watchlist 데이터 병렬 수집
    market_tickers = ["^GSPC", "^IXIC", "^VIX"]
    all_tickers = market_tickers + [t for t in watchlist[:6] if t not in market_tickers]

    quotes = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_quote, t): t for t in watchlist[:6]}
        mfutures = {pool.submit(fetch_quote, t): t for t in ["SPY", "QQQ", "VIX"]}
        for f in as_completed({**futures, **mfutures}):
            t = futures.get(f) or mfutures.get(f)
            try:
                q = f.result()
                if q:
                    quotes[t] = q
            except Exception:
                pass

    today = datetime.date.today().strftime("%m/%d")
    wl_lines = []
    for t in watchlist[:6]:
        q = quotes.get(t)
        if q:
            sign = "+" if q["change_pct"] >= 0 else ""
            wl_lines.append(f"{t}: ${q['price']:.2f} ({sign}{q['change_pct']:.2f}%)")

    spy = quotes.get("SPY", {})
    qqq = quotes.get("QQQ", {})
    market_ctx = (
        f"SPY: {'+' if spy.get('change_pct',0)>=0 else ''}{spy.get('change_pct',0):.2f}%, "
        f"QQQ: {'+' if qqq.get('change_pct',0)>=0 else ''}{qqq.get('change_pct',0):.2f}%"
        if spy else "시장 데이터 로딩 중"
    )

    if not wl_lines:
        wl_section = "(관심종목 없음 - /watchlist add NVDA 로 추가)"
    else:
        wl_section = "\n".join(wl_lines)

    prompt = f"""You are a sharp personal AI investment advisor for a Korean retail investor. Today is {today}.
Write a personalized daily briefing in Korean. Max 650 chars total.

MUST include HTML bold tags for key numbers: <b>price</b>, <b>%</b>

Structure (use these exact headers):
<b>📊 시장</b>: [one-line market summary with exact S&P/QQQ numbers + interpretation]

<b>📋 내 종목</b>:
[For each watchlist stock: TICKER 🟢/🟡/🔴 $price ±X% — 1 sentence why]

<b>💡 오늘의 액션</b>: [1 very specific actionable recommendation with ticker+price level]

<b>⚠️ 주요 리스크</b>: [1 key risk to watch this week]

Market: {market_ctx}
My watchlist:
{wl_section}

Be direct, use exact numbers. Korean only. No disclaimers."""

    header = (
        f"🤖 <b>나만의 AI 브리핑</b> — {today}\n"
        "━━━━━━━━━━━━━━━━━━━\n\n"
    )
    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=750)
    footer = "\n\n<i>관심종목: /watchlist | 알림: /알림 NVDA 200</i>"
    return header + ai + footer


# ── 주요 ETF 분석 ─────────────────────────────────────────────
MAJOR_ETFS = {
    "SPY": "S&P500 전체",
    "QQQ": "나스닥100",
    "IWM": "소형주(Russell)",
    "ARKK": "혁신기술",
    "VOO": "뱅가드 S&P",
    "VTI": "전체 미국주식",
    "GLD": "금 ETF",
    "TLT": "20년 국채",
    "XLK": "기술섹터",
    "SOXX": "반도체",
}

ETF_TOP_HOLDINGS = {
    "QQQ": "MSFT, NVDA, AAPL",
    "ARKK": "TSLA, COIN, ROKU",
    "SOXX": "NVDA, AMD, AVGO",
    "XLK": "MSFT, AAPL, NVDA",
    "GLD": "금 현물 추종",
    "TLT": "미국 장기국채",
    "SPY": "S&P500 500종목",
    "VOO": "S&P500 저비용",
    "VTI": "미국 전체시장",
    "IWM": "중소형주 2000종목",
}


def analyze_etfs() -> str:
    """주요 ETF 현황 + AI 분석"""
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "etf_analysis"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def fetch_etf(sym: str):
        try:
            hist = yf.Ticker(sym).history(period="2d")
            if hist.empty or len(hist) < 2:
                return sym, None
            curr = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2])
            pct = (curr - prev) / prev * 100
            return sym, {"price": curr, "change_pct": pct}
        except Exception:
            return sym, None

    data = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_etf, s): s for s in MAJOR_ETFS}
        for f in as_completed(futures):
            sym, d = f.result()
            if d:
                data[sym] = d

    if not data:
        return "ETF 데이터를 가져올 수 없습니다."

    sorted_etfs = sorted(data.items(), key=lambda x: x[1]["change_pct"], reverse=True)

    lines = ["<b>📦 주요 ETF 현황</b>\n"]
    ai_parts = []
    for sym, d in sorted_etfs:
        name = MAJOR_ETFS.get(sym, sym)
        holdings = ETF_TOP_HOLDINGS.get(sym, "")
        sign = "+" if d["change_pct"] >= 0 else ""
        icon = "▲" if d["change_pct"] >= 0 else "▼"
        lines.append(f"{icon} <b>{sym}</b> ({name}) {sign}{d['change_pct']:.2f}% | ${d['price']:.1f}")
        if holdings:
            lines.append(f"   구성: {holdings}")
        ai_parts.append(f"{sym}({name}): {sign}{d['change_pct']:.2f}%")

    # 리스크온/리스크오프 판단
    spy_pct = data.get("SPY", {}).get("change_pct", 0)
    tlt_pct = data.get("TLT", {}).get("change_pct", 0)
    gld_pct = data.get("GLD", {}).get("change_pct", 0)

    prompt = f"""You are an ETF strategist for Korean retail investors.
In Korean, briefly analyze (max 300 chars):
1. 리스크온/리스크오프 판단 (SPY {spy_pct:.1f}%, TLT {tlt_pct:.1f}%, GLD {gld_pct:.1f}% 기반)
2. 한국 투자자가 지금 주목할 ETF 1개 + 이유
3. 피해야 할 ETF 1개 + 이유
Korean only.

ETF data: {', '.join(ai_parts[:6])}"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=380)
    result = "\n".join(lines) + "\n\n" + ai
    analysis_cache.set(cache_key, result)
    return result


# ── 미국 국채금리 분석 ────────────────────────────────────────────
TREASURY_TICKERS = {
    "2년물": "^IRX",    # 13주 T-Bill (2년 근사)
    "10년물": "^TNX",   # 10년 국채
    "30년물": "^TYX",   # 30년 국채
}


def analyze_interest_rates() -> str:
    """미국 국채금리 + 수익률 곡선 + 연준 AI 분석"""
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "rates_analysis"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def fetch_rate(label: str, sym: str):
        try:
            hist = yf.Ticker(sym).history(period="5d")
            if hist.empty:
                return label, None
            curr = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else curr
            chg = curr - prev
            return label, {"rate": curr, "change": chg}
        except Exception:
            return label, None

    rates = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(fetch_rate, label, sym): label for label, sym in TREASURY_TICKERS.items()}
        for f in as_completed(futures):
            label, d = f.result()
            if d:
                rates[label] = d

    if not rates:
        return "국채금리 데이터를 가져올 수 없습니다."

    lines = ["<b>📈 미국 국채금리 현황</b>\n"]
    rate_data_for_ai = []
    for label in ["2년물", "10년물", "30년물"]:
        d = rates.get(label)
        if d:
            sign = "+" if d["change"] >= 0 else ""
            icon = "▲" if d["change"] >= 0 else "▼"
            lines.append(f"{icon} <b>{label}</b>: {d['rate']:.3f}% ({sign}{d['change']:.3f}%p)")
            rate_data_for_ai.append(f"{label}={d['rate']:.3f}%")

    # 수익률 곡선 판단
    r2 = rates.get("2년물", {}).get("rate", 0)
    r10 = rates.get("10년물", {}).get("rate", 0)
    r30 = rates.get("30년물", {}).get("rate", 0)
    spread = r10 - r2
    curve_status = "역전 (경기침체 신호)" if spread < 0 else "정상" if spread > 0.5 else "평탄화"
    lines.append(f"\n수익률 곡선: <b>{curve_status}</b> (2-10년 스프레드: {spread:+.3f}%p)")

    prompt = f"""You are a fixed income expert for Korean retail investors.
Analyze in Korean (max 380 chars):
1. 현재 금리 수준이 주식시장에 미치는 영향 (특히 성장주 vs 가치주)
2. 수익률 곡선 {curve_status} 의미 + 경기전망
3. 한국 투자자 관점: 달러예금/채권 vs 주식 중 어느 쪽이 유리?
Korean only.

Rates: {', '.join(rate_data_for_ai)}, spread={spread:+.3f}%p"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=450)
    result = "\n".join(lines) + "\n\n" + ai
    analysis_cache.set(cache_key, result)
    return result


# ── 원자재 분석 ────────────────────────────────────────────────
COMMODITY_TICKERS = {
    "WTI 원유": "CL=F",
    "브렌트유": "BZ=F",
    "금": "GC=F",
    "은": "SI=F",
    "구리": "HG=F",
    "천연가스": "NG=F",
}

COMMODITY_KR_IMPACT = {
    "WTI 원유": "SK이노베이션, S-Oil, GS칼텍스",
    "브렌트유": "정유주 전반",
    "금": "한국금거래소, 금 ETF",
    "은": "솔라시도, 전기차 배터리주",
    "구리": "LS전선, 풍산, 전기차 관련주",
    "천연가스": "한국가스공사, LNG 관련",
}


def analyze_commodities() -> str:
    """원자재 현황 + 한국 관련주 영향 AI 분석"""
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from cache import quote_cache, analysis_cache

    cache_key = "commodity_analysis"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def fetch_commodity(label: str, sym: str):
        try:
            hist = yf.Ticker(sym).history(period="2d")
            if hist.empty or len(hist) < 2:
                return label, None
            curr = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2])
            pct = (curr - prev) / prev * 100
            return label, {"price": curr, "change_pct": pct}
        except Exception:
            return label, None

    data = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_commodity, label, sym): label for label, sym in COMMODITY_TICKERS.items()}
        for f in as_completed(futures):
            label, d = f.result()
            if d:
                data[label] = d

    if not data:
        return "원자재 데이터를 가져올 수 없습니다."

    sorted_comms = sorted(data.items(), key=lambda x: x[1]["change_pct"], reverse=True)
    lines = ["<b>🛢 원자재 현황</b>\n"]
    ai_parts = []
    for label, d in sorted_comms:
        sign = "+" if d["change_pct"] >= 0 else ""
        icon = "▲" if d["change_pct"] >= 0 else "▼"
        kr = COMMODITY_KR_IMPACT.get(label, "")
        lines.append(f"{icon} <b>{label}</b>: ${d['price']:.2f} ({sign}{d['change_pct']:.2f}%)")
        if kr:
            lines.append(f"   관련주: {kr}")
        ai_parts.append(f"{label}:{sign}{d['change_pct']:.1f}%")

    # 가장 크게 움직인 것
    top = sorted_comms[0]
    prompt = f"""You are a commodity expert for Korean retail investors.
In Korean (max 320 chars):
1. {top[0]} 가 {top[1]['change_pct']:+.1f}% 움직인 이유 + 한국 {COMMODITY_KR_IMPACT.get(top[0],'')} 영향
2. 지금 원자재 시장 전반 분위기 (인플레이션/디플레이션?)
3. 한국 투자자 주목 종목 1개
Korean only.

Data: {', '.join(ai_parts)}"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=400)
    result = "\n".join(lines) + "\n\n" + ai
    analysis_cache.set(cache_key, result)
    return result


RECENT_IPOS = [
    {"ticker": "RDDT", "name": "Reddit", "ipo_price": 34.0, "ipo_date": "2024-03"},
    {"ticker": "ARM", "name": "Arm Holdings", "ipo_price": 51.0, "ipo_date": "2023-09"},
    {"ticker": "BIRK", "name": "Birkenstock", "ipo_price": 46.0, "ipo_date": "2023-10"},
    {"ticker": "KVYO", "name": "Klaviyo", "ipo_price": 30.0, "ipo_date": "2023-09"},
    {"ticker": "CART", "name": "Instacart", "ipo_price": 30.0, "ipo_date": "2023-09"},
    {"ticker": "CHWY", "name": "Chewy", "ipo_price": 22.0, "ipo_date": "2019-06"},
    {"ticker": "HOOD", "name": "Robinhood", "ipo_price": 38.0, "ipo_date": "2021-07"},
    {"ticker": "COIN", "name": "Coinbase", "ipo_price": 381.0, "ipo_date": "2021-04"},
    {"ticker": "PLTR", "name": "Palantir", "ipo_price": 10.0, "ipo_date": "2020-09"},
    {"ticker": "ABNB", "name": "Airbnb", "ipo_price": 146.0, "ipo_date": "2020-12"},
]


def get_ipo_calendar() -> str:
    """최근 IPO + 상장 예정 종목 정보"""
    from cache import analysis_cache
    from collector import yf_quote
    import concurrent.futures

    cache_key = "ipo_calendar"
    cached = analysis_cache.get(cache_key)
    if cached:
        return cached

    def fetch_one(ipo):
        q = yf_quote(ipo["ticker"])
        return ipo, q

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_one, ipo): ipo for ipo in RECENT_IPOS}
        for future in concurrent.futures.as_completed(futures):
            try:
                ipo, q = future.result()
                results.append((ipo, q))
            except Exception as e:
                logger.warning("IPO fetch error: %s", e)

    # Sort by IPO date descending
    results.sort(key=lambda x: x[0]["ipo_date"], reverse=True)

    lines = ["<b>📋 주요 IPO 종목 현황</b>\n"]
    ai_parts = []

    for ipo, q in results:
        ticker = ipo["ticker"]
        name = ipo["name"]
        ipo_price = ipo["ipo_price"]
        ipo_date = ipo["ipo_date"]

        if q:
            current = q["price"]
            gain = (current - ipo_price) / ipo_price * 100
            sign = "+" if gain >= 0 else ""
            icon = "🟢" if gain >= 0 else "🔴"
            day_sign = "+" if q["change_pct"] >= 0 else ""
            lines.append(
                f"{icon} <b>{ticker}</b> ({name})\n"
                f"   IPO {ipo_date} · 공모가 ${ipo_price:.0f}\n"
                f"   현재 ${current:,.2f} ({sign}{gain:.1f}%) · 오늘 {day_sign}{q['change_pct']:.2f}%"
            )
            ai_parts.append(f"{ticker}:{sign}{gain:.1f}%")
        else:
            lines.append(f"⚪ <b>{ticker}</b> ({name}) — 데이터 없음")

    if not ai_parts:
        return "IPO 데이터를 가져올 수 없습니다."

    prompt = f"""You are a Korean stock market expert for retail investors.
In Korean (max 350 chars, no investment advice warning needed):
1. IPO 이후 수익률이 높은/낮은 종목의 공통점은?
2. 현재 IPO 시장 트렌드 한 줄
3. 한국 투자자에게 주목할 만한 종목 1개와 이유

Data: {', '.join(ai_parts)}"""

    ai = claude_call("claude-haiku-4-5", prompt, max_tokens=400)
    result = "\n".join(lines) + "\n\n" + ai
    analysis_cache.set(cache_key, result)
    return result
