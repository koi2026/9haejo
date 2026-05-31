"""
텔레그램 봇 핸들러 v2
커맨드: /start /help /구독 /구독취소 /브리핑 /시황 /watchlist /sector
자유 텍스트: 종목명 or 티커 -> 즉시 분석
"""

import os
import sys
import logging
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

_handler = logging.StreamHandler(stream=sys.stdout)
_handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s:%(message)s"))
try:
    _handler.stream.reconfigure(encoding="utf-8")
except Exception:
    pass
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
logger = logging.getLogger(__name__)

from data_dir import DATA_DIR
_WL_PATH = DATA_DIR / "watchlists.json"

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

SECTOR_MAP = {
    "반도체": "SOXX", "기술": "XLK", "it": "XLK",
    "통신": "XLC", "소비": "XLY", "에너지": "XLE", "금융": "XLF",
}


def _strip_html_tags(text: str) -> str:
    """HTML 태그를 제거해 plain text로 변환 (폴백용)"""
    import re
    # 허용되지 않는 태그를 제거하고 entities 디코딩
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return text


def send(chat_id: str, text: str, reply_markup: dict | None = None):
    # 텍스트 길이 제한 (Telegram 최대 4096자)
    if len(text) > 4096:
        text = text[:4090] + "\n..."
    try:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        r = httpx.post(f"{BASE_URL}/sendMessage", json=payload, timeout=15)
        if r.status_code == 400:
            # HTML 파싱 오류 가능성 — plain text로 재시도
            data = r.json()
            if "parse" in data.get("description", "").lower() or "html" in data.get("description", "").lower():
                logger.warning("HTML parse error, retrying as plain text: %s", data.get("description"))
                plain_text = _strip_html_tags(text)
                if len(plain_text) > 4096:
                    plain_text = plain_text[:4090] + "\n..."
                payload2 = {
                    "chat_id": chat_id,
                    "text": plain_text,
                    "disable_web_page_preview": True,
                }
                if reply_markup:
                    payload2["reply_markup"] = reply_markup
                r2 = httpx.post(f"{BASE_URL}/sendMessage", json=payload2, timeout=15)
                logger.info("plain text fallback -> %s: %s", chat_id, r2.status_code)
            else:
                logger.error("send 400: %s — text[:80]: %r", data.get("description"), text[:80])
        else:
            logger.info("send -> %s: %s", chat_id, r.status_code)
    except Exception as e:
        logger.error("send error: %s", e)


def answer_callback(callback_query_id: str):
    """Telegram callback_query에 답변 (스피너 제거)"""
    try:
        httpx.post(f"{BASE_URL}/answerCallbackQuery", json={"callback_query_id": callback_query_id}, timeout=5)
    except Exception:
        pass


MAIN_MENU = {
    "inline_keyboard": [[
        {"text": "📊 시황", "callback_data": "/시황"},
        {"text": "📰 뉴스", "callback_data": "/뉴스"},
    ], [
        {"text": "📈 브리핑", "callback_data": "/브리핑"},
        {"text": "✅ 구독", "callback_data": "/구독"},
    ], [
        {"text": "🔔 알림 설정", "callback_data": "/알림"},
        {"text": "📋 관심종목", "callback_data": "/watchlist"},
    ], [
        {"text": "🌐 매크로", "callback_data": "/매크로"},
        {"text": "🪙 랭킹", "callback_data": "/랭킹"},
    ], [
        {"text": "📅 경제지표 캘린더", "callback_data": "/캘린더"},
        {"text": "⚖️ 종목비교", "callback_data": "__help_stock"},
    ], [
        {"text": "🏭 섹터 ETF 분석", "callback_data": "/섹터"},
        {"text": "📊 52주 고저가", "callback_data": "/52주"},
    ]]
}

HELP_MENU = {
    "inline_keyboard": [[
        {"text": "📈 브리핑/시황", "callback_data": "__help_briefing"},
        {"text": "🔍 종목 분석", "callback_data": "__help_stock"},
    ], [
        {"text": "📋 관심종목", "callback_data": "__help_watchlist"},
        {"text": "🔔 가격 알림", "callback_data": "__help_alert"},
    ], [
        {"text": "🌐 매크로/캘린더", "callback_data": "__help_macro"},
        {"text": "🪙 랭킹/통계", "callback_data": "__help_ranking"},
    ]]
}

HELP_TEXTS = {
    "__help_briefing": (
        "📈 <b>브리핑 & 시황</b>\n\n"
        "/브리핑 — AI 브리핑 즉시 받기 (30초)\n"
        "/시황 — 지수+환율+섹터 히트맵\n"
        "/뉴스 — 월가 뉴스 한국어 요약 (호재/악재)\n"
        "/뉴스 NVDA — 특정 종목 뉴스\n"
        "/한줄 — 오늘 시장 150자 요약 (공유용)\n"
        "/주간 — 이번 주 지수 성적표\n\n"
        "/구독 — 매일 8시 자동 브리핑 구독\n"
        "/구독취소 — 구독 해제\n"
        "/지난브리핑 — 어제 브리핑 다시보기"
    ),
    "__help_stock": (
        "🔍 <b>종목 분석</b>\n\n"
        "<b>티커 직접 입력:</b>\n"
        "<code>NVDA</code>  <code>TSLA</code>  <code>AAPL</code>  <code>MSFT</code>\n\n"
        "<b>한국어로 입력:</b>\n"
        "<code>엔비디아</code>  <code>테슬라</code>  <code>삼성전자</code>\n\n"
        "/비교 NVDA TSLA — 두 종목 AI 비교\n"
        "/종목전망 NVDA — 주간 AI 전망\n"
        "/차트 NVDA — 30일 스파크라인 차트\n"
        "/sector 반도체 — 섹터 ETF 분석\n"
        "/상승 반도체 — 섹터별 상승 TOP5\n"
        "/하락 — 하락 TOP5"
    ),
    "__help_watchlist": (
        "📋 <b>관심종목 & 포트폴리오</b>\n\n"
        "/watchlist — 내 관심종목 현황\n"
        "/watchlist add NVDA — 추가\n"
        "/watchlist remove NVDA — 삭제\n\n"
        "/포트폴리오 — 종목별 매수/관망/매도 AI 신호\n"
        "  + 포트폴리오 건강도 점수 (0-100)\n\n"
        "매일 8시 브리핑과 함께 관심종목 현황 자동 발송!"
    ),
    "__help_alert": (
        "🔔 <b>가격 알림</b>\n\n"
        "<b>등록:</b>\n"
        "/알림 NVDA 200 — $200 이상 시 알림\n"
        "/알림 TSLA 150 하락 — $150 이하 시 알림\n\n"
        "<b>관리:</b>\n"
        "/알림 — 현재 알림 목록\n"
        "/알림 삭제 NVDA — NVDA 알림 삭제\n\n"
        "5분마다 자동 체크, 최대 5개 등록\n"
        "알림 발동 시 AI 한줄 액션 조언 포함"
    ),
    "__help_macro": (
        "🌐 <b>매크로 & 경제지표</b>\n\n"
        "/매크로 — VIX, DXY, 금리, WTI, 금, BTC\n"
        "  AI 한국어 해석 포함\n\n"
        "/캘린더 — FOMC, CPI, NFP, PCE 일정\n"
        "  D-카운트다운 + 지난 지표 표시\n\n"
        "/환율 — USD/KRW, USD/JPY, USD/CNY\n"
        "  AI 환율 전망 포함"
    ),
    "__help_ranking": (
        "🪙 <b>랭킹 & 통계</b>\n\n"
        "/랭킹 crypto — BTC ETH SOL 시세\n"
        "/랭킹 bigtech — 빅테크 7종목 랭킹\n"
        "/랭킹 kr — 코스피 대형주 랭킹\n\n"
        "/내통계 — 내 구독/관심종목/알림 현황\n"
        "/설정 — 개인 설정 보기\n\n"
        "9haejo.vercel.app 에서 웹으로도 확인 가능!"
    ),
}


