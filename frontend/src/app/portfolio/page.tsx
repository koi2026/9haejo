"use client";
import { useState, useEffect } from "react";
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

interface Position {
  ticker: string;
  quantity: number;
  avgCost: number; // 평균 매수가
  name?: string;
}

interface LiveQuote {
  price: number;
  change_pct: number;
  name?: string;
}

const STORAGE_KEY = "9haejo_portfolio_v2";

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function savePositions(ps: Position[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ps));
}

function fmtUSD(v: number) {
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function DonutChart({ positions, quotes }: { positions: Position[]; quotes: Record<string, LiveQuote> }) {
  const colors = ["#00d97e", "#3b82f6", "#f59e0b", "#a78bfa", "#ec4899", "#06b6d4", "#ff4466", "#84cc16"];
  const values = positions.map((p, i) => {
    const q = quotes[p.ticker];
    const val = q ? q.price * p.quantity : p.avgCost * p.quantity;
    return { ticker: p.ticker, val, color: colors[i % colors.length] };
  });
  const total = values.reduce((s, v) => s + v.val, 0);
  if (total <= 0) return null;

  const R = 60, r = 38, cx = 80, cy = 80;
  let startAngle = -Math.PI / 2;
  const slices = values.map(v => {
    const pct = v.val / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const xi1 = cx + r * Math.cos(startAngle);
    const yi1 = cy + r * Math.sin(startAngle);
    const xi2 = cx + r * Math.cos(endAngle);
    const yi2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi2.toFixed(2)} ${yi2.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)} Z`;
    startAngle = endAngle;
    return { ...v, d, pct };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
        {slices.map(s => (
          <path key={s.ticker} d={s.d} fill={s.color} opacity={0.9} />
        ))}
        <circle cx={cx} cy={cy} r={r - 2} fill="#111120" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#e8e8f0" fontSize={11} fontWeight={700}>{positions.length}종목</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#6b6b80" fontSize={9}>보유</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {slices.map(s => (
          <div key={s.ticker} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 12, color: "#e8e8f0", minWidth: 50 }}>{s.ticker}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#1a1a2e", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.pct * 100}%`, background: s.color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: "#6b6b80", minWidth: 36, textAlign: "right" }}>{(s.pct * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllocationBar({ positions, quotes }: { positions: Position[]; quotes: Record<string, LiveQuote> }) {
  const colors = ["#00d97e", "#3b82f6", "#f59e0b", "#a78bfa", "#ec4899", "#06b6d4", "#ff4466", "#84cc16"];
  const values = positions.map((p, i) => {
    const q = quotes[p.ticker];
    const val = q ? q.price * p.quantity : p.avgCost * p.quantity;
    return { ticker: p.ticker, val, color: colors[i % colors.length] };
  });
  const total = values.reduce((s, v) => s + v.val, 0);
  if (total <= 0) return null;
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 10 }}>
        {values.map(v => (
          <div key={v.ticker} style={{ width: `${(v.val / total) * 100}%`, background: v.color, minWidth: 2 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {values.map(v => (
          <div key={v.ticker} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color, flexShrink: 0 }} />
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: C.text }}>{v.ticker}</span>
            <span>{((v.val / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [addTicker, setAddTicker] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  useEffect(() => {
    const ps = loadPositions();
    setPositions(ps);
    if (ps.length > 0) fetchQuotes(ps);
  // eslint-disable-next-line
  }, []);

  const fetchQuotes = async (ps: Position[]) => {
    if (ps.length === 0) return;
    setLoadingQuotes(true);
    const results: Record<string, LiveQuote> = {};
    await Promise.all(ps.map(async p => {
      try {
        const r = await fetch(`${API}/stock/quote/${p.ticker}`);
        const d = await r.json();
        if (!d.error && d.price) {
          results[p.ticker] = { price: d.price, change_pct: d.change_pct ?? 0, name: d.name };
        }
      } catch {}
    }));
    setQuotes(results);
    setLoadingQuotes(false);
    setLastRefresh(Date.now());
  };

  const addPosition = async () => {
    const t = addTicker.trim().toUpperCase();
    const qty = parseFloat(addQty);
    const cost = parseFloat(addCost);
    if (!t || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
      setAddError("티커, 수량, 평균단가를 모두 입력해주세요."); return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      const r = await fetch(`${API}/stock/quote/${t}`);
      const d = await r.json();
      if (d.error) { setAddError(`${t} 종목을 찾을 수 없습니다.`); return; }
      const existing = positions.find(p => p.ticker === t);
      let newPositions: Position[];
      if (existing) {
        // Average down/up
        const totalQty = existing.quantity + qty;
        const newAvg = (existing.avgCost * existing.quantity + cost * qty) / totalQty;
        newPositions = positions.map(p => p.ticker === t ? { ...p, quantity: totalQty, avgCost: newAvg } : p);
      } else {
        newPositions = [...positions, { ticker: t, quantity: qty, avgCost: cost, name: d.name }];
      }
      setPositions(newPositions);
      savePositions(newPositions);
      setQuotes(q => ({ ...q, [t]: { price: d.price, change_pct: d.change_pct ?? 0, name: d.name } }));
      setAddTicker(""); setAddQty(""); setAddCost("");
    } catch {
      setAddError("종목 조회에 실패했습니다.");
    } finally {
      setAddLoading(false);
    }
  };

  const removePosition = (ticker: string) => {
    const ps = positions.filter(p => p.ticker !== ticker);
    setPositions(ps);
    savePositions(ps);
    setQuotes(q => { const n = { ...q }; delete n[ticker]; return n; });
  };

  const totalCost = positions.reduce((s, p) => s + p.avgCost * p.quantity, 0);
  const totalValue = positions.reduce((s, p) => {
    const q = quotes[p.ticker];
    return s + (q ? q.price : p.avgCost) * p.quantity;
  }, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const isPositive = totalPnl >= 0;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 12, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, color: C.muted }}>포트폴리오</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NavSearch />
            <button onClick={() => fetchQuotes(positions)} disabled={loadingQuotes}
              style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {loadingQuotes ? "..." : "🔄 갱신"}
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, color: C.blue, fontFamily: "monospace", letterSpacing: 3, marginBottom: 6 }}>PORTFOLIO SIMULATOR</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 8 }}>내 포트폴리오</h1>
          <p style={{ fontSize: 14, color: C.muted }}>보유 종목을 입력하면 실시간 평가손익을 계산합니다. 데이터는 기기에만 저장됩니다.</p>
        </div>

        {/* Summary card */}
        {positions.length > 0 && (
          <div style={{ marginBottom: 24, borderRadius: 20, background: C.card, border: `1px solid ${isPositive ? C.green : C.red}30`, padding: "24px 28px", boxShadow: `0 0 40px ${isPositive ? C.green : C.red}08` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>총 평가금액</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{fmtUSD(totalValue)}</div>
                {lastRefresh > 0 && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>현재가 기준</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>총 매수금액</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.muted, fontFamily: "monospace" }}>{fmtUSD(totalCost)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>평가손익</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: isPositive ? C.green : C.red, fontFamily: "monospace" }}>
                  {isPositive ? "+" : ""}{fmtUSD(totalPnl)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isPositive ? C.green : C.red }}>
                  {isPositive ? "▲" : "▼"} {fmtPct(Math.abs(totalPnlPct))}
                </div>
              </div>
            </div>
            {/* 배분 시각화 탭 */}
            {positions.length >= 2 && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                <DonutChart positions={positions} quotes={quotes} />
              </div>
            )}
            {positions.length === 1 && <AllocationBar positions={positions} quotes={quotes} />}
          </div>
        )}

        {/* Positions list */}
        {positions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3 }}>POSITIONS</span>
              <span style={{ fontSize: 11, color: C.muted }}>{positions.length}개 종목</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {positions.map((p, idx) => {
                const q = quotes[p.ticker];
                const curPrice = q?.price ?? p.avgCost;
                const pnl = (curPrice - p.avgCost) * p.quantity;
                const pnlPct = ((curPrice - p.avgCost) / p.avgCost) * 100;
                const isUp = pnl >= 0;
                const totalVal = curPrice * p.quantity;
                const weight = totalValue > 0 ? (totalVal / totalValue) * 100 : 0;
                const colors = ["#00d97e", "#3b82f6", "#f59e0b", "#a78bfa", "#ec4899", "#06b6d4", "#ff4466", "#84cc16"];
                const dotColor = colors[idx % colors.length];
                return (
                  <div key={p.ticker} style={{ padding: "18px 20px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ width: 4, height: 44, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
                    <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                      <Link href={`/stock/${p.ticker}`} style={{ textDecoration: "none" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{p.ticker}</div>
                      </Link>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{q?.name || p.name || ""}</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                      <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>현재가</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>
                        {q ? fmtUSD(q.price) : "조회중..."}
                      </div>
                      {q && <div style={{ fontSize: 11, fontWeight: 700, color: q.change_pct >= 0 ? C.green : C.red }}>{fmtPct(q.change_pct)} 오늘</div>}
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                      <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>평균단가</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, fontFamily: "monospace" }}>{fmtUSD(p.avgCost)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{p.quantity}주</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                      <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>평가손익</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: isUp ? C.green : C.red, fontFamily: "monospace" }}>
                        {isUp ? "+" : ""}{fmtUSD(pnl)}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isUp ? C.green : C.red }}>{isUp ? "▲+" : "▼"}{Math.abs(pnlPct).toFixed(2)}%</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                      <div style={{ fontSize: 12, color: C.muted }}>비중</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: dotColor }}>{weight.toFixed(1)}%</div>
                    </div>
                    <button onClick={() => removePosition(p.ticker)}
                      style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
                      삭제
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add position form */}
        <div style={{ borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, padding: "24px 28px" }}>
          <div style={{ fontSize: 11, color: C.blue, fontFamily: "monospace", letterSpacing: 3, marginBottom: 16 }}>종목 추가</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>티커 심볼</label>
              <input
                value={addTicker} onChange={e => setAddTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && addPosition()}
                placeholder="AAPL"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontFamily: "monospace", fontWeight: 700, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>수량 (주)</label>
              <input
                value={addQty} onChange={e => setAddQty(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPosition()}
                placeholder="10"
                type="number" min="0.01" step="0.01"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>평균 매수가 ($)</label>
              <input
                value={addCost} onChange={e => setAddCost(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPosition()}
                placeholder="180.50"
                type="number" min="0.01" step="0.01"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button onClick={addPosition} disabled={addLoading}
              style={{ padding: "10px 20px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, border: "none", cursor: addLoading ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {addLoading ? "..." : "+ 추가"}
            </button>
          </div>
          {addError && <div style={{ marginTop: 10, fontSize: 12, color: C.red }}>{addError}</div>}
          <div style={{ marginTop: 12, fontSize: 11, color: C.muted }}>
            💡 이미 보유 중인 종목을 다시 추가하면 평균단가가 자동 계산됩니다.
          </div>
        </div>

        {/* Empty state */}
        {positions.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>아직 종목이 없습니다</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>보유 종목과 수량을 입력하면<br />실시간 평가손익을 확인할 수 있어요.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {["NVDA", "TSLA", "AAPL", "MSFT"].map(t => (
                <button key={t} onClick={() => setAddTicker(t)}
                  style={{ padding: "6px 14px", borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontFamily: "monospace", cursor: "pointer", fontWeight: 700 }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
