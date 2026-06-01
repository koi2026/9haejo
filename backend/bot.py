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
    ], [
        {"text": "🤖 나만의 AI 브리핑", "callback_data": "/AI"},
        {"text": "🚀 모멘텀 스크리너", "callback_data": "/모멘텀"},
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
        "/요약 — 지금 시황 즉시 한줄 (1초)\n"
        "/브리핑 — AI 종합 브리핑 (30초)\n"
        "/시황 — 지수+환율+섹터 히트맵\n"
        "/뉴스 — 월가 뉴스 AI 분석\n"
        "/AI — 나만의 watchlist 기반 브리핑\n"
        "/한줄 — 오늘 시장 공유용 요약\n"
        "/주간 — 이번 주 지수 성적표\n\n"
        "/구독 — 매일 8시 자동 브리핑\n"
        "/알람 09:00 — 원하는 시각 시황 자동 전송\n"
        "/구독취소 — 구독 해제"
    ),
    "__help_stock": (
        "🔍 <b>종목 분석</b>\n\n"
        "<b>티커/한국어 직접 입력:</b>\n"
        "<code>NVDA</code> <code>엔비디아</code> <code>테슬라</code>\n\n"
        "/비교 NVDA TSLA — 두 종목 AI 비교\n"
        "/종목전망 NVDA — 주간 AI 전망\n"
        "/차트 NVDA — 30일 스파크라인\n"
        "/뉴스 NVDA — 종목 뉴스 AI 분석\n\n"
        "<b>스크리너:</b>\n"
        "/모멘텀 — RSI+MA 모멘텀 종목\n"
        "/52주 — 52주 신고가/신저가 근접\n"
        "/배당 — 고배당 TOP10"
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
        "/금리 — 2/10/30년물 국채금리 + 수익률 곡선\n"
        "/원자재 — 금/은/오일/구리/천연가스\n"
        "/ETF — QQQ/SPY/ARKK/SOXX 등 ETF 분석\n"
        "/섹터 — SPDR 섹터별 성적표 + AI\n\n"
        "/매크로 — VIX, DXY, 금리, WTI 종합\n"
        "/캘린더 — FOMC/CPI/NFP 일정\n"
        "/환율 — USD/KRW, JPY, CNY AI 전망"
    ),
    "__help_ranking": (
        "🪙 <b>랭킹 & 통계</b>\n\n"
        "/랭킹 crypto — BTC ETH SOL 시세\n"
        "/랭킹 bigtech — 빅테크 7종목 랭킹\n"
        "/랭킹 kr — 코스피 대형주 랭킹\n\n"
        "/내통계 — 내 구독/관심종목/알림 현황\n"
        "/설정 — 개인 설정 보기\n\n"
        "9haejo.vercel.app 에서 웹으로도 확인!"
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
                from user_settings import get_settings
                user_lang = get_settings(chat_id).get("language", "ko")
                if use_cache and user_lang == "ko":
                    send(chat_id, f"📋 <b>오늘 브리핑 ({cached_date})</b> — 캐시됨")
                    result_tweets = cached_tweets
                else:
                    lang_msg = " (영어)" if user_lang == "en" else ""
                    send(chat_id, f"⏳ AI가 시장을 분석 중입니다{lang_msg}... (30초 정도 소요됩니다)")
                    from collector import collect_all
                    from summarizer import summarize
                    data = collect_all()
                    result = summarize(data, language=user_lang)
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
                lang = "영어" if s.get("language") == "en" else "한국어"
                send(chat_id, (
                    f"<b>내 설정</b>\n\n"
                    f"관심종목 브리핑 포함: {wl}\n"
                    f"브리핑 언어: {lang}\n\n"
                    "<b>변경하기:</b>\n"
                    "/설정 관심종목 켜기\n"
                    "/설정 관심종목 끄기\n"
                    "/설정 언어 영어\n"
                    "/설정 언어 한국어"
                ))
            elif len(parts) >= 3 and "관심종목" in parts[1]:
                on = parts[2] in ["켜기", "on", "true"]
                update_setting(chat_id, "watchlist_briefing", on)
                send(chat_id, f"관심종목 브리핑 포함: {'켜짐' if on else '꺼짐'} ✅")
            elif len(parts) >= 3 and "언어" in parts[1]:
                lang_choice = parts[2].lower()
                if lang_choice in ["영어", "en", "english"]:
                    update_setting(chat_id, "language", "en")
                    send(chat_id, "브리핑 언어가 영어(English)로 설정됐습니다. ✅\n/브리핑 으로 영어 브리핑을 받아보세요!")
                else:
                    update_setting(chat_id, "language", "ko")
                    send(chat_id, "브리핑 언어가 한국어로 설정됐습니다. ✅")
            else:
                send(chat_id, "사용법: /설정 관심종목 켜기/끄기 | /설정 언어 영어/한국어")

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

        # ── /요약 ────────────────────────────────────
        elif cmd in ["/요약", "/summary", "/지금", "/현재"]:
            try:
                from collector import yf_quote, collect_fear_greed
                from concurrent.futures import ThreadPoolExecutor, as_completed
                def get(sym): return sym, yf_quote(sym)
                results = {}
                with ThreadPoolExecutor(max_workers=5) as pool:
                    fts = {pool.submit(get, s): s for s in ["^GSPC", "^IXIC", "^VIX", "KRW=X"]}
                    for ft in as_completed(fts):
                        sym, q = ft.result()
                        if q: results[sym] = q
                fg = collect_fear_greed()
                sp = results.get("^GSPC", {})
                nq = results.get("^IXIC", {})
                vix = results.get("^VIX", {})
                krw = results.get("KRW=X", {})
                sp_str = f"S&P500 {'▲' if sp.get('change_pct',0)>=0 else '▼'}{abs(sp.get('change_pct',0)):.2f}%" if sp else "N/A"
                nq_str = f"NASDAQ {'▲' if nq.get('change_pct',0)>=0 else '▼'}{abs(nq.get('change_pct',0)):.2f}%" if nq else "N/A"
                vix_str = f"VIX {vix.get('price',0):.1f}" if vix else ""
                krw_str = f"USD/KRW {round(krw.get('price',0)):,}원" if krw else ""
                fg_str = f"F&G {fg.get('score','?')}/100 {fg.get('label_kr','')}" if fg else ""
                mood = "🔴 조심" if (fg.get('score',50) or 50) < 30 else "🟢 긍정" if (fg.get('score',50) or 50) > 65 else "🟡 중립"
                msg = (
                    f"<b>📊 지금 시장</b>\n\n"
                    f"{sp_str} | {nq_str}\n"
                    f"{vix_str} | {krw_str}\n"
                    f"{fg_str} {mood}"
                )
                send(chat_id, msg)
            except Exception as e:
                logger.error("요약 error: %s", e)
                send(chat_id, "시황 조회 중 오류가 발생했어요.")

        # ── /AI ──────────────────────────────────────
        elif cmd in ["/ai", "/AI", "/나의브리핑", "/개인브리핑"]:
            import json as _json
            wl_db = _json.loads(_WL_PATH.read_text(encoding="utf-8")) if _WL_PATH.exists() else {}
            user_wl = wl_db.get(chat_id, [])
            send(chat_id, "🤖 개인화 AI 브리핑 생성 중...")
            try:
                from stock_analyzer import personalized_ai_report
                result = personalized_ai_report(chat_id, user_wl)
                send(chat_id, result)
            except Exception as e:
                logger.error("personalized AI error: %s", e)
                send(chat_id, "AI 브리핑 생성 중 오류가 발생했어요.")

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

        # ── /알람 예약 ───────────────────────────────
        elif cmd in ["/알람", "/alarm", "/예약"]:
            parts = text.split()
            from user_settings import get_settings, update_setting
            if len(parts) >= 2:
                time_str = parts[1].strip()
                # 취소 처리
                if time_str in ["취소", "cancel", "off"]:
                    update_setting(chat_id, "alarm_time", None)
                    send(chat_id, "✅ 알람이 취소되었습니다.")
                else:
                    # HH:MM 형식 검증
                    import re
                    if re.match(r'^\d{1,2}:\d{2}$', time_str):
                        h, m = map(int, time_str.split(':'))
                        if 0 <= h <= 23 and 0 <= m <= 59:
                            alarm_kst = f"{h:02d}:{m:02d}"
                            update_setting(chat_id, "alarm_time", alarm_kst)
                            send(chat_id, (
                                f"🔔 <b>알람 예약 완료!</b>\n\n"
                                f"매일 <b>KST {alarm_kst}</b>에 시황 요약을 전송합니다.\n"
                                f"취소: /알람 취소"
                            ))
                        else:
                            send(chat_id, "올바른 시각을 입력해주세요 (예: /알람 09:00)")
                    else:
                        send(chat_id, "형식: /알람 09:00  (취소: /알람 취소)")
            else:
                settings = get_settings(chat_id)
                alarm = settings.get("alarm_time")
                if alarm:
                    send(chat_id, f"🔔 현재 알람: <b>KST {alarm}</b>\n취소: /알람 취소")
                else:
                    send(chat_id, (
                        "🔔 <b>시황 알람 예약</b>\n\n"
                        "/알람 09:00 — 매일 오전 9시 시황 자동 전송\n"
                        "/알람 취소 — 알람 해제\n\n"
                        "원하는 시각을 KST 기준으로 입력하세요."
                    ))

        # ── /금리 ────────────────────────────────────
        elif cmd in ["/금리", "/rate", "/rates", "/국채"]:
            send(chat_id, "📈 미국 국채금리 분석 중...")
            try:
                from stock_analyzer import analyze_interest_rates
                result = analyze_interest_rates()
                send(chat_id, result)
            except Exception as e:
                logger.error("rates error: %s", e)
                send(chat_id, "금리 분석 중 오류가 발생했어요.")

        # ── /원자재 ──────────────────────────────────
        elif cmd in ["/원자재", "/commodity", "/원자", "/오일", "/금값"]:
            send(chat_id, "🛢 원자재 시세 분석 중...")
            try:
                from stock_analyzer import analyze_commodities
                result = analyze_commodities()
                send(chat_id, result)
            except Exception as e:
                logger.error("commodity error: %s", e)
                send(chat_id, "원자재 분석 중 오류가 발생했어요.")

        # ── /ETF ─────────────────────────────────────
        elif cmd in ["/etf", "/ETF", "/이티에프"]:
            send(chat_id, "📦 주요 ETF 분석 중...")
            try:
                from stock_analyzer import analyze_etfs
                result = analyze_etfs()
                send(chat_id, result)
            except Exception as e:
                logger.error("ETF error: %s", e)
                send(chat_id, "ETF 분석 중 오류가 발생했어요.")

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
        elif cmd in ["/공포탐욕", "/fg", "/feargreed", "/fng"]:
            from collector import collect_fear_greed
            fg = collect_fear_greed()
            score = fg.get("score", 50)
            label = fg.get("label_kr", "중립")
            # ASCII gauge: 20-char wide
            filled = round(score / 5)  # 0-20
            bar = "[" + "#" * filled + "-" * (20 - filled) + "]"
            # Zone labels
            if score >= 75:
                emoji = "😈"
                advice = "시장이 과열 상태입니다. 리스크 관리에 주의하세요."
                color_zone = "극단적 탐욕 구간 (75-100)"
            elif score >= 55:
                emoji = "🤑"
                advice = "낙관론이 우세합니다. 일부 차익실현 고려해보세요."
                color_zone = "탐욕 구간 (55-74)"
            elif score >= 45:
                emoji = "😐"
                advice = "시장 방향성이 불확실합니다. 관망도 전략입니다."
                color_zone = "중립 구간 (45-54)"
            elif score >= 25:
                emoji = "😰"
                advice = "투자자들이 겁을 먹고 있습니다. 매수 기회를 탐색하세요."
                color_zone = "공포 구간 (25-44)"
            else:
                emoji = "😱"
                advice = "극도의 패닉 상태! 역발상 투자자에게는 매수 기회."
                color_zone = "극단적 공포 구간 (0-24)"
            # Zones visual
            zones = "공포탐욕 스펙트럼:\n"
            zones += "0   25   50   75  100\n"
            zones += "|극공포|공포|중립|탐욕|극탐욕|\n"
            marker_pos = round(score / 5)
            marker = " " * marker_pos + "^"
            zones += marker + f" {score:.0f}"
            send(chat_id, (
                f"<b>{emoji} 공포탐욕지수 (Fear & Greed)</b>\n\n"
                f"<code>0{' ' * 9}50{' ' * 8}100</code>\n"
                f"<code>{bar}</code>\n"
                f"<code>{' ' * (filled - 1)}^ {score:.1f}점</code>\n\n"
                f"<b>현재: {score:.1f}점 — {label}</b>\n"
                f"구간: {color_zone}\n\n"
                f"<i>{advice}</i>\n\n"
                f"출처: CNN Fear & Greed Index"
            ))

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

        # ── /IPO ─────────────────────────────────────────
        elif cmd in ["/ipo", "/IPO", "/상장"]:
            send(chat_id, "📋 IPO 종목 조회 중...")
            try:
                from stock_analyzer import get_ipo_calendar
                result = get_ipo_calendar()
                send(chat_id, result)
            except Exception as e:
                logger.error("IPO error: %s", e)
                send(chat_id, "IPO 정보 조회 중 오류가 발생했습니다.")

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

        # ── /실시간 — 종목 실시간 5분 추적 ─────────────
        # ── /옵션 — 종목 옵션 IV 공포지수 ──────────────
        elif cmd in ["/옵션", "/options", "/iv", "/IV"]:
            parts = text.split()
            raw_ticker = parts[1].upper() if len(parts) > 1 else "SPY"
            from stock_analyzer import resolve_ticker
            ticker = resolve_ticker(raw_ticker) or raw_ticker
            send(chat_id, f"📊 <b>{ticker}</b> 옵션 데이터 조회 중...")
            try:
                import yfinance as yf
                from collector import yf_quote
                from stock_analyzer import claude_call
                t = yf.Ticker(ticker)
                quote = yf_quote(ticker)
                if not quote:
                    send(chat_id, f"❌ {ticker} 시세를 가져올 수 없습니다.")
                else:
                    exps = t.options
                    if not exps:
                        send(chat_id, f"{ticker} 옵션 데이터가 없습니다.")
                    else:
                        # nearest expiry
                        exp = exps[0]
                        chain = t.option_chain(exp)
                        calls = chain.calls
                        puts = chain.puts
                        price = quote["price"]
                        # ATM options (near current price)
                        atm_calls = calls[abs(calls["strike"] - price) < price * 0.05]
                        atm_puts = puts[abs(puts["strike"] - price) < price * 0.05]
                        avg_call_iv = atm_calls["impliedVolatility"].mean() * 100 if len(atm_calls) > 0 else None
                        avg_put_iv = atm_puts["impliedVolatility"].mean() * 100 if len(atm_puts) > 0 else None
                        put_call_ratio = (len(puts) / len(calls)) if len(calls) > 0 else None
                        # IV fear gauge
                        avg_iv = (avg_call_iv or 0 + avg_put_iv or 0) / 2 if avg_call_iv and avg_put_iv else (avg_call_iv or avg_put_iv or 0)
                        if avg_iv > 60:
                            iv_mood = "극도의 공포 😱"
                        elif avg_iv > 40:
                            iv_mood = "공포 😰"
                        elif avg_iv > 25:
                            iv_mood = "보통 😐"
                        elif avg_iv > 15:
                            iv_mood = "낮음 🙂"
                        else:
                            iv_mood = "매우 낮음 😴"
                        pcr_label = ""
                        if put_call_ratio:
                            if put_call_ratio > 1.2:
                                pcr_label = "풋 우세 (하락 베팅 많음) 🐻"
                            elif put_call_ratio < 0.8:
                                pcr_label = "콜 우세 (상승 베팅 많음) 🐂"
                            else:
                                pcr_label = "중립"
                        lines = [f"<b>📊 {ticker} 옵션 분석 ({exp} 만기)</b>\n"]
                        lines.append(f"현재가: <b>${price:,.2f}</b>")
                        if avg_call_iv:
                            lines.append(f"콜 내재변동성(IV): <b>{avg_call_iv:.1f}%</b>")
                        if avg_put_iv:
                            lines.append(f"풋 내재변동성(IV): <b>{avg_put_iv:.1f}%</b>")
                        lines.append(f"IV 공포지수: <b>{iv_mood}</b>")
                        if put_call_ratio:
                            lines.append(f"풋/콜 비율: <b>{put_call_ratio:.2f}</b> — {pcr_label}")
                        lines.append(f"\n옵션 거래량: 콜 {len(calls)}개 / 풋 {len(puts)}개")
                        # AI commentary
                        try:
                            ai = claude_call("claude-haiku-4-5", (
                                f"{ticker} 옵션 데이터: ATM 콜 IV {avg_call_iv:.1f if avg_call_iv else 'N/A'}%, "
                                f"풋 IV {avg_put_iv:.1f if avg_put_iv else 'N/A'}%, P/C 비율 {put_call_ratio:.2f if put_call_ratio else 'N/A'}. "
                                f"이 데이터로 향후 시장 방향 및 투자자 심리를 한국어 2문장으로 해석해주세요."
                            ), max_tokens=200)
                            lines.append(f"\n<i>{ai}</i>")
                        except Exception:
                            pass
                        send(chat_id, "\n".join(lines))
            except Exception as e:
                logger.error("options error: %s", e)
                send(chat_id, f"옵션 데이터 조회 중 오류: {type(e).__name__}")

        # ── /목표가 — 애널리스트 컨센서스 ──────────────────
        elif cmd in ["/목표가", "/target", "/analyst", "/애널리스트"]:
            parts = text.split()
            if len(parts) < 2:
                send(chat_id, "사용법: /목표가 NVDA")
            else:
                raw = parts[1].upper()
                from stock_analyzer import resolve_ticker
                ticker = resolve_ticker(raw) or raw
                send(chat_id, f"📊 <b>{ticker}</b> 애널리스트 컨센서스 조회 중...")
                try:
                    import yfinance as yf
                    from collector import yf_quote
                    from stock_analyzer import claude_call
                    t = yf.Ticker(ticker)
                    quote = yf_quote(ticker)
                    current = quote["price"] if quote else None
                    # Analyst price targets
                    try:
                        apt = t.analyst_price_targets
                        mean_target = apt.get("mean") if apt else None
                        high_target = apt.get("high") if apt else None
                        low_target = apt.get("low") if apt else None
                        num_analysts = apt.get("numberOfAnalystOpinions") if apt else None
                    except Exception:
                        mean_target = high_target = low_target = num_analysts = None
                    # Recommendations summary
                    try:
                        rec = t.recommendations_summary
                        if rec is not None and len(rec) > 0:
                            latest = rec.iloc[0]
                            strong_buy = int(latest.get("strongBuy", 0))
                            buy = int(latest.get("buy", 0))
                            hold = int(latest.get("hold", 0))
                            sell = int(latest.get("sell", 0))
                            strong_sell = int(latest.get("strongSell", 0))
                        else:
                            strong_buy = buy = hold = sell = strong_sell = None
                    except Exception:
                        strong_buy = buy = hold = sell = strong_sell = None
                    lines = [f"<b>📊 {ticker} 애널리스트 컨센서스</b>\n"]
                    if current:
                        lines.append(f"현재가: <b>${current:,.2f}</b>")
                    if mean_target:
                        upside = ((mean_target - current) / current * 100) if current else None
                        arrow = "▲" if upside and upside > 0 else "▼"
                        lines.append(f"평균 목표주가: <b>${mean_target:,.2f}</b> {arrow}{abs(upside):.1f}% 여력" if upside else f"평균 목표주가: ${mean_target:,.2f}")
                    if high_target and low_target:
                        lines.append(f"목표가 범위: ${low_target:,.2f} ~ ${high_target:,.2f}")
                    if num_analysts:
                        lines.append(f"분석 애널리스트: {num_analysts}명")
                    if strong_buy is not None:
                        total = strong_buy + buy + hold + sell + strong_sell
                        if total > 0:
                            lines.append(f"\n<b>추천 분포:</b>")
                            lines.append(f"강력매수 {strong_buy} | 매수 {buy} | 보유 {hold} | 매도 {sell} | 강력매도 {strong_sell}")
                            buy_pct = (strong_buy + buy) / total * 100
                            hold_pct = hold / total * 100
                            sell_pct = (sell + strong_sell) / total * 100
                            consensus = "매수" if buy_pct >= 60 else "보유" if hold_pct >= 40 else "매도"
                            lines.append(f"컨센서스: <b>{consensus}</b> (매수 {buy_pct:.0f}% | 보유 {hold_pct:.0f}% | 매도 {sell_pct:.0f}%)")
                    if len(lines) <= 2:
                        send(chat_id, f"{ticker} 애널리스트 데이터를 가져올 수 없습니다.")
                    else:
                        # AI interpretation
                        try:
                            summary_data = f"현재가 ${current}, 목표가 ${mean_target}, 매수비율 {(strong_buy+buy)/((strong_buy+buy+hold+sell+strong_sell) or 1)*100:.0f}%"
                            ai = claude_call("claude-haiku-4-5", f"{ticker} {summary_data} 데이터로 투자 관점 한국어 1문장 코멘트.", max_tokens=100)
                            lines.append(f"\n<i>{ai}</i>")
                        except Exception:
                            pass
                        send(chat_id, "\n".join(lines))
                except Exception as e:
                    logger.error("analyst error: %s", e)
                    send(chat_id, f"목표가 조회 중 오류: {type(e).__name__}")

        # ── /포지션 — 수익률 계산 포트폴리오 ──────────────
        elif cmd in ["/포지션", "/position", "/수익"]:
            parts = text.split()
            from portfolio_positions import add_position, remove_position, get_positions
            from collector import yf_quote

            if len(parts) >= 4 and parts[1].lower() in ["add", "추가"]:
                # /포지션 add NVDA 10 875.50
                try:
                    ticker = parts[2].upper()
                    qty = float(parts[3])
                    cost = float(parts[4]) if len(parts) >= 5 else None
                    if cost is None:
                        # Use current price as cost basis
                        q = yf_quote(ticker)
                        cost = q["price"] if q else 0
                    add_position(chat_id, ticker, qty, cost)
                    total_cost = qty * cost
                    send(chat_id, (
                        f"✅ <b>{ticker}</b> 포지션 추가!\n\n"
                        f"수량: {qty}주 @ ${cost:,.2f}\n"
                        f"총 투자금액: ${total_cost:,.2f}\n\n"
                        f"/포지션 — 전체 수익률 확인"
                    ))
                except (ValueError, IndexError):
                    send(chat_id, "사용법: /포지션 add NVDA 10 875.50\n(수량 매수가)")
            elif len(parts) >= 3 and parts[1].lower() in ["remove", "삭제", "del"]:
                ticker = parts[2].upper()
                remove_position(chat_id, ticker)
                send(chat_id, f"🗑 <b>{ticker}</b> 포지션 삭제됨.")
            else:
                positions = get_positions(chat_id)
                if not positions:
                    send(chat_id, (
                        "📊 <b>수익률 포트폴리오</b>\n\n"
                        "매수가와 수량을 입력해서 수익률을 추적하세요!\n\n"
                        "<b>사용법:</b>\n"
                        "/포지션 add NVDA 10 875.50\n"
                        "  → NVDA 10주, 매수가 $875.50\n\n"
                        "/포지션 add TSLA 5\n"
                        "  → TSLA 5주, 현재가로 매수가 설정\n\n"
                        "/포지션 remove NVDA — 포지션 삭제"
                    ))
                else:
                    lines = ["<b>📊 내 포지션 수익률</b>\n"]
                    total_invested = 0
                    total_value = 0
                    for ticker, pos in positions.items():
                        q = yf_quote(ticker)
                        if not q:
                            lines.append(f"• {ticker}: 조회 실패")
                            continue
                        qty = pos["qty"]
                        cost = pos["cost_basis"]
                        current = q["price"]
                        invested = qty * cost
                        value = qty * current
                        pnl = value - invested
                        pnl_pct = (pnl / invested * 100) if invested else 0
                        total_invested += invested
                        total_value += value
                        arrow = "▲" if pnl >= 0 else "▼"
                        lines.append(
                            f"• <b>{ticker}</b> {qty}주 @ ${cost:,.2f}\n"
                            f"  현재 ${current:,.2f} {arrow}{abs(pnl_pct):.1f}%"
                            f"  ({'+' if pnl >= 0 else ''}{pnl:,.0f}$)"
                        )
                    total_pnl = total_value - total_invested
                    total_pct = (total_pnl / total_invested * 100) if total_invested else 0
                    lines.append(f"\n<b>총 투자금액:</b> ${total_invested:,.0f}")
                    lines.append(f"<b>현재 평가금액:</b> ${total_value:,.0f}")
                    lines.append(f"<b>총 수익:</b> {'+' if total_pnl >= 0 else ''}{total_pnl:,.0f}$ ({total_pct:+.1f}%)")
                    send(chat_id, "\n".join(lines))

        # ── /스크리너 — 통합 스크리너 (모멘텀/배당/52주/ETF) ─
        elif cmd in ["/스크리너", "/screener", "/screen"]:
            parts = text.split()
            mode = parts[1].lower() if len(parts) > 1 else ""
            if mode in ["모멘텀", "momentum"]:
                send(chat_id, "🚀 모멘텀 스크리너 분석 중...")
                try:
                    from stock_analyzer import analyze_momentum
                    send(chat_id, analyze_momentum())
                except Exception as e:
                    send(chat_id, f"오류: {e}")
            elif mode in ["배당", "dividend"]:
                send(chat_id, "💰 배당주 분석 중...")
                try:
                    from stock_analyzer import analyze_dividend_stocks
                    send(chat_id, analyze_dividend_stocks())
                except Exception as e:
                    send(chat_id, f"오류: {e}")
            elif mode in ["52주", "52week", "고저가"]:
                send(chat_id, "📊 52주 고저가 스캔 중...")
                try:
                    from stock_analyzer import scan_52week
                    send(chat_id, scan_52week())
                except Exception as e:
                    send(chat_id, f"오류: {e}")
            elif mode in ["etf", "ETF"]:
                send(chat_id, "📦 ETF 분석 중...")
                try:
                    from stock_analyzer import analyze_etfs
                    send(chat_id, analyze_etfs())
                except Exception as e:
                    send(chat_id, f"오류: {e}")
            else:
                # Show menu with inline buttons
                menu = {
                    "inline_keyboard": [[
                        {"text": "🚀 모멘텀", "callback_data": "/스크리너 모멘텀"},
                        {"text": "💰 배당주", "callback_data": "/스크리너 배당"},
                    ], [
                        {"text": "📊 52주 고저가", "callback_data": "/스크리너 52주"},
                        {"text": "📦 ETF 분석", "callback_data": "/스크리너 ETF"},
                    ]]
                }
                send(chat_id, (
                    "<b>🔍 통합 스크리너</b>\n\n"
                    "원하는 스크리너를 선택하세요:\n\n"
                    "🚀 <b>모멘텀</b> — RSI+MA 기반 강세 종목\n"
                    "💰 <b>배당</b> — 고배당 TOP10 종목\n"
                    "📊 <b>52주 고저가</b> — 신고가/신저가 근접 종목\n"
                    "📦 <b>ETF</b> — 주요 ETF 성과 분석"
                ), reply_markup=menu)

        elif cmd in ["/실시간", "/live", "/추적"]:
            parts = text.split()
            sub_cmd = parts[1].lower() if len(parts) > 1 else ""
            from realtime_tracker import add_tracker, remove_tracker, get_trackers
            from stock_analyzer import resolve_ticker
            from collector import yf_quote
            import yfinance as yf

            if sub_cmd in ["중지", "stop", "off", "취소", "끄기"]:
                remove_tracker(chat_id)
                send(chat_id, "⏹ 실시간 추적을 모두 중지했습니다.")
            elif sub_cmd and sub_cmd not in ["중지", "stop"]:
                raw = parts[1].upper()
                ticker = resolve_ticker(raw) or (raw if raw.isalpha() and len(raw) <= 6 else None)
                if not ticker:
                    send(chat_id, "❓ 종목 티커를 입력해주세요.\n예: /실시간 NVDA")
                else:
                    quote = yf_quote(ticker)
                    if not quote:
                        send(chat_id, f"❌ <b>{ticker}</b> 시세를 가져올 수 없습니다.")
                    else:
                        try:
                            info = yf.Ticker(ticker).fast_info
                            name = getattr(info, "display_name", None) or ticker
                        except Exception:
                            name = ticker
                        count = add_tracker(chat_id, ticker, name, quote["price"])
                        arrow = "▲" if quote["change_pct"] >= 0 else "▼"
                        send(chat_id, (
                            f"📡 <b>{name} ({ticker})</b> 실시간 추적 시작!\n\n"
                            f"현재가: <b>${quote['price']:,.2f}</b> {arrow}{abs(quote['change_pct']):.2f}%\n"
                            f"5분마다 가격 업데이트를 받습니다.\n\n"
                            f"활성 추적: {count}개\n"
                            f"/실시간 중지 — 추적 중단"
                        ))
            else:
                trackers = get_trackers(chat_id)
                if not trackers:
                    send(chat_id, (
                        "📡 <b>실시간 종목 추적</b>\n\n"
                        "5분마다 가격 업데이트를 받아보세요.\n\n"
                        "사용법:\n"
                        "/실시간 NVDA — NVIDIA 추적 시작\n"
                        "/실시간 TSLA — Tesla 추적 시작\n"
                        "/실시간 중지 — 모두 중단"
                    ))
                else:
                    lines = ["<b>📡 현재 추적 중인 종목</b>\n"]
                    for t, info in trackers.items():
                        q = yf_quote(t)
                        if q:
                            arrow = "▲" if q["change_pct"] >= 0 else "▼"
                            lines.append(f"• <b>{t}</b>: ${q['price']:,.2f} {arrow}{abs(q['change_pct']):.2f}%")
                        else:
                            lines.append(f"• <b>{t}</b>: 조회 실패")
                    lines.append("\n/실시간 중지 — 추적 중단")
                    send(chat_id, "\n".join(lines))

        # ── 종목 분석 (자유 텍스트) ──────────────────
        else:
            # 너무 짧거나 명백히 커맨드처럼 보이면 무시
            if len(text) < 2 or text.startswith("/"):
                send(chat_id, "❓ 명령어를 입력해주세요.\n/help 로 전체 커맨드를 확인하세요.", reply_markup=HELP_MENU)
                return

            from stock_analyzer import resolve_ticker
            ticker = resolve_ticker(text) or (text.upper() if text.isalpha() and len(text) <= 6 else None)
            display = ticker or text

            # 검색 카운터 증가
            if ticker:
                try:
                    from search_counter import increment as _inc
                    _inc(ticker)
                except Exception:
                    pass

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

