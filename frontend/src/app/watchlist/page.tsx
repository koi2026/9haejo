"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import NavSearch from "@/components/NavSearch";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

const C = {
  bg: "#07070f",
  surface: "#0d0d1a",
  card: "#111120",
  border: "#1a1a2e",
  green: "#00d97e",
  red: "#ff4466",
  blue: "#3b82f6",
  text: "#e8e8f0",
  muted: "#6b6b80",
  grad: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
};

interface WatchlistItem { ticker: string; price: number; change_pct: number; }

export default function WatchlistPage() {
  const [chatId, setChatId] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [found, setFound] = useState<boolean | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load saved chat ID
  useEffect(() => {
    const saved = localStorage.getItem("watchlist_chat_id");
    if (saved) { setChatId(saved); setInputVal(saved); }
  }, []);

  const fetchWatchlist = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/watchlist/${encodeURIComponent(id.trim())}`);
      const d = await r.json();
      setFound(d.found);
      setItems(d.tickers || []);
      setLastUpdated(new Date());
    } catch {
      setFound(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = inputVal.trim();
    if (!id) return;
    setChatId(id);
    localStorage.setItem("watchlist_chat_id", id);
    fetchWatchlist(id);
  };

  // Auto-refresh every 60s when loaded
  useEffect(() => {
    if (!chatId) return;
    fetchWatchlist(chatId);
    const id = setInterval(() => fetchWatchlist(chatId), 60000);
    return () => clearInterval(id);
  }, [chatId]);

  const totalUp = items.filter(i => i.change_pct >= 0).length;
  const totalDown = items.filter(i => i.change_pct < 0).length;
  const avgChange = items.length ? items.reduce((s, i) => s + i.change_pct, 0) / items.length : 0;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#07070f" }}>9</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>구해조</span>
          </Link>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/news" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>뉴스</Link>
            <Link href="/compare" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>비교</Link>
            <NavSearch />
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 18px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              텔레그램 봇
            </a>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 8px" }}>📋 내 관심종목</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>텔레그램 봇(@goohaejo_bot)의 관심종목을 웹에서 실시간으로 확인하세요</p>
        </div>

        {/* Chat ID Input */}
        <div style={{ padding: "24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            📱 텔레그램에서 <code style={{ background: C.surface, padding: "2px 6px", borderRadius: 4 }}>/내통계</code> 입력 후 나오는 Chat ID를 입력하세요
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="텔레그램 Chat ID (예: 123456789)"
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 10,
                background: C.surface, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 14, outline: "none",
              }}
            />
            <button type="submit" disabled={loading}
              style={{ padding: "12px 24px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}>
              {loading ? "조회 중..." : "조회하기"}
            </button>
          </form>
        </div>

        {/* Results */}
        {found === false && !loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 16, color: C.muted }}>관심종목이 없거나 올바르지 않은 Chat ID입니다.</p>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 16, padding: "12px 24px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, textDecoration: "none" }}>
              텔레그램에서 추가하기
            </a>
          </div>
        )}

        {found && items.length > 0 && (
          <>
            {/* Summary row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ padding: "10px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                총 <b style={{ color: C.text }}>{items.length}종목</b>
              </div>
              <div style={{ padding: "10px 16px", borderRadius: 10, background: `${C.green}12`, border: `1px solid ${C.green}30`, fontSize: 13, color: C.green }}>
                🟢 상승 <b>{totalUp}</b>
              </div>
              <div style={{ padding: "10px 16px", borderRadius: 10, background: `${C.red}12`, border: `1px solid ${C.red}30`, fontSize: 13, color: C.red }}>
                🔴 하락 <b>{totalDown}</b>
              </div>
              <div style={{ padding: "10px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 13, color: avgChange >= 0 ? C.green : C.red }}>
                평균 {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
              </div>
              {lastUpdated && (
                <div style={{ padding: "10px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, marginLeft: "auto" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.green, marginRight: 6 }} />
                  {lastUpdated.toLocaleTimeString("ko-KR")} 업데이트
                </div>
              )}
            </div>

            {/* Stock cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {items.map(item => {
                const up = item.change_pct >= 0;
                return (
                  <Link key={item.ticker} href={`/stock/${item.ticker}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "16px 20px", borderRadius: 14, background: C.card,
                      border: `1px solid ${up ? C.green + "30" : C.red + "25"}`,
                      cursor: "pointer", transition: "border-color 0.2s",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: C.text }}>{item.ticker}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: C.text }}>${item.price.toFixed(item.price < 10 ? 3 : 2)}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: up ? C.green : C.red, marginTop: 2 }}>
                            {up ? "▲+" : "▼"}{item.change_pct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.blue }}>📊 분석 →</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* CTA */}
            <div style={{ marginTop: 24, padding: "20px 24px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>텔레그램에서 더 많은 기능을 사용하세요</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                  style={{ padding: "10px 20px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  📱 봇에서 알림 설정
                </a>
                <Link href="/compare" style={{ padding: "10px 20px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  ⚖️ 종목 비교
                </Link>
              </div>
            </div>
          </>
        )}

        {!chatId && !loading && found === null && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: 18, color: C.text, fontWeight: 700, marginBottom: 8 }}>텔레그램 관심종목을 웹에서 확인하세요</p>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
              @goohaejo_bot에서 <code style={{ background: C.card, padding: "2px 6px", borderRadius: 4 }}>/watchlist add NVDA</code> 로 종목을 추가하면<br/>
              이 페이지에서 실시간 시세를 확인할 수 있습니다.
            </p>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "14px 32px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
              @goohaejo_bot 시작하기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
