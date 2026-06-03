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
const SNAP_KEY = "9haejo_portfolio_snapshots_v1";

interface Snapshot { date: string; value: number; cost: number; }

function loadSnapshots(): Snapshot[] {
  try { const r = localStorage.getItem(SNAP_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveSnapshot(value: number, cost: number) {
  const today = new Date().toISOString().slice(0, 10);
  const snaps = loadSnapshots().filter(s => s.date !== today);
  snaps.push({ date: today, value, cost });
  // keep last 90 days
  const trimmed = snaps.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
  localStorage.setItem(SNAP_KEY, JSON.stringify(trimmed));
}

function PortfolioChart({ snapshots, totalValue }: { snapshots: Snapshot[]; totalValue: number }) {
  if (snapshots.length < 2) return (
    <div style={{ padding: "20px", textAlign: "center", color: "#6b6b80", fontSize: 12 }}>
      📈 내일부터 수익률 차트가 표시됩니다
    </div>
  );
  const W = 600, H = 120, PAD = { t: 12, b: 28, l: 8, r: 8 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  // compute pct change from first snapshot cost
  const baseCost = snapshots[0].cost;
  const pts = snapshots.map((s, i) => ({
    x: PAD.l + (i / (snapshots.length - 1)) * chartW,
    y: 0, // fill below
    pct: baseCost > 0 ? ((s.value - baseCost) / baseCost) * 100 : 0,
    date: s.date, value: s.value,
  }));
  const minPct = Math.min(...pts.map(p => p.pct));
  const maxPct = Math.max(...pts.map(p => p.pct));
  const range = maxPct - minPct || 1;
  pts.forEach(p => { p.y = PAD.t + (1 - (p.pct - minPct) / range) * chartH; });
  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `M ${pts[0].x.toFixed(1)},${(PAD.t + chartH).toFixed(1)} ` +
    pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L ${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + chartH).toFixed(1)} Z`;
  const lastPct = pts[pts.length - 1].pct;
  const isUp = lastPct >= 0;
  const color = isUp ? "#00d97e" : "#ff4466";
  // x-axis labels: first, middle, last
  const labelIdxs = [0, Math.floor(pts.length / 2), pts.length - 1];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#6b6b80", fontFamily: "monospace", letterSpacing: 2 }}>
          수익률 히스토리 ({snapshots.length}일)
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color, fontFamily: "monospace" }}>
          {isUp ? "+" : ""}{lastPct.toFixed(2)}%
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* zero line */}
        {minPct < 0 && maxPct > 0 && (() => {
          const zeroY = PAD.t + (1 - (0 - minPct) / range) * chartH;
          return <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#1a1a2e" strokeWidth={1} strokeDasharray="4,4" />;
        })()}
        <path d={area} fill="url(#chartGrad)" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* last dot */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4} fill={color} />
        {/* x-axis labels */}
        {labelIdxs.map(i => (
          <text key={i} x={pts[i].x} y={H - 4} textAnchor="middle" fill="#3a3a50" fontSize={9} fontFamily="monospace">
            {snapshots[i].date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

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
  const [aiDiag, setAiDiag] = useState("");
  const [aiDiagLoading, setAiDiagLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const runAiDiag = async () => {
    if (positions.length === 0) return;
    setAiDiagLoading(true);
    setAiDiag("");
    try {
      const r = await fetch(`${API}/portfolio/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });
      const d = await r.json();
      if (d.analysis) setAiDiag(d.analysis);
    } catch {
      setAiDiag("분석 중 오류가 발생했습니다.");
    } finally {
      setAiDiagLoading(false);
    }
  };

  useEffect(() => {
    const ps = loadPositions();
    setPositions(ps);
    setSnapshots(loadSnapshots());
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
    // save daily snapshot
    const cost = ps.reduce((s, p) => s + p.avgCost * p.quantity, 0);
    const value = ps.reduce((s, p) => {
      const q = results[p.ticker];
      return s + (q ? q.price : p.avgCost) * p.quantity;
    }, 0);
    if (value > 0) { saveSnapshot(value, cost); setSnapshots(loadSnapshots()); }
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
            {/* 수익률 히스토리 차트 */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              <PortfolioChart snapshots={snapshots} totalValue={totalValue} />
            </div>

            {/* 배분 시각화 탭 */}
            {positions.length >= 2 && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                <DonutChart positions={positions} quotes={quotes} />
              </div>
            )}
            {positions.length === 1 && <AllocationBar positions={positions} quotes={quotes} />}

            {/* AI 진단 */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              {!aiDiag && !aiDiagLoading && (
                <button onClick={runAiDiag} style={{
                  width: "100%", padding: "12px", borderRadius: 12,
                  background: "transparent", border: `1px dashed ${C.border}`,
                  color: C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#a78bfa"; (e.currentTarget as HTMLElement).style.color = "#a78bfa"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.muted; }}
                >
                  🤖 AI 포트폴리오 진단 받기
                </button>
              )}
              {aiDiagLoading && (
                <div style={{ padding: "14px", borderRadius: 12, background: "#0d0d1a", border: `1px solid #a78bfa30`, textAlign: "center", color: "#6b6b80", fontSize: 13 }}>
                  🤖 Claude AI가 포트폴리오를 분석 중입니다...
                </div>
              )}
              {aiDiag && (
                <div style={{ padding: "16px 18px", borderRadius: 12, background: "#0d0d1a", border: `1px solid #a78bfa40` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: 1, marginBottom: 10 }}>🤖 AI 포트폴리오 진단</div>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>{aiDiag}</p>
                  <button onClick={runAiDiag} style={{ marginTop: 10, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    다시 분석
                  </button>
                </div>
              )}
            </div>
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