def handle_update(update: dict):
    try:
        # callback_query (inline keyboard button)
        cb = update.get("callback_query")
        if cb:
            answer_callback(cb["id"])
            chat_id = str(cb["message"]["chat"]["id"])
            cb_data = cb.get("data", "").strip()
            if cb_data in HELP_TEXTS:
                send(chat_id, HELP_TEXTS[cb_data])
            elif cb_data.startswith("__del_alert_"):
                ticker = cb_data[len("__del_alert_"):]
                from alerts import remove_alert, get_alerts
                n = remove_alert(chat_id, ticker)
                if n:
                    remaining = get_alerts(chat_id)
                    send(chat_id, (
                        f"✅ <b>{ticker}</b> 알림을 삭제했습니다.\n"
                        f"남은 알림: {len(remaining)}개\n\n"
                        f"/알림 — 알림 목록 보기"
                    ))
                else:
                    send(chat_id, f"{ticker} 알림이 없습니다.")
            elif cb_data:
                handle_update({"message": {"chat": {"id": chat_id}, "text": cb_data}})
            return

        msg = update.get("message") or update.get("edited_message")
        if not msg:
            return

        chat_id = str(msg["chat"]["id"])
        text = msg.get("text", "").strip()
        if not text:
            return

        logger.info("[%s] recv: %r", chat_id, text)
        cmd = text.split()[0].lower()

        # ── /start ──────────────────────────────────
        if cmd == "/start":
            # 즉시 시장 스냅샷 (빠른 응답)
            try:
                from collector import yf_quote, collect_fear_greed
                sp = yf_quote("^GSPC")
                nq = yf_quote("^IXIC")
                fg = collect_fear_greed()
                sp_str = f"S&P500 {'▲' if sp['change_pct']>=0 else '▼'}{abs(sp['change_pct']):.1f}%" if sp else ""
                nq_str = f"NASDAQ {'▲' if nq['change_pct']>=0 else '▼'}{abs(nq['change_pct']):.1f}%" if nq else ""
                fg_str = f"F&G {fg.get('score','?')}" if fg else ""
                market_snapshot = f"\n\n📊 지금 시장: {sp_str} | {nq_str} | {fg_str}" if sp else ""
            except Exception:
                market_snapshot = ""
            send(chat_id, (
                "👋 <b>구해조(9haejo)</b>에 오신 걸 환영합니다!\n\n"
                "🇺🇸 미국 증시 AI 브리핑 서비스\n"
                "매일 오전 8시, 월가 마감 분석을 받아보세요."
                f"{market_snapshot}\n\n"
                f"📌 내 Chat ID: <code>{chat_id}</code>\n"
                "🌐 <a href='https://9haejo.vercel.app'>구독 신청 사이트</a>\n\n"
                "아래 버튼으로 바로 시작하세요:"
            ), reply_markup=MAIN_MENU)

        # ── /도움말 (키워드 검색) ────────────────────
        elif cmd in ["/도움말"]:
            parts = text.split()
            keyword = " ".join(parts[1:]).lower() if len(parts) > 1 else ""
            KEYWORD_MAP = {
                "환율": ["/환율 — 주요 환율 및 AI 전망", "/매크로 — DXY 달러지수 포함"],
                "주식": ["/종목명 입력 — 즉시 AI 분석", "/compare A B — 두 종목 비교", "/종목전망 NVDA — 주간 전망"],
                "뉴스": ["/뉴스 — 월가 뉴스 요약", "/뉴스 NVDA — 종목 뉴스"],
                "알림": ["/알림 NVDA 200 — 상승 알림", "/알림 TSLA 150 하락 — 하락 알림", "/알림 삭제 NVDA"],
                "구독": ["/구독 — 매일 8시 브리핑 구독", "/구독취소 — 해제"],
                "관심": ["/watchlist — 조회", "/watchlist add NVDA — 추가", "/포트폴리오 — AI 진단"],
                "암호화폐": ["/랭킹 crypto — BTC/ETH/SOL 랭킹"],
                "crypto": ["/랭킹 crypto — BTC/ETH/SOL 랭킹"],
                "섹터": ["/sector 반도체 — ETF 분석", "/상승 반도체 — 섹터별 상위 종목"],
                "매크로": ["/매크로 — VIX/DXY/금리/오일/금"],
                "금리": ["/매크로 — US2Y/US10Y 포함"],
                "시황": ["/시황 — 미국+한국 시장 현황", "/한줄 — 오늘 한줄 요약"],
                "통계": ["/내통계 — 내 구독/알림/관심종목"],
            }
            if keyword:
                matches = []
                for kw, cmds in KEYWORD_MAP.items():
                    if kw in keyword or keyword in kw:
                        matches.extend(cmds)
                if matches:
                    send(chat_id, f"🔍 <b>'{keyword}' 관련 커맨드</b>\n\n" + "\n".join(set(matches)))
                else:
                    send(chat_id, f"'{keyword}'에 대한 커맨드를 찾지 못했어요.\n/help 로 전체 목록을 확인하세요.")
            else:
                send(chat_id, "📖 <b>구해조 커맨드</b>\n\n카테고리를 선택해 자세한 사용법을 확인하세요:", reply_markup=HELP_MENU)

        # ── /help ────────────────────────────────────
        elif cmd == "/help":
            send(chat_id,
                "📖 <b>구해조 커맨드</b>\n\n카테고리를 선택해 자세한 사용법을 확인하세요:",
                reply_markup=HELP_MENU
            )

        # ── /구독 ────────────────────────────────────
        elif cmd in ["/구독", "/subscribe"]:
            from subscribers import subscribe
            is_new = subscribe(chat_id)
            if is_new:
                send(chat_id, (
                    "🎉 <b>구독 완료!</b>\n\n"
                    "매일 오전 8시, 월가 AI 브리핑을 받으실 준비가 됐습니다!\n\n"
                    "📋 지금 바로 가장 최근 브리핑을 보내드릴게요..."
                ))
                # 최신 브리핑 1페이지 즉시 발송
                try:
                    from briefing_history import get_latest_briefing
                    cached_date, cached_tweets = get_latest_briefing()
                    if cached_tweets:
                        preview = cached_tweets[0]
                        send(chat_id, f"<b>📊 최근 브리핑 ({cached_date}) 미리보기</b>\n\n{preview}")
                        share_markup = {
                            "inline_keyboard": [[
                                {"text": "📈 전체 브리핑 보기", "callback_data": "/브리핑"},
                                {"text": "📋 관심종목 추가", "callback_data": "/watchlist"},
                            ], [
                                {"text": "🔗 친구에게 공유", "url": "https://t.me/share/url?url=https%3A%2F%2F9haejo.vercel.app"},
                            ]]
                        }
                        send(chat_id, "관심종목과 가격 알림도 설정해 보세요!", reply_markup=share_markup)
                    else:
                        send(chat_id, "/구독취소 로 언제든지 해제할 수 있어요.")
                except Exception:
                    send(chat_id, "/구독취소 로 언제든지 해제할 수 있어요.")
            else:
                send(chat_id, "이미 구독 중이에요! 매일 8시에 브리핑을 보내드리고 있어요. 🎯")

        # ── /구독취소 ─────────────────────────────────
        elif cmd in ["/구독취소", "/unsubscribe"]:
            from subscribers import unsubscribe
            removed = unsubscribe(chat_id)
            if removed:
                send(chat_id, "구독이 해제되었습니다. 언제든지 /구독 으로 다시 시작하세요!")
            else:
                send(chat_id, "현재 구독 중이 아닙니다.")

        # ── /브리핑 ──────────────────────────────────
        elif cmd in ["/브리핑", "/briefing"]:
            # 6시간 내 캐시된 브리핑이 있으면 즉시 발송
            try:
                from briefing_history import get_latest_briefing
                from datetime import datetime, timezone
                cached_date, cached_tweets = get_latest_briefing()
                use_cache = False
                if cached_tweets and cached_date:
                    try:
                        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                        if cached_date == today:
                            use_cache = True
                    except Exception:
                        pass
                if use_cache:
                    send(chat_id, f"📋 <b>오늘 브리핑 ({cached_date})</b> — 캐시됨")
                    result_tweets = cached_tweets
                else:
                    send(chat_id, "⏳ AI가 시장을 분석 중입니다... (30초 정도 소요됩니다)")
                    from collector import collect_all
                    from summarizer import summarize
                    data = collect_all()
                    result = summarize(data)
                    result_tweets = result["tweets"]
            except Exception:
                send(chat_id, "⏳ AI가 시장을 분석 중입니다... (30초 정도 소요됩니다)")
                from collector import collect_all
                from summarizer import summarize
                data = collect_all()
                result = summarize(data)
                result_tweets = result["tweets"]
                share_text = "구해조 AI 브리핑 - 매일 8시 미국 증시 분석"
                share_url = "https://t.me/share/url?url=https%3A%2F%2F9haejo.vercel.app&text=" + share_text.replace(" ", "%20")
                share_markup = {
                    "inline_keyboard": [[
                        {"text": "공유하기", "url": share_url},
                        {"text": "웹에서 보기", "url": "https://9haejo.vercel.app"},
                    ]]
                }
                for i, tweet in enumerate(result_tweets):
                    if i == len(result_tweets) - 1:
                        send(chat_id, tweet, reply_markup=share_markup)
                    else:
                        send(chat_id, tweet)
            except Exception as e:
                logger.error("briefing error: %s", e)
                send(chat_id, "브리핑 생성 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.")

        # ── /시황 ────────────────────────────────────
        elif cmd in ["/시황", "/market"]:
            send(chat_id, "⏳ 시장 현황 조회 중...")
            try:
                from collector import yf_quote, collect_fear_greed
                from concurrent.futures import ThreadPoolExecutor, as_completed

                # 병렬 데이터 수집
                index_syms = [("S&P500", "^GSPC"), ("NASDAQ", "^IXIC"), ("DOW", "^DJI"), ("VIX", "^VIX")]
                kr_syms = [("KOSPI", "^KS11"), ("KOSDAQ", "^KQ11")]
                fx_syms = [("USD/KRW", "KRW=X"), ("USD/JPY", "JPY=X")]
                sector_syms = [
                    ("반도체", "SOXX"), ("기술IT", "XLK"), ("금융", "XLF"),
                    ("에너지", "XLE"), ("헬스케어", "XLV"), ("소비재", "XLY"),
                    ("통신", "XLC"), ("유틸리티", "XLU"),
                ]
                all_syms = index_syms + kr_syms + fx_syms + sector_syms + [("FG", "FG")]
                results = {}
                with ThreadPoolExecutor(max_workers=6) as pool:
                    def fetch(item):
                        name, sym = item
                        if sym == "FG":
                            return name, collect_fear_greed()
                        return name, yf_quote(sym)
                    futures = {pool.submit(fetch, item): item for item in all_syms}
                    for f in as_completed(futures):
                        try:
                            name, data = f.result()
                            results[name] = data
                        except Exception:
                            pass

                def fmt(name, q):
                    if not q or not isinstance(q, dict) or "price" not in q:
                        return f"{name}: --"
                    arrow = "▲" if q["change_pct"] >= 0 else "▼"
                    sign = "+" if q["change_pct"] >= 0 else ""
                    return f"{name}: {q['price']:,.2f} {arrow}{sign}{q['change_pct']:.2f}%"

                lines = ["<b>📊 미국 시장 현황</b>\n"]
                for name, _ in index_syms:
                    lines.append(fmt(name, results.get(name)))

                lines.append("\n<b>한국 시장</b>")
                for name, _ in kr_syms:
                    lines.append(fmt(name, results.get(name)))

                lines.append("\n<b>환율</b>")
                for name, _ in fx_syms:
                    lines.append(fmt(name, results.get(name)))

                fg = results.get("FG", {})
                if fg:
                    lines.append(f"\n<b>공포탐욕지수</b>: {fg.get('score','?')} ({fg.get('label_kr','?')})")

                # 섹터 히트맵 (텍스트 블록 아트)
                lines.append("\n<b>📊 섹터 히트맵</b>")
                lines.append("<code>")
                for name, _ in sector_syms:
                    q = results.get(name)
                    if q and isinstance(q, dict) and "change_pct" in q:
                        pct = q["change_pct"]
                        # 블록 수 (0~5)
                        blocks = min(5, int(abs(pct) / 0.5) + 1) if abs(pct) > 0.05 else 1
                        if pct >= 0:
                            bar = "█" * blocks
                            label = f"+{pct:.2f}%"
                            lines.append(f"{name:<6} {bar:<5} {label}")
                        else:
                            bar = "░" * blocks
                            label = f"{pct:.2f}%"
                            lines.append(f"{name:<6} {bar:<5} {label}")
                lines.append("</code>")

                send(chat_id, "\n".join(lines))
            except Exception as e:
                logger.error("market error: %s", e)
                send(chat_id, "시장 데이터 조회 중 오류가 발생했어요.")

        # ── /알림 ────────────────────────────────────────
        elif cmd in ["/알림", "/alert"]:
            parts = text.split()
            from alerts import add_alert, remove_alert, get_alerts
            from stock_analyzer import resolve_ticker

            if len(parts) == 1:
                # 현재 알림 목록 + 인라인 삭제 버튼
                user_alerts = get_alerts(chat_id)
                if not user_alerts:
                    send(chat_id, (
                        "📭 등록된 가격 알림이 없습니다.\n\n"
                        "<b>알림 등록 방법:</b>\n"
                        "/알림 NVDA 200 — NVDA가 $200 이상이 되면 알림\n"
                        "/알림 TSLA 150 하락 — TSLA가 $150 이하 시 알림\n"
                        "(최대 5개)"
                    ))
                else:
                    lines = [f"🔔 <b>내 가격 알림</b> ({len(user_alerts)}개 / 최대 5개)\n"]
                    for a in user_alerts:
                        direction_icon = "📈" if a["direction"] == "above" else "📉"
                        arrow = ">=" if a["direction"] == "above" else "<="
                        dir_text = "이상 알림" if a["direction"] == "above" else "이하 알림"
                        lines.append(f"{direction_icon} <b>{a['ticker']}</b> {arrow} ${a['target']:,.0f} <i>({dir_text})</i>")
                    lines.append("\n삭제하려면 아래 버튼을 누르세요:")
                    # 종목별 삭제 버튼 (한 행에 최대 2개)
                    btn_rows = []
                    row = []
                    for a in user_alerts:
                        row.append({"text": f"🗑 {a['ticker']} 삭제", "callback_data": f"__del_alert_{a['ticker']}"})
                        if len(row) == 2:
                            btn_rows.append(row)
                            row = []
                    if row:
                        btn_rows.append(row)
                    btn_rows.append([{"text": "+ 알림 추가 방법", "callback_data": "__help_alert"}])
                    markup = {"inline_keyboard": btn_rows}
                    send(chat_id, "\n".join(lines), reply_markup=markup)

            elif len(parts) >= 3 and parts[1].lower() in ["삭제", "delete", "remove"]:
                ticker = resolve_ticker(parts[2]) or parts[2].upper()
                n = remove_alert(chat_id, ticker)
                if n:
                    send(chat_id, f"✅ {ticker} 알림을 삭제했습니다.")
                else:
                    send(chat_id, f"{ticker} 알림이 없습니다.")

            elif len(parts) >= 3:
                # /알림 NVDA 200 [하락]
                ticker = resolve_ticker(parts[1]) or parts[1].upper()
                try:
                    target = float(parts[2].replace(",", ""))
                except ValueError:
                    send(chat_id, "가격을 숫자로 입력해주세요.\n예: /알림 NVDA 200")
                    return
                direction = "below" if len(parts) >= 4 and "하락" in parts[3] else "above"
                ok = add_alert(chat_id, ticker, target, direction)
                if ok:
                    dir_text = "이하" if direction == "below" else "이상"
                    send(chat_id, (
                        f"✅ <b>알림 등록 완료!</b>\n\n"
                        f"{ticker}이(가) ${target:,.0f} {dir_text}이 되면\n"
                        f"즉시 텔레그램으로 알려드립니다.\n"
                        f"(5분마다 체크)"
                    ))
                else:
                    send(chat_id, "알림은 최대 5개까지 등록할 수 있습니다.\n/알림 삭제 NVDA 로 기존 알림을 삭제해주세요.")
            else:
                send(chat_id, "사용법: /알림 NVDA 200\n하락 알림: /알림 TSLA 150 하락")




        # ── /지난브리핑 ──────────────────────────────────
        elif cmd in ["/지난브리핑", "/yesterday"]:
            try:
                from briefing_history import get_yesterday_briefing, get_latest_briefing
                date, tweets = get_yesterday_briefing()
                if not tweets:
                    # 어제 없으면 가장 최근 것
                    date, tweets = get_latest_briefing()
                if not tweets:
                    send(chat_id, "아직 저장된 브리핑이 없어요.\n/브리핑 으로 지금 브리핑을 받아보세요!")
                else:
                    send(chat_id, f"📅 <b>{date} 브리핑</b>")
                    for tweet in tweets:
                        send(chat_id, tweet)
            except Exception as e:
                logger.error("yesterday error: %s", e)
                send(chat_id, "브리핑 히스토리 조회 중 오류가 발생했어요.")

        # ── /환율 ────────────────────────────────────────
        elif cmd in ["/환율", "/fx"]:
            send(chat_id, "⏳ 환율 현황 조회 중...")
            try:
                from collector import yf_quote
                import anthropic, os
                lines = ["<b>💱 실시간 환율</b>\n"]
                fx_pairs = [("USD/KRW", "KRW=X"), ("USD/JPY", "JPY=X"), ("USD/CNY", "CNY=X"), ("USD/EUR", "EURUSD=X")]
                fx_data = {}
                for name, sym in fx_pairs:
                    q = yf_quote(sym)
                    if q:
                        arrow = "▲" if q["change_pct"] >= 0 else "▼"
                        sign = "+" if q["change_pct"] >= 0 else ""
                        lines.append(f"{name}: {q['price']:,.2f} {arrow}{sign}{q['change_pct']:.2f}%")
                        fx_data[name] = q
                send(chat_id, "\n".join(lines))
                # AI 환율 전망
                krw = fx_data.get("USD/KRW", {}).get("price", "N/A")
                krw_pct = fx_data.get("USD/KRW", {}).get("change_pct", 0)
                from stock_analyzer import claude_call
                ai = claude_call("claude-haiku-4-5", f"USD/KRW is {krw} ({krw_pct:+.2f}%). Write a 2-3 sentence Korean-language FX impact analysis for Korean stock investors. Focus on KOSPI impact, import/export companies. Use emojis. MAX 200 chars.", max_tokens=300)
                send(chat_id, ai)
            except Exception as e:
                logger.error("fx error: %s", e)
                send(chat_id, "환율 조회 중 오류가 발생했어요.")

        # ── /설정 ────────────────────────────────────────
        elif cmd in ["/설정", "/settings"]:
            from user_settings import get_settings, update_setting
            parts = text.split()
            if len(parts) == 1:
                s = get_settings(chat_id)
                wl = "켜짐" if s.get("watchlist_briefing") else "꺼짐"
                send(chat_id, (
                    f"<b>내 설정</b>\n\n"
                    f"관심종목 브리핑 포함: {wl}\n\n"
                    "<b>변경하기:</b>\n"
                    "/설정 관심종목 켜기\n"
                    "/설정 관심종목 끄기"
                ))
            elif len(parts) >= 3 and "관심종목" in parts[1]:
                on = parts[2] in ["켜기", "on", "true"]
                update_setting(chat_id, "watchlist_briefing", on)
                send(chat_id, f"관심종목 브리핑 포함: {'켜짐' if on else '꺼짐'} ✅")
            else:
                send(chat_id, "사용법: /설정 관심종목 켜기/끄기")

        # ── /포트폴리오 ──────────────────────────────────
        elif cmd in ["/포트폴리오", "/portfolio"]:
            try:
                import json
                from pathlib import Path
                wl_path = _WL_PATH
                wl_db = json.loads(wl_path.read_text(encoding="utf-8")) if wl_path.exists() else {}
                user_wl = wl_db.get(chat_id, [])
                if not user_wl:
                    send(chat_id, "관심종목이 없어요.\n/watchlist add NVDA 로 먼저 추가해주세요!")
                else:
                    send(chat_id, f"🧠 {len(user_wl)}개 종목 포트폴리오 AI 진단 중...")
                    from stock_analyzer import analyze_portfolio
                    result = analyze_portfolio(user_wl)
                    send(chat_id, result)
            except Exception as e:
                logger.error("portfolio error: %s", e)
                send(chat_id, "포트폴리오 분석 중 오류가 발생했어요.")

        # ── /watchlist ────────────────────────────────
        elif cmd == "/watchlist":
            parts = text.split()
            _handle_watchlist(chat_id, parts)

        # ── /compare /비교 ───────────────────────────────
        elif cmd in ["/compare", "/비교"]:
            parts = text.split()
            if len(parts) < 3:
                send(chat_id, "두 종목을 입력해주세요.\n예: /compare NVDA TSLA\n예: /compare 엔비디아 테슬라")
            else:
                query = " ".join(parts[1:])
                send(chat_id, f"⚖️ {query} 비교 분석 중...")
                try:
                    from stock_analyzer import compare_stocks
                    result = compare_stocks(query)
                    send(chat_id, result)
                except Exception as e:
                    logger.error("compare error: %s", e)
                    send(chat_id, "비교 분석 중 오류가 발생했어요.")

        # ── /뉴스 ────────────────────────────────────
        elif cmd in ["/뉴스", "/news"]:
            parts = text.split()
            stock_query = " ".join(parts[1:]) if len(parts) > 1 else ""
            if stock_query:
                from stock_analyzer import resolve_ticker, summarize_news
                ticker = resolve_ticker(stock_query) or stock_query.upper()
                send(chat_id, f"📰 {ticker} 관련 뉴스 분석 중...")
                try:
                    result = summarize_news(ticker)
                    send(chat_id, result)
                except Exception as e:
                    logger.error("news error: %s", e)
                    send(chat_id, "뉴스 조회 중 오류가 발생했어요.")
            else:
                send(chat_id, "📰 오늘의 월가 뉴스 분석 중...")
                try:
                    from stock_analyzer import summarize_news
                    result = summarize_news()
                    send(chat_id, result)
                except Exception as e:
                    logger.error("news error: %s", e)
                    send(chat_id, "뉴스 조회 중 오류가 발생했어요.")

        # ── /모멘텀 ──────────────────────────────────
        elif cmd in ["/모멘텀", "/momentum", "/모멘"]:
            send(chat_id, "🚀 모멘텀 스크리너 실행 중... (약 15초)")
            try:
                from stock_analyzer import analyze_momentum
                result = analyze_momentum()
                send(chat_id, result)
            except Exception as e:
                logger.error("momentum error: %s", e)
                send(chat_id, "모멘텀 스캔 중 오류가 발생했어요.")

        # ── /배당 ────────────────────────────────────
        elif cmd in ["/배당", "/dividend", "/배당주"]:
            send(chat_id, "💰 고배당 종목 스캔 중... (약 10초)")
            try:
                from stock_analyzer import analyze_dividend_stocks
                result = analyze_dividend_stocks()
                send(chat_id, result)
            except Exception as e:
                logger.error("dividend error: %s", e)
                send(chat_id, "배당 분석 중 오류가 발생했어요.")

        # ── /52주 ────────────────────────────────────
        elif cmd in ["/52주", "/52week", "/고저가"]:
            send(chat_id, "📊 52주 신고가/신저가 종목 스캔 중...")
            try:
                from stock_analyzer import scan_52week
                result = scan_52week()
                send(chat_id, result)
            except Exception as e:
                logger.error("52week error: %s", e)
                send(chat_id, "52주 스캔 중 오류가 발생했어요.")

        # ── /섹터 ────────────────────────────────────
        elif cmd in ["/섹터", "/sector", "/sectors"]:
            send(chat_id, "📊 섹터 ETF 분석 중... (약 10초)")
            try:
                from stock_analyzer import analyze_sectors
                result = analyze_sectors()
                send(chat_id, result)
            except Exception as e:
                logger.error("sector error: %s", e)
                send(chat_id, "섹터 분석 중 오류가 발생했어요.")

        # ── /내통계 ──────────────────────────────────
        elif cmd in ["/내통계", "/stats", "/mystats"]:
            try:
                from subscribers import get_all
                from alerts import get_alerts
                from pathlib import Path
                import json as _json
                subs = get_all()
                is_sub = chat_id in subs
                wl_path = _WL_PATH
                wl_db = _json.loads(wl_path.read_text(encoding="utf-8")) if wl_path.exists() else {}
                watchlist = wl_db.get(chat_id, [])
                alerts_list = get_alerts(chat_id)
                from briefing_history import get_all_dates
                history_dates = get_all_dates()
                lines = [
                    "<b>📊 내 구해조 통계</b>\n",
                    f"구독 상태: {'✅ 구독 중' if is_sub else '❌ 미구독'}",
                    f"관심종목: {len(watchlist)}개 ({', '.join(watchlist[:3])}{'...' if len(watchlist)>3 else ''})" if watchlist else "관심종목: 없음",
                    f"가격 알림: {len(alerts_list)}개 활성 (최대 5개)",
                    f"보관된 브리핑: {len(history_dates)}일치",
                    "",
                    "<i>더 많은 기능: /help</i>",
                ]
                send(chat_id, "\n".join(lines))
            except Exception as e:
                logger.error("mystats error: %s", e)
                send(chat_id, "통계 조회 중 오류가 발생했어요.")

        # ── /랭킹 ────────────────────────────────────
        elif cmd in ["/랭킹", "/ranking"]:
            parts = text.split()
            category = parts[1].lower() if len(parts) > 1 else "crypto"
            RANKING_GROUPS = {
                "crypto": [("BTC", "BTC-USD"), ("ETH", "ETH-USD"), ("SOL", "SOL-USD"),
                           ("XRP", "XRP-USD"), ("BNB", "BNB-USD"), ("DOGE", "DOGE-USD"),
                           ("ADA", "ADA-USD"), ("AVAX", "AVAX-USD")],
                "bigtech": [("AAPL", "AAPL"), ("MSFT", "MSFT"), ("NVDA", "NVDA"),
                            ("AMZN", "AMZN"), ("GOOGL", "GOOGL"), ("META", "META"),
                            ("TSLA", "TSLA"), ("AVGO", "AVGO")],
                "kr": [("삼성전자", "005930.KS"), ("SK하이닉스", "000660.KS"),
                       ("LG에너지솔루션", "373220.KS"), ("POSCO홀딩스", "005490.KS"),
                       ("삼성바이오", "207940.KS"), ("카카오", "035720.KS")],
            }
            group = RANKING_GROUPS.get(category, RANKING_GROUPS["crypto"])
            emoji_map = {"crypto": "🪙", "bigtech": "🖥", "kr": "🇰🇷"}
            label_map = {"crypto": "암호화폐", "bigtech": "빅테크", "kr": "코스피 대형주"}
            send(chat_id, f"{emoji_map.get(category,'📊')} {label_map.get(category,'랭킹')} 시세 조회 중...")
            try:
                from collector import yf_quote
                results = []
                for label, sym in group:
                    q = yf_quote(sym)
                    if q:
                        results.append((label, q["price"], q["change_pct"]))
                results.sort(key=lambda x: x[2], reverse=True)
                cat_label = label_map.get(category, category)
                lines = [f"<b>{emoji_map.get(category,'📊')} {cat_label} 랭킹</b>\n"]
                for i, (name, price, pct) in enumerate(results, 1):
                    medal = ["", "🥇", "🥈", "🥉"].get(i, "") if i <= 3 else f"{i}."
                    sign = "+" if pct >= 0 else ""
                    col_arrow = "▲" if pct >= 0 else "▼"
                    lines.append(f"{medal} {name}: {col_arrow}{sign}{pct:.2f}%")
                lines.append(f"\n<i>/랭킹 crypto | bigtech | kr</i>")
                send(chat_id, "\n".join(lines))
            except Exception as e:
                logger.error("ranking error: %s", e)
                send(chat_id, "랭킹 조회 중 오류가 발생했어요.")

        # ── /차트 ────────────────────────────────────
        elif cmd in ["/차트", "/chart"]:
            parts = text.split()
            if len(parts) < 2:
                send(chat_id, "사용법: /차트 NVDA\n예: /차트 삼성전자 60 (60일)")
            else:
                query = parts[1]
                days = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 30
                days = max(7, min(90, days))
                from stock_analyzer import resolve_ticker, get_price_chart
                ticker = resolve_ticker(query) or query.upper()
                send(chat_id, f"📊 {ticker} {days}일 차트 조회 중...")
                try:
                    result = get_price_chart(ticker, days)
                    send(chat_id, result)
                except Exception as e:
                    logger.error("chart error: %s", e)
                    send(chat_id, "차트 조회 중 오류가 발생했어요.")

        # ── /한줄 ────────────────────────────────────
        elif cmd in ["/한줄", "/oneliner", "/요약"]:
            send(chat_id, "✍️ 오늘 시장 한줄 요약 중...")
            try:
                from stock_analyzer import one_line_summary
                result = one_line_summary()
                share_markup = {
                    "inline_keyboard": [[
                        {"text": "공유하기", "url": "https://t.me/share/url?url=https%3A%2F%2F9haejo.vercel.app"},
                    ]]
                }
                send(chat_id, result, reply_markup=share_markup)
            except Exception as e:
                logger.error("one_line error: %s", e)
                send(chat_id, "한줄 요약 중 오류가 발생했어요.")

        # ── /주간 ────────────────────────────────────
        elif cmd in ["/주간", "/weekly"]:
            send(chat_id, "📅 이번 주 성적표 조회 중...")
            try:
                from stock_analyzer import weekly_summary
                result = weekly_summary()
                send(chat_id, result)
            except Exception as e:
                logger.error("weekly error: %s", e)
                send(chat_id, "주간 요약 중 오류가 발생했어요.")

        # ── /매크로 ──────────────────────────────────
        elif cmd in ["/매크로", "/macro"]:
            send(chat_id, "🌐 매크로 시황 분석 중...")
            try:
                from stock_analyzer import analyze_macro
                result = analyze_macro()
                send(chat_id, result)
            except Exception as e:
                logger.error("macro error: %s", e)
                send(chat_id, "매크로 분석 중 오류가 발생했어요.")

        # ── /sector ──────────────────────────────────
        elif cmd == "/sector":
            parts = text.split()
            sector_query = " ".join(parts[1:]).lower() if len(parts) > 1 else ""
            ticker = SECTOR_MAP.get(sector_query)
            if not ticker:
                send(chat_id, "섹터를 입력해주세요.\n예: /sector 반도체\n(반도체/기술/에너지/금융/소비/통신)")
            else:
                send(chat_id, f"⏳ {sector_query} 섹터 분석 중...")
                try:
                    from stock_analyzer import analyze_stock
                    result = analyze_stock(ticker)
                    send(chat_id, result)
                except Exception as e:
                    send(chat_id, "섹터 분석 중 오류가 발생했어요.")

        # ── /종목전망 ─────────────────────────────────────
        elif cmd in ["/종목전망", "/outlook"]:
            parts = text.split()
            if len(parts) < 2:
                send(chat_id, "사용법: /종목전망 NVDA\n예: /종목전망 삼성전자")
            else:
                query = " ".join(parts[1:])
                from stock_analyzer import resolve_ticker, analyze_outlook
                ticker = resolve_ticker(query) or query.upper()
                send(chat_id, f"🔭 {ticker} 주간 전망 분석 중...")
                try:
                    result = analyze_outlook(ticker)
                    send(chat_id, result)
                except Exception as e:
                    logger.error("outlook error: %s", e)
                    send(chat_id, "전망 분석 중 오류가 발생했어요.")

        # ── /실적 ────────────────────────────────────────
        elif cmd in ["/실적", "/earnings", "/어닝"]:
            from datetime import date
            today = date.today()
            # Q2 2026 어닝 시즌 주요 종목 (하드코딩, 예상치)
            EARNINGS = [
                (date(2026, 7, 15), "JPM", "JP모건", "EPS 예상 $4.20"),
                (date(2026, 7, 16), "GS", "골드만삭스", "EPS 예상 $8.50"),
                (date(2026, 7, 22), "TSLA", "테슬라", "EPS 예상 $0.72"),
                (date(2026, 7, 23), "GOOGL", "알파벳", "EPS 예상 $2.15"),
                (date(2026, 7, 24), "META", "메타", "EPS 예상 $5.90"),
                (date(2026, 7, 28), "AAPL", "애플", "EPS 예상 $1.58"),
                (date(2026, 7, 29), "MSFT", "마이크로소프트", "EPS 예상 $3.10"),
                (date(2026, 7, 30), "AMZN", "아마존", "EPS 예상 $1.42"),
                (date(2026, 8, 6), "NVDA", "엔비디아", "EPS 예상 $0.84"),
                (date(2026, 8, 13), "AVGO", "브로드컴", "EPS 예상 $1.20"),
            ]
            upcoming = [(d, sym, name, eps) for d, sym, name, eps in EARNINGS if d >= today][:6]
            past = [(d, sym, name, eps) for d, sym, name, eps in EARNINGS if d < today][-2:]
            lines = ["<b>📊 Q2 2026 어닝 캘린더</b>\n"]
            if past:
                lines.append("<b>발표 완료</b>")
                for d, sym, name, eps in past:
                    ago = (today - d).days
                    lines.append(f"  <s>{d.strftime('%m/%d')} {sym} ({name})</s> — {ago}일 전")
                lines.append("")
            lines.append("<b>예정 발표</b>")
            for d, sym, name, eps in upcoming:
                left = (d - today).days
                marker = " ⚡" if left <= 7 else ""
                lines.append(f"  {d.strftime('%m/%d')} <b>{sym}</b> ({name})\n    {eps} · D-{left}{marker}")
            lines.append("\n<i>예상치는 FactSet 컨센서스 기준, 변동될 수 있습니다</i>")
            send(chat_id, "\n".join(lines))

        # ── /캘린더 ──────────────────────────────────────
        elif cmd in ["/캘린더", "/calendar", "/일정", "/캘", "/schedule"]:
            from datetime import date, timedelta
            today = date.today()
            # 2026 주요 경제지표 일정 (하드코딩)
            EVENTS = [
                (date(2026, 6, 3), "NFP", "비농업고용 (5월)"),
                (date(2026, 6, 5), "ISM", "ISM 서비스업 PMI"),
                (date(2026, 6, 11), "CPI", "소비자물가지수 (5월)"),
                (date(2026, 6, 17), "FOMC", "FOMC 회의 시작"),
                (date(2026, 6, 18), "FOMC", "FOMC 결과 발표 + 파월 기자회견"),
                (date(2026, 6, 26), "PCE", "PCE 물가지수 (5월)"),
                (date(2026, 7, 2), "NFP", "비농업고용 (6월)"),
                (date(2026, 7, 9), "FOMC", "FOMC 의사록 공개"),
                (date(2026, 7, 10), "CPI", "소비자물가지수 (6월)"),
                (date(2026, 7, 28), "FOMC", "FOMC 회의 시작"),
                (date(2026, 7, 29), "FOMC", "FOMC 결과 발표"),
                (date(2026, 7, 31), "GDP", "2Q GDP 속보치"),
            ]
            upcoming = [(d, tag, name) for d, tag, name in EVENTS if d >= today][:6]
            past = [(d, tag, name) for d, tag, name in EVENTS if d < today][-2:]
            tag_emoji = {"FOMC": "🏦", "CPI": "📊", "NFP": "👥", "PCE": "💰", "ISM": "🏭", "GDP": "📈"}
            lines = ["<b>📅 주요 경제지표 일정</b>\n"]
            for d, tag, name in past:
                emoji = tag_emoji.get(tag, "📌")
                days_ago = (today - d).days
                lines.append(f"{emoji} <s>{d.strftime('%m/%d')} {name}</s> ({days_ago}일 전)")
            lines.append("")
            for d, tag, name in upcoming:
                emoji = tag_emoji.get(tag, "📌")
                days_left = (d - today).days
                marker = " ← 다음!" if days_left <= 3 else ""
                lines.append(f"{emoji} {d.strftime('%m/%d')} <b>{name}</b> ({days_left}일 후){marker}")
            lines.append("\n<i>FOMC=금리결정 CPI=인플레 NFP=고용 PCE=물가 GDP=성장</i>")
            send(chat_id, "\n".join(lines))

        # ── /상승 /하락 ──────────────────────────────────
        elif cmd in ["/상승", "/gainers", "/하락", "/losers"]:
            is_up = cmd in ["/상승", "/gainers"]
            parts = text.split()
            sector_filter = " ".join(parts[1:]).lower() if len(parts) > 1 else ""
            SECTOR_STOCKS = {
                "tech": ["AAPL","MSFT","GOOGL","META","NVDA","AMD","INTC","QCOM","AVGO","TSM"],
                "기술": ["AAPL","MSFT","GOOGL","META","NVDA","AMD","INTC","QCOM","AVGO","TSM"],
                "반도체": ["NVDA","AMD","INTC","QCOM","AVGO","TSM","ASML","MU","AMAT","KLAC"],
                "ai": ["NVDA","MSFT","GOOGL","META","AAPL","AMZN","CRM","PLTR","AI","SOUN"],
                "ev": ["TSLA","RIVN","LCID","NIO","LI","XPEV","F","GM","STLA"],
                "전기차": ["TSLA","RIVN","LCID","NIO","LI","XPEV","F","GM"],
                "finance": ["JPM","GS","BAC","WFC","MS","BRK-B","V","MA","PYPL","SQ"],
                "금융": ["JPM","GS","BAC","WFC","MS","BRK-B","V","MA","PYPL","SQ"],
                "energy": ["XOM","CVX","COP","EOG","SLB","OXY","PSX","VLO","MPC","HAL"],
                "에너지": ["XOM","CVX","COP","EOG","SLB","OXY"],
                "crypto": ["COIN","MSTR","MARA","RIOT","CLSK","BTBT","HUT","IREN"],
                "크립토": ["COIN","MSTR","MARA","RIOT","CLSK"],
                "health": ["JNJ","UNH","PFE","ABBV","MRK","LLY","BMY","AMGN","GILD","ISRG"],
                "바이오": ["LLY","ABBV","MRK","AMGN","GILD","ISRG","REGN","BIIB","MRNA"],
            }
            from collector import yf_quote, BIG_STOCKS
            if sector_filter and sector_filter in SECTOR_STOCKS:
                syms = SECTOR_STOCKS[sector_filter]
                label = sector_filter.upper()
                symbol_map = {s: s for s in syms}
            else:
                symbol_map = BIG_STOCKS
                label = "빅테크"
            emoji = "📈" if is_up else "📉"
            send(chat_id, f"{emoji} {label} {'상승' if is_up else '하락'} 종목 조회 중...")
            try:
                items = [(name, yf_quote(sym)) for name, sym in symbol_map.items()]
                items = [(n, q) for n, q in items if q]
                items.sort(key=lambda x: x[1]["change_pct"], reverse=is_up)
                only_direction = [x for x in items if (x[1]["change_pct"] >= 0) == is_up]
                show = (only_direction or items)[:5]
                arrow_label = "상승 TOP 5" if is_up else "하락 TOP 5"
                lines = [f"<b>{emoji} {label} {arrow_label}</b>\n"]
                for name, q in show:
                    sign = "+" if q["change_pct"] >= 0 else ""
                    lines.append(f"{name}: ${q['price']:,.2f} {sign}{q['change_pct']:.2f}%")
                if sector_filter and sector_filter not in SECTOR_STOCKS:
                    lines.append(f"\n<i>섹터 예시: /{'상승' if is_up else '하락'} 반도체 | tech | ai | ev | 금융 | 에너지</i>")
                send(chat_id, "\n".join(lines))
            except Exception as e:
                logger.error("gainers/losers error: %s", e)
                send(chat_id, "조회 중 오류가 발생했어요.")

        # ── 종목 분석 (자유 텍스트) ──────────────────
        else:
            # 너무 짧거나 명백히 커맨드처럼 보이면 무시
            if len(text) < 2 or text.startswith("/"):
                send(chat_id, "❓ 명령어를 입력해주세요.\n/help 로 전체 커맨드를 확인하세요.", reply_markup=HELP_MENU)
                return

            from stock_analyzer import resolve_ticker
            ticker = resolve_ticker(text) or (text.upper() if text.isalpha() and len(text) <= 6 else None)
            display = ticker or text

            send(chat_id, f"🔍 <b>{display}</b> 분석 중... (10~20초 소요)")
            try:
                from stock_analyzer import analyze_stock, get_price_chart
                result = analyze_stock(text)
                send(chat_id, result)
                # 스파크라인 차트 추가 전송
                try:
                    t = ticker or text.upper()
                    chart = get_price_chart(t, 14)
                    if chart and "실패" not in chart:
                        send(chat_id, chart)
                except Exception:
                    pass
            except Exception as e:
                logger.error("stock analysis error: %s", e)
                retry_markup = {
                    "inline_keyboard": [[
                        {"text": f"🔄 {display} 다시 시도", "callback_data": text},
                        {"text": "📖 도움말", "callback_data": "__help_stock"},
                    ]]
                }
                send(chat_id, (
                    f"❌ <b>{display}</b> 분석 중 오류가 발생했어요.\n\n"
                    "잠시 후 다시 시도하거나 정확한 티커를 입력해주세요.\n\n"
                    "<b>예시:</b> <code>NVDA</code>  <code>TSLA</code>  <code>엔비디아</code>"
                ), reply_markup=retry_markup)

    except Exception as e:
        logger.error("handle_update error: %s", e)


