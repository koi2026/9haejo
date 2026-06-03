"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavSearch from "@/components/NavSearch";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

const C = {
  bg: "#07070f", surface: "#0d0d1a", card: "#111120", border: "#1a1a2e",
  green: "#00d97e", red: "#ff4466", blue: "#3b82f6",
  text: "#e8e8f0", muted: "#6b6b80",
  grad: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
  amber: "#f59e0b",
};

interface AlertItem {
  ticker: string;
  target: number;
  direction: "above" | "below";
  current_price: number;
  pct_away: number | null;
  triggered: boolean;
}

const CHATID_KEY = "9haejo_telegram_chat_id";

function ProgressBar({ current, target, direction }: { current: number; target: number; direction: "above" | "below" }) {
  if (!current || !target) return null;
  const pctAway = Math.abs((target - current) / current * 100);
  const isClose = pctAway < 5;
  const triggered = direction === "above" ? current >= target : current <= target;
  const color = triggered ? C.green : isClose ? C.amber : C.blue;
  const maxDist = 20;
  const progress = triggered ? 100 : Math.max(0, Math.min(100, (1 - pctAway / maxDist) * 100));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginBottom: 3 }}>
        <span>현재가 ${current.toFixed(2)}</span>
        <span style={{ color }}>{triggered ? "✅ 도달!" : `목표까지 ${pctAway.toFixed(1)}%`}</span>
        <span>목표 ${target.toFixed(2)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: C.border, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${progress}%`, background: color, borderRadius: 2, transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function AlertCard({ a, onDelete, deletingKey }: { a: AlertItem; onDelete: (a: AlertItem) => void; deletingKey: string | null }) {
  const key = `${a.ticker}-${a.target}`;
  const isDeleting = deletingKey === key;
  const up = a.direction === "above";
  const dirColor = up ? C.green : C.red;

  return (
    <div style={{
      padding: "16px 18px", borderRadius: 14, background: C.card,
      border: `1px solid ${a.triggered ? C.green + "40" : C.border}`,
      marginBottom: 8, position: "relative",
      boxShadow: a.triggered ? `0 0 16px ${C.green}10` : "none",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Link href={`/stock/${a.ticker}`} style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: "monospace", textDecoration: "none" }}>
              {a.ticker}
            </Link>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: `${dirColor}20`, color: dirColor, fontWeight: 700 }}>
              {up ? "📈 목표가" : "📉 손절가"}
            </span>
            {a.triggered && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✅ 도달!</span>}
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
            <div>
              <span style={{ color: C.muted, fontSize: 11 }}>목표가 </span>
              <span style={{ fontWeight: 900, color: dirColor, fontFamily: "monospace" }}>${a.target.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: C.muted, fontSize: 11 }}>현재가 </span>
              <span style={{ fontWeight: 700, color: C.text, fontFamily: "monospace" }}>${a.current_price.toFixed(2)}</span>
            </div>
          </div>
          <ProgressBar current={a.current_price} target={a.target} direction={a.direction} />
        </div>
        <button
          onClick={() => onDelete(a)}
          disabled={isDeleting}
          style={{
            width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", color: C.muted, fontSize: 14, cursor: isDeleting ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          {isDeleting ? "…" : "✕"}
        </button>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [chatId, setChatId] = useState("");
  const [chatIdInput, setChatIdInput] = useState("");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [ticker, setTicker] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(CHATID_KEY);
    if (saved) { setChatId(saved); setChatIdInput(saved); }
  }, []);

  const loadAlerts = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setFetchError("");
    try {
      const r = await fetch(`${API}/alerts/${id.trim()}`);
      const d = await r.json();
      if (Array.isArray(d.alerts)) {
        setAlerts(d.alerts);
        if (d.alerts.length === 0 && !d.found) {
          setFetchError("해당 Chat ID의 알림이 없습니다. 텔레그램에서 /알림 명령어로 설정하거나 아래 폼을 사용하세요.");
        }
      }
    } catch {
      setFetchError("알림을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (chatId) loadAlerts(chatId);
  }, [chatId, loadAlerts]);

  const saveChatId = () => {
    const id = chatIdInput.trim();
    if (!id) return;
    localStorage.setItem(CHATID_KEY, id);
    setChatId(id);
  };

  const addAlert = async () => {
    if (!chatId || !ticker.trim() || !targetPrice) return;
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");
    try {
      const r = await fetch(`${API}/alerts/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), target: parseFloat(targetPrice), direction }),
      });
      const d = await r.json();
      if (d.ok) {
        setAddSuccess(`✅ ${ticker.toUpperCase()} $${parseFloat(targetPrice).toFixed(2)} 알림 설정 완료!`);
        setTicker(""); setTargetPrice("");
        await loadAlerts(chatId);
        setTimeout(() => setAddSuccess(""), 4000);
      } else {
        setAddError(d.error || "알림 추가에 실패했습니다.");
      }
    } catch {
      setAddError("네트워크 오류가 발생했습니다.");
    } finally {
      setAddLoading(false);
    }
  };

  const deleteAlert = async (a: AlertItem) => {
    const key = `${a.ticker}-${a.target}`;
    setDeletingKey(key);
    try {
      await fetch(`${API}/alerts/${chatId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: a.ticker, target: a.target }),
      });
      await loadAlerts(chatId);
    } catch {} finally {
      setDeletingKey(null);
    }
  };

  const triggeredAlerts = alerts.filter(a => a.triggered);
  const activeAlerts = alerts.filter(a => !a.triggered);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        input:focus, select:focus { outline: none; border-color: #00d97e !important; box-shadow: 0 0 0 3px #00d97e12; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.97)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 11, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🔔 알림 관리</span>
          </div>
          <NavSearch />
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px 100px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: C.amber, fontFamily: "monospace", letterSpacing: 3, marginBottom: 6 }}>PRICE ALERTS</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>주가 알림 관리</h1>
          <p style={{ fontSize: 13, color: C.muted }}>목표 주가 도달 시 텔레그램으로 즉시 알림 · 웹에서 설정하고 앱으로 수신</p>
        </div>

        {/* Chat ID 설정 */}
        <div style={{ padding: "20px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 12, letterSpacing: 1 }}>TELEGRAM CHAT ID</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={chatIdInput}
              onChange={e => setChatIdInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveChatId()}
              placeholder="숫자 Chat ID (예: 123456789)"
              style={{
                flex: 1, minWidth: 180, padding: "10px 14px", borderRadius: 10,
                background: C.card, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 14, fontFamily: "monospace",
                transition: "border-color 0.15s",
              }}
            />
            <button onClick={saveChatId} style={{
              padding: "10px 20px", borderRadius: 10, background: C.grad,
              color: "#07070f", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer",
            }}>
              {chatId ? "변경" : "연결"}
            </button>
          </div>
          {chatId && (
            <div style={{ marginTop: 10, fontSize: 11, color: C.green }}>
              ✅ <span style={{ fontFamily: "monospace" }}>{chatId}</span> 연결됨
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            💡 <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>@goohaejo_bot</a>에서{" "}
            <code style={{ background: C.card, padding: "2px 6px", borderRadius: 4, color: C.amber }}>/내통계</code> 입력 → Chat ID 확인
          </div>
        </div>

        {chatId ? (
          <>
            {/* 알림 추가 */}
            <div style={{ padding: "20px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 14, letterSpacing: 1 }}>새 알림 추가</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && addAlert()}
                  placeholder="NVDA"
                  style={{
                    width: 90, padding: "10px 14px", borderRadius: 10,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                    transition: "border-color 0.15s",
                  }}
                />
                <select
                  value={direction}
                  onChange={e => setDirection(e.target.value as "above" | "below")}
                  style={{
                    padding: "10px 14px", borderRadius: 10,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, cursor: "pointer",
                  }}
                >
                  <option value="above">📈 이상 (목표가)</option>
                  <option value="below">📉 이하 (손절가)</option>
                </select>
                <input
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addAlert()}
                  placeholder="목표가 (예: 150.00)"
                  type="number"
                  step="0.01"
                  min="0"
                  style={{
                    flex: 1, minWidth: 140, padding: "10px 14px", borderRadius: 10,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 14, fontFamily: "monospace",
                    transition: "border-color 0.15s",
                  }}
                />
                <button
                  onClick={addAlert}
                  disabled={addLoading || !ticker.trim() || !targetPrice}
                  style={{
                    padding: "10px 20px", borderRadius: 10,
                    background: addLoading || !ticker.trim() || !targetPrice ? `${C.green}30` : C.grad,
                    color: "#07070f", fontWeight: 800, fontSize: 13, border: "none",
                    cursor: addLoading || !ticker.trim() || !targetPrice ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {addLoading ? "추가중…" : "+ 알림 추가"}
                </button>
              </div>
              {addError && <div style={{ marginTop: 10, fontSize: 12, color: C.red }}>{addError}</div>}
              {addSuccess && <div style={{ marginTop: 10, fontSize: 12, color: C.green, fontWeight: 700 }}>{addSuccess}</div>}
            </div>

            {/* 알림 목록 */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>⏳ 알림 불러오는 중...</div>
            ) : fetchError && alerts.length === 0 ? (
              <div style={{ padding: "32px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{fetchError}</div>
                <div style={{ marginTop: 14, fontSize: 11, color: C.muted }}>
                  텔레그램 예: <code style={{ background: C.card, padding: "2px 8px", borderRadius: 4, color: C.amber }}>/알림 NVDA 150</code>
                </div>
              </div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: "40px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>설정된 알림이 없습니다</div>
                <div style={{ fontSize: 13, color: C.muted }}>위 폼에서 첫 번째 알림을 추가해보세요!</div>
              </div>
            ) : (
              <div>
                {triggeredAlerts.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 2, marginBottom: 10 }}>🎯 목표가 도달 ({triggeredAlerts.length})</div>
                    {triggeredAlerts.map(a => (
                      <AlertCard key={`${a.ticker}-${a.target}`} a={a} onDelete={deleteAlert} deletingKey={deletingKey} />
                    ))}
                  </div>
                )}
                {activeAlerts.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>⏳ 대기 중 ({activeAlerts.length})</div>
                    {activeAlerts.map(a => (
                      <AlertCard key={`${a.ticker}-${a.target}`} a={a} onDelete={deleteAlert} deletingKey={deletingKey} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Telegram CTA */}
            <div style={{ marginTop: 32, padding: "16px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>텔레그램에서 더 많은 기능</div>
                <div style={{ fontSize: 11, color: C.muted }}>/알림목록 /알림취소 /포트폴리오 등 다양한 명령어 사용 가능</div>
              </div>
              <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                style={{ padding: "10px 18px", borderRadius: 10, background: "#229ED9", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
                텔레그램 열기 →
              </a>
            </div>
          </>
        ) : (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔔</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 10 }}>목표가 알림을 웹에서 관리하세요</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 28, lineHeight: 1.9 }}>
              텔레그램 Chat ID를 연결하면<br />
              목표가 설정·모니터링·삭제를 웹에서 할 수 있습니다
            </div>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "14px 32px", borderRadius: 14, background: "#229ED9", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
              @goohaejo_bot 시작하기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
