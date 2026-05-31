"""
AI 브리핑 요약 모듈 v2.1
토스증권 스타일 — 숫자 강조, 명확한 구조, 한국 투자자 맞춤
"""
import os, logging, anthropic
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)
logger = logging.getLogger(__name__)


def get_client():
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def claude_call_with_retry(client, model: str, prompt: str, max_tokens: int, max_retries: int = 3) -> str:
    """Rate limit 자동 재시도 래퍼"""
    import time as _time
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
            try:
                hdr = getattr(e, "response", None)
                if hdr is not None:
                    ra = hdr.headers.get("retry-after") or hdr.headers.get("x-ratelimit-reset-requests")
                    if ra:
                        wait = max(int(float(ra)), 5)
            except Exception:
                pass
            if attempt < max_retries - 1:
                logger.warning("Claude rate limit (summarizer, attempt %d/%d). Waiting %ds...", attempt + 1, max_retries, wait)
                _time.sleep(wait)
            else:
                raise
        except anthropic.APIStatusError as e:
            if e.status_code == 529 and attempt < max_retries - 1:
                logger.warning("Claude overloaded (summarizer). Waiting 30s...")
                _time.sleep(30)
            else:
                raise


def arrow(pct):
    if pct is None: return ""
    return "+" if pct >= 0 else ""


def fmt_pct(pct, with_arrow=True):
    if pct is None: return "N/A"
    a = "▲" if pct >= 0 else "▼"
    return f"{a}{abs(pct):.2f}%"


def summarize(data: dict) -> dict:
    idx  = data.get("indices", {})
    sec  = data.get("sectors", {})
    stk  = data.get("big_stocks", {})
    fx   = data.get("fx", {})
    news = data.get("news", [])
    fg   = data.get("fear_greed", {})
    date = data.get("date_display", "")
    wd   = data.get("weekday", "")

    def row(name, d):
        p = d.get("change_pct")
        v = d.get("price")
        return f"  {name}: {fmt_pct(p)} | ${v}" if v else f"  {name}: N/A"

    idx_text = "\n".join(row(k, v) for k, v in idx.items())
    sec_text = "\n".join(row(k, v) for k, v in sec.items())
    stk_text = "\n".join(row(k, v) for k, v in stk.items())

    krw = fx.get("USD/KRW", {}).get("price", "N/A")
    jpy = fx.get("USD/JPY", {}).get("price", "N/A")
    fg_score = fg.get("score", "N/A")
    fg_label = fg.get("label_kr", fg.get("rating", "N/A"))

    top_news = "\n".join(
        f"  [{n.get('sentiment','?')[:4]}] {n.get('title','')}"
        for n in news[:5]
    )

    # 섹터 베스트/워스트
    sec_sorted = sorted(
        [(k, v.get("change_pct", 0) or 0) for k, v in sec.items()],
        key=lambda x: x[1], reverse=True
    )
    best_sec  = sec_sorted[0] if sec_sorted else ("N/A", 0)
    worst_sec = sec_sorted[-1] if sec_sorted else ("N/A", 0)

    # 섹터 이모지 바 차트
    def emoji_bar(pct):
        blocks = min(abs(int(pct // 0.3)), 8)
        if pct >= 0:
            return "▓" * blocks + "░" * (8 - blocks)
        else:
            return "░" * (8 - blocks) + "▓" * blocks

    sec_bar_lines = []
    for k, v in sorted(sec.items(), key=lambda x: x[1].get("change_pct", 0) or 0, reverse=True):
        pct = v.get("change_pct", 0) or 0
        arrow = "+" if pct >= 0 else ""
        sec_bar_lines.append(f"{k[:4]} {emoji_bar(pct)} {arrow}{pct:.2f}%")
    sec_bar = "\n".join(sec_bar_lines)

    # 주목 종목 (가장 많이 오른/내린)
    stk_sorted = sorted(
        [(k, v.get("change_pct", 0) or 0) for k, v in stk.items()],
        key=lambda x: x[1], reverse=True
    )
    top_gainer = stk_sorted[0] if stk_sorted else ("N/A", 0)
    top_loser  = stk_sorted[-1] if stk_sorted else ("N/A", 0)

    sp500_pct = idx.get("S&P500", {}).get("change_pct", 0) or 0
    nasdaq_pct = idx.get("NASDAQ", {}).get("change_pct", 0) or 0

    prompt = f"""You are the AI analyst for 9haejo, a Korean stock market briefing service similar to Toss Securities.
Write EXACTLY 5 Telegram messages in Korean for {date} ({wd}) market briefing.
Use real numbers from data. Be concise, clear, impactful.
Separate each message with exactly: ---

MARKET DATA:
Indices:
{idx_text}

Sectors:
{sec_text}

Big Stocks:
{stk_text}

FX: USD/KRW={krw}won, USD/JPY={jpy}
Fear & Greed: {fg_score}/100 ({fg_label})
Best sector: {best_sec[0]} {fmt_pct(best_sec[1])}
Worst sector: {worst_sec[0]} {fmt_pct(worst_sec[1])}
Top gainer: {top_gainer[0]} {fmt_pct(top_gainer[1])}
Top loser: {top_loser[0]} {fmt_pct(top_loser[1])}

News:
{top_news}

FORMAT RULES:
- Start each message with emoji + bold header line
- ALWAYS use exact numbers from data (never approximate)
- Include arrows: up-arrow for gains, down-arrow for losses
- Each message MAX 350 characters
- Korean text, English tickers
- Be specific: "NVDA +3.2% ($875)" not "NVDA rose"
- Compare to recent context where possible

Message 1 - [1/5] Market Overview:
First line: "📊 미국 증시 {date} 마감" (bold)
S&P500 exact %, NASDAQ exact % with absolute value
Fear & Greed {fg_score} — interpret what it means for next day
One punchy market mood sentence Korean investors care about

Message 2 - [2/5] Sector Spotlight:
Include this sector bar (copy exactly):
{sec_bar}
Best sector winner + why it matters for Korean stocks
Worst sector + Korean stocks affected

Message 3 - [3/5] Big Tech Movers:
Top gainer with exact price and % — why it moved (news/earnings if any)
Top loser with exact price and % — what went wrong
One other notable mover worth watching

Message 4 - [4/5] Korea Market Preview:
USD/KRW rate {krw}won - impact on Korean stocks
Which KOSPI/KOSDAQ stocks will be affected tomorrow
Concrete names: 삼성전자, SK하이닉스, 카카오, 네이버 etc

Message 5 - [5/5] Tomorrow's Playbook:
3 concrete things Korean investors should watch
Specific tickers or sectors
End with: "구독: @goohaejo_bot"
"""

    client = get_client()
    raw = claude_call_with_retry(client, "claude-opus-4-5", prompt, max_tokens=2500)
    tweets = [t.strip() for t in raw.split("---") if t.strip()][:5]
    while len(tweets) < 5:
        tweets.append(f"[{len(tweets)+1}/5] 분석 준비 중...")

    return {"tweets": tweets, "raw": raw, "date": date,
            "meta": {"sp500": sp500_pct, "nasdaq": nasdaq_pct,
                     "fear_greed": fg, "krw": krw}}


if __name__ == "__main__":
    from collector import collect_all
    d = collect_all()
    r = summarize(d)
    for i, t in enumerate(r["tweets"], 1):
        print(f"\n{'='*40}\n[{i}/5]\n{t}")