def _handle_watchlist(chat_id: str, parts: list):
    """관심종목 관리 (파일 기반)"""
    import json
    from pathlib import Path

    wl_path = _WL_PATH
    try:
        wl_db = json.loads(wl_path.read_text(encoding="utf-8")) if wl_path.exists() else {}
    except Exception:
        wl_db = {}

    user_wl = wl_db.get(chat_id, [])

    if len(parts) >= 3 and parts[1].lower() == "add":
        ticker = parts[2].upper()
        if ticker not in user_wl:
            user_wl.append(ticker)
            wl_db[chat_id] = user_wl
            wl_path.write_text(json.dumps(wl_db, ensure_ascii=False, indent=2), encoding="utf-8")
            send(chat_id, f"✅ {ticker} 관심종목에 추가했습니다.\n현재 목록: {', '.join(user_wl)}")
        else:
            send(chat_id, f"{ticker}은 이미 관심종목에 있습니다.")

    elif len(parts) >= 3 and parts[1].lower() == "remove":
        ticker = parts[2].upper()
        if ticker in user_wl:
            user_wl.remove(ticker)
            wl_db[chat_id] = user_wl
            wl_path.write_text(json.dumps(wl_db, ensure_ascii=False, indent=2), encoding="utf-8")
            send(chat_id, f"삭제했습니다. 현재 목록: {', '.join(user_wl) if user_wl else '없음'}")
        else:
            send(chat_id, f"{ticker}은 관심종목에 없습니다.")

    else:
        if not user_wl:
            send(chat_id, "관심종목이 없습니다.\n추가: /watchlist add NVDA")
            return
        send(chat_id, "⏳ 관심종목 현황 조회 중...")
        from stock_analyzer import fetch_quote
        lines = [f"<b>내 관심종목</b> ({len(user_wl)}개)\n"]
        for sym in user_wl:
            q = fetch_quote(sym)
            if q:
                arrow = "▲" if q["change_pct"] >= 0 else "▼"
                lines.append(f"{sym}: ${q['price']:.2f} {arrow}{q['change_pct']:+.2f}%")
            else:
                lines.append(f"{sym}: 조회 실패")
        send(chat_id, "\n".join(lines))


# Webhook 라우터
from fastapi import APIRouter, Request, BackgroundTasks

router = APIRouter()


@router.post("/webhook/telegram")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    update = await request.json()
    logger.info("webhook recv: update_id=%s", update.get("update_id"))
    background_tasks.add_task(handle_update, update)
    return {"ok": True}

