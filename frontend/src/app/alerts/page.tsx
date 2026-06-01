"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

const C = {
  bg: "#07070f",
  surface: "#0d0d1a",
  card: "#111120",
  border: "#1a1a2e",
  green: "#00d97e",
  red: "#ff4466",
  blue: "#3b82f6",
  yellow: "#f59e0b",
  text: "#e8e8f0",
  muted: "#6b6b80",
  grad: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
};

interface AlertItem {
  ticker: string;
  target: number;
  direction: "above" | "below";
  current_price: number;
  pct_away: number | null;
  triggered: boolean;
}

export default function AlertsPage() {
  const [chatId, setChatId] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [found, setFound] = useState<boolean | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("watchlist_chat_id");
    if (saved) { setChatId(saved); setInputVal(saved); }
  }, []);

  const fetchAlerts = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/alerts/${encodeURIComponent(id.trim())}`);
      const d = await r.json();
      setFound(d.found);
      setAlerts(d.alerts || []);
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
    fetchAlerts(id);
  };

  useEffect(() => {
    if (!chatId) return;
    fetchAlerts(chatId);
    const id = setInterval(() => fetchAlerts(chatId), 60000);
    return () => clearInterval(id);
  }, [chatId]);

  const triggered = alerts.filter(a => a.triggered);
  const pending = alerts.filter(a => !a.triggered);

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
            <Link href="/watchlist" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>관심종목</Link>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 18px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              텔레그램 봇
            </a>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 8px" }}>🔔 가격 알림</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>텔레그램 봇의 가격 알림을 웹에서 실시간으로 모니터링하세요</p>
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

        {/* How to set alert */}
        <div style={{ padding: "14px 20px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 24, fontSize: 13, color: C.muted }}>
          💡 텔레그램에서 알림 설정: <code style={{ background: C.card, padding: "2px 8px", borderRadius: 4, color: C.text }}>/알림 NVDA 150</code> — NVDA가 $150 도달 시 알림
        </div>

        {/* Results */}
        {found === false && !loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
            <p style={{ fontSize: 16, color: C.muted }}>설정된 가격 알림이 없거나 올바르지 않은 Chat ID입니다.</p>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 16, padding: "12px 24px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, textDecoration: "none" }}>
              텔레그램에서 알림 설정하기
            </a>
          </div>
        )}

        {found && alerts.length > 0 && (
          <>
            {/* Summary */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ padding: "10px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                총 <b style={{ color: C.text }}>{alerts.length}개 알림</b>
              </div>
              {triggered.length > 0 && (
                <div style={{ padding: "10px 16px", borderRadius: 10, background: `${C.yellow}15`, border: `1px solid ${C.yellow}40`, fontSize: 13, color: C.yellow }}>
                  ⚡ 도달 {triggered.length}개
                </div>
              )}
              <div style={{ padding: "10px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                ⏳ 대기 {pending.length}개
              </div>
              {lastUpdated && (
                <div style={{ padding: "10px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, marginLeft: "auto" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.green, marginRight: 6 }} />
                  {lastUpdated.toLocaleTimeString("ko-KR")} 업데이트
                </div>
              )}
            </div>

            {/* Triggered alerts */}
            {triggered.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.yellow, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>⚡ 목표가 도달</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {triggered.map((a, i) => (
                    <Link key={i} href={`/stock/${a.ticker}`} style={{ textDecoration: "none" }}>
                      <div style={{ padding: "16px 20px", borderRadius: 14, background: C.card, border: `1px solid ${C.yellow}50` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: C.text }}>{a.ticker}</div>
                            <div style={{ fontSize: 12, color: C.yellow, marginTop: 2 }}>
                              ⚡ 목표가 ${a.target.toFixed(2)} {a.direction === "above" ? "이상" : "이하"} 도달!
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: C.text }}>${a.current_price.toFixed(2)}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>현재가</div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Pending alerts */}
            {pending.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>⏳ 대기 중</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pending.map((a, i) => {
                    const pctAway = a.pct_away;
                    const isClose = pctAway !== null && Math.abs(pctAway) < 5;
                    const color = isClose ? C.yellow : C.muted;
                    return (
                      <Link key={i} href={`/stock/${a.ticker}`} style={{ textDecoration: "none" }}>
                        <div style={{ padding: "16px 20px", borderRadius: 14, background: C.card, border: `1px solid ${isClose ? C.yellow + "40" : C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: C.text }}>{a.ticker}</div>
                              <div style={{ fontSize: 12, color, marginTop: 2 }}>
                                목표 ${a.target.toFixed(2)} {a.direction === "above" ? "이상" : "이하"}
                                {pctAway !== null && <span style={{ marginLeft: 8 }}>{isClose ? "⚡ 근접!" : ""} {Math.abs(pctAway).toFixed(1)}% {a.direction === "above" ? "남음" : "이상"}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: C.text }}>${a.current_price.toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>현재가</div>
                            </div>
                          </div>
                          {/* Progress bar toward target */}
                          {pctAway !== null && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ height: 3, borderRadius: 2, background: C.border }}>
                                <div style={{ height: "100%", borderRadius: 2, background: isClose ? C.yellow : C.blue, width: `${Math.max(5, Math.min(95, 100 - Math.abs(pctAway) * 5))}%`, transition: "width 0.5s" }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {!chatId && !loading && found === null && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🔔</div>
            <p style={{ fontSize: 18, color: C.text, fontWeight: 700, marginBottom: 8 }}>목표가 도달 알림을 웹에서 확인하세요</p>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
              @goohaejo_bot에서 <code style={{ background: C.card, padding: "2px 6px", borderRadius: 4 }}>/알림 NVDA 150</code> 으로 알림을 설정하면<br/>
              이 페이지에서 목표가 달성 여부를 실시간으로 모니터링할 수 있습니다.
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
