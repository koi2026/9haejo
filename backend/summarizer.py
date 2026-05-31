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

    prompt = f"""You are the head analyst at 9haejo, Korea's premier AI stock briefing service.
Write EXACTLY 5 Telegram messages in Korean for {date} ({wd}) — Toss Securities quality.
Separate each message with exactly: ---

DATA (use EXACT numbers, never approximate):
Indices: {idx_text}
Sectors: {sec_text}
Stocks: {stk_text}
FX: USD/KRW={krw}  USD/JPY={jpy}
Fear&Greed: {fg_score}/100 ({fg_label})
Best sector: {best_sec[0]} {fmt_pct(best_sec[1])} | Worst: {worst_sec[0]} {fmt_pct(worst_sec[1])}
Top gainer: {top_gainer[0]} {fmt_pct(top_gainer[1])} | Top loser: {top_loser[0]} {fmt_pct(top_loser[1])}
News: {top_news}

STYLE RULES (MUST FOLLOW):
- Each message MAX 380 chars. Korean + English tickers.
- Always format numbers: NVDA +3.24% ($875.20) — never "NVDA rose"
- Use HTML bold <b>text</b> for headers/key numbers
- Give the "SO WHAT" for Korean investors after every data point
- Be specific, confident, actionable — like a Bloomberg terminal + friendly tone

[1/5] 마감 브리핑
Header: <b>📊 미국 증시 {date} 마감</b>
- S&P500 {fmt_pct(sp500_pct)}, NASDAQ {fmt_pct(nasdaq_pct)} (exact index levels from data)
- Fear&Greed {fg_score} = {fg_label} → 다음날 투자 심리 한줄 해석
- 시장 전체 분위기 한줄 임팩트 문장

[2/5] 섹터 분석
Header: <b>🔥 섹터 성적표</b>
{sec_bar}
- 1위 섹터 왜 올랐는지 + 한국 관련주 영향
- 꼴찌 섹터 왜 빠졌는지 + 조심해야 할 것

[3/5] 주목 종목
Header: <b>⚡ 오늘의 주인공</b>
- {top_gainer[0]}: 정확한 가격과 % + 급등 이유 (뉴스/실적/기대감)
- {top_loser[0]}: 정확한 가격과 % + 하락 이유
- 내일 주목할 1종목 + 이유

[4/5] 한국 시장 영향
Header: <b>🇰🇷 내일 코스피 체크포인트</b>
- USD/KRW {krw}원 → 수출주/반도체/배터리 영향 분석
- 직접 영향받는 종목명 명시 (삼성전자, SK하이닉스, LG에너지솔루션 등)
- 환율/섹터 트렌드 기반 내일 예상 흐름

[5/5] 내일 플레이북
Header: <b>📋 내일 {date} 투자 체크리스트</b>
- 주시할 경제지표/이벤트 (구체적 시각 포함)
- 매수/관망/주의 신호 각 1가지씩
- 핵심 한줄 요약
구독: @goohaejo_bot"""

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
