"use client";
import { useState, useEffect, use, useRef, useCallback } from "react";
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

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  analysis: string;
  sector?: string;
  market_cap?: number;
  pe_ratio?: number;
  week52_high?: number;
  week52_low?: number;
  volume?: number;
  avg_volume?: number;
  div_yield?: number;
  div_rate?: number;
  payout_ratio?: number;
  ex_div_date?: string;
}

// ===== EPISODE 11: 인터랙티브 차트 =====
interface ChartPt { x: number; y: number; price: number; date: string; }
function InteractiveChart({ pts, pathD, fillD, W, H, pad, color, minIdx, maxIdx, gridLevels, startDate, endDate }: {
  pts: ChartPt[]; pathD: string; fillD: string; W: number; H: number; pad: number; color: string;
  minIdx: number; maxIdx: number;
  gridLevels: { y: number; price: number }[];
  startDate: string; endDate: string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; price: number; date: string; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    // Find closest point
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setHover({ ...pts[best], idx: best });
  }, [pts, W]);

  const C_green = "#00d97e", C_red = "#ff4466", C_muted = "#6b6b80", C_border = "#1a1a2e";

  return (
    <div style={{ position: "relative" }}>
      {/* Hover tooltip */}
      {hover && (
        <div style={{
          position: "absolute", top: 0,
          left: Math.min(Math.max((hover.x / W) * 100, 8), 75) + "%",
          background: "#111120", border: `1px solid ${color}40`,
          borderRadius: 8, padding: "6px 10px", pointerEvents: "none",
          zIndex: 10, whiteSpace: "nowrap", transform: "translateX(-50%)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 900, color, fontFamily: "monospace" }}>${hover.price.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: C_muted }}>{hover.date}</div>
        </div>
      )}
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible", display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chartFillIG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {gridLevels.map((g, i) => (
          <g key={i}>
            <line x1={pad} y1={g.y} x2={W - pad} y2={g.y} stroke={C_border} strokeWidth="1" strokeDasharray={i === 0 ? "0" : "4,4"} />
            <text x={W - pad + 4} y={g.y + 4} fontSize="9" fill={C_muted} fontFamily="monospace">${g.price.toFixed(0)}</text>
          </g>
        ))}
        {/* Fill */}
        <path d={fillD} fill="url(#chartFillIG)" />
        {/* Line */}
        <path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Min/Max markers */}
        <circle cx={pts[minIdx].x} cy={pts[minIdx].y} r="4" fill={C_red} />
        <text x={pts[minIdx].x} y={pts[minIdx].y + 15} textAnchor="middle" fontSize="9" fill={C_red} fontFamily="monospace">${pts[minIdx].price.toFixed(0)}</text>
        <circle cx={pts[maxIdx].x} cy={pts[maxIdx].y} r="4" fill={C_green} />
        <text x={pts[maxIdx].x} y={pts[maxIdx].y - 8} textAnchor="middle" fontSize="9" fill={C_green} fontFamily="monospace">${pts[maxIdx].price.toFixed(0)}</text>
        {/* Last dot */}
        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="5" fill={color} />
        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} y1={pad} x2={hover.x} y2={H - pad} stroke={color} strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
            <circle cx={hover.x} cy={hover.y} r="5" fill={color} stroke="#07070f" strokeWidth="2" />
          </>
        )}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: C_muted, fontFamily: "monospace" }}>{startDate}</span>
        <span style={{ fontSize: 10, color: C_muted, fontFamily: "monospace" }}>{endDate}</span>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: highlight ? C.green : C.text, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function Sparkline({ prices, color }: { prices: number[]; color: string }) {
  if (!prices || prices.length < 2) return null;
  const W = 280, H = 60, pad = 4;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  const fillD = `${pathD} L ${(W - pad).toFixed(1)},${(H - pad).toFixed(1)} L ${pad},${(H - pad).toFixed(1)} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#sparkFill)" />
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={parseFloat(pts[pts.length - 1].split(",")[0])} cy={parseFloat(pts[pts.length - 1].split(",")[1])} r="3" fill={color} />
    </svg>
  );
}

interface PeerStock { ticker: string; price: number; change_pct: number; }

export default function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const upperTicker = ticker.toUpperCase();
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sparkPrices, setSparkPrices] = useState<number[]>([]);
  const [peers, setPeers] = useState<PeerStock[]>([]);
  const [peerSector, setPeerSector] = useState("");
  const [indices, setIndices] = useState<{ label: string; price: string; pct: number }[]>([]);
  const [chartDays, setChartDays] = useState(30);
  const [chartPrices, setChartPrices] = useState<number[]>([]);
  const [chartDates, setChartDates] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [technicals, setTechnicals] = useState<{
    rsi: number; rsi_signal: string;
    ma20: number; ma50: number | null;
    above_ma20: boolean; above_ma50: boolean | null;
    macd: number | null; macd_signal: string;
    vol_ratio: number; vol_spike: boolean; trend: string;
  } | null>(null);
  const [analyst, setAnalyst] = useState<{
    mean_target: number | null; high_target: number | null; low_target: number | null;
    upside_pct: number | null; num_analysts: number | null; recommendation: string;
    strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; total: number;
  } | null>(null);
  const [stockNews, setStockNews] = useState<{
    title: string; source: string; url: string; sentiment: string; score: number; summary: string; published: string;
  }[]>([]);
  const [financials, setFinancials] = useState<{
    quarters: string[]; eps: (number | null)[]; revenue: (number | null)[];
    ttm_eps?: number | null; forward_eps?: number | null;
  } | null>(null);
  const [grade, setGrade] = useState<{
    grade: string; grade_label: string; grade_color: string;
    total_score: number; scores: Record<string, number>;
    ai_comment: string; grade_descriptions: Record<string, string>;
  } | null>(null);
  const [showGradeDetail, setShowGradeDetail] = useState(false);
  const [beginnerMode, setBeginnerMode] = useState(false);

  const fetchQuote = () => {
    fetch(`${API}/stock/${upperTicker}`)
      .then(r => r.json())
      .then(d => { if (!d.error) { setData(d); setLastUpdated(Date.now()); } })
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API}/stock/${upperTicker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else { setData(d); setLastUpdated(Date.now()); }
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
    // Auto-refresh every 60s
    const refreshId = setInterval(fetchQuote, 60000);
    // 스파크라인 14일 히스토리 (헤더용)
    fetch(`${API}/stock/history/${upperTicker}?days=14`)
      .then(r => r.json())
      .then(d => { if (d.prices?.length) setSparkPrices(d.prices); })
      .catch(() => {});
    // 기술 지표
    fetch(`${API}/stock/${upperTicker}/technicals`)
      .then(r => r.json())
      .then(d => { if (!d.error) setTechnicals(d); })
      .catch(() => {});
    // 애널리스트 컨센서스
    fetch(`${API}/stock/${upperTicker}/analyst`)
      .then(r => r.json())
      .then(d => { if (!d.error && d.total > 0) setAnalyst(d); })
      .catch(() => {});
    // 동종 종목
    fetch(`${API}/stock/${upperTicker}/peers`)
      .then(r => r.json())
      .then(d => { if (d.peers?.length) { setPeers(d.peers); setPeerSector(d.sector || ""); } })
      .catch(() => {});
    // 주식 건강 점수
    fetch(`${API}/stock/${upperTicker}/grade`)
      .then(r => r.json())
      .then(d => { if (d.grade) setGrade(d); })
      .catch(() => {});
    // 재무 데이터 (EPS·매출)
    fetch(`${API}/stock/${upperTicker}/financials`)
      .then(r => r.json())
      .then(d => { if (d.quarters?.length || d.ttm_eps) setFinancials(d); })
      .catch(() => {});
    // 종목 뉴스
    fetch(`${API}/stock/${upperTicker}/news`)
      .then(r => r.json())
      .then(d => { if (d.news?.length) setStockNews(d.news); })
      .catch(() => {});
    // 지수 티커 (nav 바 아래)
    fetch(`${API}/market/live`)
      .then(r => r.json())
      .then(d => {
        const items = [
          { label: "S&P500", price: d.indices?.["S&P500"]?.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "", pct: d.indices?.["S&P500"]?.change_pct ?? 0 },
          { label: "NASDAQ", price: d.indices?.["NASDAQ"]?.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "", pct: d.indices?.["NASDAQ"]?.change_pct ?? 0 },
          { label: "DOW", price: d.indices?.["DOW"]?.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "", pct: d.indices?.["DOW"]?.change_pct ?? 0 },
          { label: "USD/KRW", price: "₩" + Math.round(d.fx?.["USD/KRW"]?.price || 0).toLocaleString("ko-KR"), pct: d.fx?.["USD/KRW"]?.change_pct ?? 0 },
          { label: "VIX", price: (d.indices?.["VIX"]?.price || 0).toFixed(2), pct: d.indices?.["VIX"]?.change_pct ?? 0 },
        ].filter(x => x.price);
        setIndices(items);
      })
      .catch(() => {});
    return () => clearInterval(refreshId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upperTicker]);

  // 차트 기간 변경 시 재조회
  useEffect(() => {
    setChartPrices([]);
    setChartDates([]);
    fetch(`${API}/stock/history/${upperTicker}?days=${chartDays}`)
      .then(r => r.json())
      .then(d => { if (d.prices?.length) { setChartPrices(d.prices); setChartDates(d.dates || []); } })
      .catch(() => {});
  }, [upperTicker, chartDays]);

  const secondsAgo = Math.round((Date.now() - lastUpdated) / 1000);
  const shareUrl = `https://9haejo.vercel.app/stock/${upperTicker}`;
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fmtCap = (v?: number) => {
    if (!v) return "N/A";
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    return `$${(v / 1e6).toFixed(0)}M`;
  };

  const fmtVol = (v?: number) => {
    if (!v) return "N/A";
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return `${v}`;
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 12, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>{upperTicker}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NavSearch />
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 18px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              봇에서 분석하기
            </a>
          </div>
        </div>
      </nav>

      {/* INDICES BAR */}
      {indices.length > 0 && (
        <div style={{ background: "#050510", borderBottom: "1px solid #111128", overflowX: "auto", height: 34, display: "flex", alignItems: "center", scrollbarWidth: "none" }}>
          <div style={{ display: "flex", whiteSpace: "nowrap", padding: "0 16px", gap: 0 }}>
            {indices.map((item, i) => {
              const up = item.pct >= 0;
              const col = up ? C.green : C.red;
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 16px", borderRight: "1px solid #111128", height: 34 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: "monospace" }}>{item.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{item.price}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: col, fontFamily: "monospace" }}>{up ? "+" : ""}{item.pct.toFixed(2)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        {loading ? (
          <div style={{ display: "grid", gap: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ height: i === 0 ? 100 : 60, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 18, color: C.text, marginBottom: 8 }}>{upperTicker} 데이터를 찾을 수 없습니다</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>{error}</div>
            <Link href="/" style={{ padding: "12px 24px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, textDecoration: "none" }}>
              홈으로 돌아가기
            </Link>
          </div>
        ) : data ? (
          <>
            {/* Header card */}
            <div style={{ padding: "28px 32px", borderRadius: 20, background: C.card, border: `1px solid ${data.change_pct >= 0 ? C.green + "40" : C.red + "40"}`, marginBottom: 20, boxShadow: data.change_pct >= 0 ? `0 0 30px ${C.green}12` : `0 0 30px ${C.red}12` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#07070f" }}>
                      {upperTicker.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{upperTicker}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{data.name}</div>
                    </div>
                  </div>
                  {data.sector && (
                    <span style={{ fontSize: 11, color: C.blue, background: `${C.blue}15`, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{data.sector}</span>
                  )}
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.green, fontFamily: "monospace", letterSpacing: 1 }}>LIVE</span>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>
                    ${data.price.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: data.change_pct >= 0 ? C.green : C.red }}>
                    {data.change_pct >= 0 ? "▲+" : "▼"}{data.change_pct.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {secondsAgo < 60 ? `${secondsAgo}초 전 업데이트` : `${Math.round(secondsAgo / 60)}분 전 업데이트`}
                  </div>
                  {sparkPrices.length > 1 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline prices={sparkPrices} color={data.change_pct >= 0 ? C.green : C.red} />
                      <div style={{ fontSize: 10, color: C.muted, textAlign: "right", marginTop: 2 }}>14일 차트</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 주식 건강 점수 카드 */}
            {grade && (
              <div style={{ marginBottom: 20, borderRadius: 20, background: C.card, border: `1px solid ${grade.grade_color}30`, overflow: "hidden" }}>
                {/* 상단: 등급 + 요약 */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", flexWrap: "wrap" }}>
                  {/* 대형 등급 배지 */}
                  <div style={{
                    width: 80, height: 80, borderRadius: 20, flexShrink: 0,
                    background: `${grade.grade_color}18`, border: `2px solid ${grade.grade_color}60`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 24px ${grade.grade_color}20`,
                  }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: grade.grade_color, lineHeight: 1 }}>{grade.grade}</div>
                    <div style={{ fontSize: 9, color: grade.grade_color, fontFamily: "monospace", letterSpacing: 1, marginTop: 2 }}>등급</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: grade.grade_color }}>{grade.grade_label}</span>
                      <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{grade.total_score}/100점</span>
                      <button
                        onClick={() => setBeginnerMode(m => !m)}
                        style={{ padding: "2px 10px", borderRadius: 20, border: `1px solid ${C.blue}40`, background: beginnerMode ? `${C.blue}20` : "transparent", color: C.blue, fontSize: 10, cursor: "pointer", fontWeight: 700 }}
                      >
                        {beginnerMode ? "✓ 초보자 설명 ON" : "초보자 설명"}
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>{grade.ai_comment}</p>
                  </div>
                  {/* 점수 바 */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {Object.entries(grade.scores).map(([key, score]) => (
                      <div key={key} style={{ textAlign: "center", minWidth: 52 }}>
                        <div style={{ height: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 4 }}>
                          <div style={{
                            width: 22, height: `${score}%`, minHeight: 4,
                            background: score >= 70 ? C.green : score >= 50 ? "#f59e0b" : C.red,
                            borderRadius: "4px 4px 0 0", opacity: 0.85,
                            transition: "height 0.8s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.2 }}>{key}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: score >= 70 ? C.green : score >= 50 ? "#f59e0b" : C.red }}>{score}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowGradeDetail(v => !v)}
                    style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                    {showGradeDetail ? "▲" : "▼"} 상세
                  </button>
                </div>

                {/* 초보자 설명 모드 */}
                {beginnerMode && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 24px", background: `${C.blue}05`, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {Object.entries(grade.grade_descriptions).map(([key, desc]) => {
                      const score = grade.scores[key] ?? 50;
                      const emoji = score >= 70 ? "🟢" : score >= 50 ? "🟡" : "🔴";
                      return (
                        <div key={key} style={{ padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 4 }}>{emoji} {key} <span style={{ fontFamily: "monospace", color: score >= 70 ? C.green : score >= 50 ? "#f59e0b" : C.red }}>{score}점</span></div>
                          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
                        </div>
                      );
                    })}
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: `${C.blue}10`, border: `1px solid ${C.blue}30`, gridColumn: "1/-1" }}>
                      <div style={{ fontSize: 11, color: C.blue, lineHeight: 1.6 }}>
                        💡 <strong>A~B</strong>: 여러 지표가 긍정적 &nbsp;|&nbsp; <strong>C</strong>: 뚜렷한 방향 없음 &nbsp;|&nbsp; <strong>D~F</strong>: 주의 필요
                        <br />⚠️ 이 점수는 AI 분석이며 투자 권유가 아닙니다.
                      </div>
                    </div>
                  </div>
                )}

                {/* 상세 점수 (토글) */}
                {showGradeDetail && !beginnerMode && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 24px" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(grade.scores).map(([key, score]) => {
                        const col = score >= 70 ? C.green : score >= 50 ? "#f59e0b" : C.red;
                        return (
                          <div key={key} style={{ flex: "1 1 140px", padding: "12px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${col}30` }}>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{key}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ height: 4, flex: 1, borderRadius: 2, background: C.border, marginRight: 8 }}>
                                <div style={{ height: "100%", width: `${score}%`, borderRadius: 2, background: col }} />
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 900, color: col, fontFamily: "monospace" }}>{score}</span>
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{grade.grade_descriptions[key]}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== EPISODE 6: AI 투자 코치 ===== */}
            {grade && data && (() => {
              const score = grade.total_score;
              const ba = score >= 75
                ? { icon: "✅", text: "지금 살 만합니다. 여러 지표가 긍정적이에요.", color: C.green }
                : score >= 55
                ? { icon: "🟡", text: "애매한 타이밍이에요. 조금 더 기다려볼 수 있어요.", color: "#f59e0b" }
                : score >= 40
                ? { icon: "⚠️", text: "조심할 필요가 있어요. 지표들이 혼재됩니다.", color: "#f59e0b" }
                : { icon: "🚫", text: "지금은 피하는 게 나을 것 같아요. 지표가 좋지 않아요.", color: C.red };
              const worstCats = Object.entries(grade.scores).sort(([,a],[,b])=>a-b).slice(0,2);
              const buyPct = analyst ? ((analyst.strong_buy + analyst.buy) / Math.max(analyst.total,1)) * 100 : 0;
              const holdPct = analyst ? (analyst.hold / Math.max(analyst.total,1)) * 100 : 0;
              const sellPct = analyst ? ((analyst.sell + analyst.strong_sell) / Math.max(analyst.total,1)) * 100 : 0;
              const consLabel = !analyst ? "데이터 없음" : buyPct >= 60 ? "강력 매수" : buyPct >= 40 ? "매수" : holdPct >= 40 ? "보유" : "매도";
              const consColor = !analyst ? C.muted : buyPct >= 50 ? C.green : holdPct >= 50 ? "#f59e0b" : C.red;
              const reward = analyst?.mean_target ? analyst.mean_target - data.price : (data.week52_high ?? data.price) - data.price;
              const risk = data.week52_low ? data.price - data.week52_low : data.price * 0.1;
              const rr = risk > 0 ? reward / risk : null;
              const rrColor = rr === null ? C.muted : rr >= 2 ? C.green : rr >= 1 ? "#f59e0b" : C.red;
              const [coachMode, setCoachMode] = [beginnerMode ? "beginner" : showGradeDetail ? "advanced" : "intermediate", (m: string) => {
                setBeginnerMode(m === "beginner"); setShowGradeDetail(m === "advanced");
              }];
              const tabs = [["beginner","초보자"],["intermediate","중수"],["advanced","고수"]];
              return (
                <div style={{ marginBottom: 20, borderRadius: 20, background: "linear-gradient(135deg,#111120 0%,#0d0d1a 100%)", border: `1px solid ${C.blue}40`, padding: 24, boxShadow: `0 0 40px ${C.blue}08` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🤖</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>AI 투자 코치</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 3 }}>
                      {tabs.map(([key, label]) => (
                        <button key={key} onClick={() => setCoachMode(key)}
                          style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.15s", background: coachMode === key ? C.blue : "transparent", color: coachMode === key ? "#07070f" : C.muted }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* BEGINNER */}
                  {coachMode === "beginner" && (
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 14 }}>이 종목, 지금 사기 좋을까요?</div>
                      <div style={{ background: `${ba.color}12`, border: `1px solid ${ba.color}30`, borderRadius: 14, padding: "14px 18px", fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.7, marginBottom: 14 }}>
                        {ba.icon} {ba.text}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {worstCats.map(([key, sc]) => (
                          <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                            <span style={{ color: sc >= 50 ? "#f59e0b" : C.red, fontWeight: 700, flexShrink: 0 }}>{sc >= 50 ? "⚠️" : "🔴"} {key}:</span>
                            <span>{grade.grade_descriptions[key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* INTERMEDIATE */}
                  {coachMode === "intermediate" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: 14, borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>지지 / 저항선</div>
                          {data.week52_high && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 9, color: C.red, marginBottom: 2 }}>저항 (52주 최고)</div><div style={{ fontSize: 17, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>${data.week52_high.toFixed(2)}</div></div>}
                          {data.week52_low && data.week52_high && (
                            <div style={{ height: 4, borderRadius: 2, background: `linear-gradient(90deg,${C.red},${C.green})`, margin: "8px 0", position: "relative" }}>
                              <div style={{ position: "absolute", top: -4, left: `calc(${Math.min(100,Math.max(0,((data.price-data.week52_low)/(data.week52_high-data.week52_low))*100))}% - 6px)`, width: 12, height: 12, borderRadius: "50%", background: C.blue, border: "2px solid #07070f" }} />
                            </div>
                          )}
                          {technicals?.ma20 && <div><div style={{ fontSize: 9, color: C.green, marginBottom: 2 }}>지지 (MA20)</div><div style={{ fontSize: 17, fontWeight: 900, color: C.green, fontFamily: "monospace" }}>${technicals.ma20.toFixed(2)}</div></div>}
                        </div>
                        <div style={{ padding: 14, borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>애널리스트 의견</div>
                          {analyst && analyst.total > 0 ? (
                            <>
                              <div style={{ fontSize: 17, fontWeight: 900, color: consColor, marginBottom: 8 }}>{consLabel}</div>
                              <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", gap: 1, marginBottom: 8 }}>
                                <div style={{ width: `${buyPct}%`, background: C.green }} />
                                <div style={{ width: `${holdPct}%`, background: "#f59e0b" }} />
                                <div style={{ width: `${sellPct}%`, background: C.red }} />
                              </div>
                              {analyst.mean_target && analyst.upside_pct !== null && (
                                <div style={{ fontSize: 12, color: (analyst.upside_pct ?? 0) > 0 ? C.green : C.red, fontWeight: 700 }}>목표주가 ${analyst.mean_target.toFixed(0)} → {(analyst.upside_pct ?? 0) > 0 ? "+" : ""}{(analyst.upside_pct ?? 0).toFixed(1)}%</div>
                              )}
                            </>
                          ) : <div style={{ fontSize: 12, color: C.muted }}>애널리스트 데이터 없음</div>}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                        현재 기술적 지지선은 {technicals?.ma20 ? `$${technicals.ma20.toFixed(2)}` : "N/A"}이며{analyst?.mean_target ? `, 애널리스트 평균 목표가는 $${analyst.mean_target.toFixed(2)}입니다.` : "."}
                      </div>
                    </div>
                  )}
                  {/* ADVANCED */}
                  {coachMode === "advanced" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                        <div style={{ padding: "12px 10px", borderRadius: 12, background: C.card, border: `1px solid ${rrColor}30`, textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5 }}>리스크/리워드</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: rrColor, fontFamily: "monospace" }}>{rr !== null ? `1:${rr.toFixed(1)}` : "N/A"}</div>
                          <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{rr === null ? "" : rr >= 2 ? "좋은 비율" : rr >= 1 ? "보통" : "불리"}</div>
                        </div>
                        {technicals && (
                          <div style={{ padding: "12px 10px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5 }}>모멘텀</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: technicals.rsi > 70 ? C.red : technicals.rsi < 30 ? C.green : C.text, fontFamily: "monospace" }}>RSI {technicals.rsi}</div>
                            <div style={{ fontSize: 10, color: technicals.macd && technicals.macd > 0 ? C.green : C.red, fontWeight: 700, marginTop: 3 }}>MACD {technicals.macd_signal}</div>
                          </div>
                        )}
                        {data.week52_low && data.week52_high && technicals && (
                          <div style={{ padding: "12px 10px", borderRadius: 12, background: C.card, border: `1px solid ${technicals.vol_spike ? "#f59e0b30" : C.border}`, textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5 }}>변동성</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{(((data.week52_high-data.week52_low)/data.week52_low)*100).toFixed(0)}% 레인지</div>
                            <div style={{ fontSize: 10, color: technicals.vol_spike ? "#f59e0b" : C.muted, marginTop: 3 }}>거래량 {technicals.vol_ratio}x{technicals.vol_spike ? " ⚡" : ""}</div>
                          </div>
                        )}
                      </div>
                      {technicals && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}><span style={{ color: technicals.above_ma20 ? C.green : C.red, fontWeight: 700 }}>• MA20 {technicals.above_ma20 ? "상향 돌파" : "하향 이탈"}</span> — 단기 {technicals.above_ma20 ? "긍정적" : "부정적"} 신호</div>
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}><span style={{ color: technicals.macd && technicals.macd > 0 ? C.green : C.red, fontWeight: 700 }}>• MACD {technicals.macd_signal} 신호</span> — {technicals.macd && technicals.macd > 0 ? "상승" : "하락"} 모멘텀</div>
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}><span style={{ color: technicals.rsi > 70 ? C.red : technicals.rsi < 30 ? C.green : "#f59e0b", fontWeight: 700 }}>• RSI {technicals.rsi}</span> — {technicals.rsi > 70 ? "과매수 — 단기 조정 가능" : technicals.rsi < 30 ? "과매도 — 반등 가능성" : "중립 구간"}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 14, fontSize: 10, color: C.muted }}>
                    ⚠️ 이 내용은 AI 분석이며 투자 권유가 아닙니다. 투자 결정은 본인의 판단으로 하세요.
                  </div>
                </div>
              );
            })()}

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>VALUATION</p>
                <StatRow label="시가총액" value={fmtCap(data.market_cap)} />
                <StatRow label="PER" value={data.pe_ratio ? data.pe_ratio.toFixed(1) + "x" : "N/A"} />
                <StatRow label="52주 최고" value={data.week52_high ? `$${data.week52_high.toFixed(2)}` : "N/A"} />
                <StatRow label="52주 최저" value={data.week52_low ? `$${data.week52_low.toFixed(2)}` : "N/A"} />
                {data.div_yield !== undefined && data.div_yield !== null && data.div_yield > 0 && (
                  <StatRow label="배당수익률" value={`${data.div_yield.toFixed(2)}%`} highlight />
                )}
              </div>
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>VOLUME</p>
                <StatRow label="거래량" value={fmtVol(data.volume)} />
                <StatRow label="평균 거래량" value={fmtVol(data.avg_volume)} />
                {data.volume && data.avg_volume && (
                  <StatRow
                    label="거래량 비율"
                    value={`${(data.volume / data.avg_volume * 100).toFixed(0)}%`}
                    highlight={data.volume > data.avg_volume * 1.5}
                  />
                )}
              </div>
            </div>

            {/* Dividend Info */}
            {data.div_yield && data.div_yield > 0.5 && (
              <div style={{ padding: "16px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.green}30`, marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>💰 DIVIDEND</p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 120px" }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>배당수익률</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.green, fontFamily: "monospace" }}>{data.div_yield.toFixed(2)}%</div>
                  </div>
                  {data.div_rate && (
                    <div style={{ flex: "1 1 120px" }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>연간 배당금</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>${data.div_rate.toFixed(2)}</div>
                    </div>
                  )}
                  {data.payout_ratio && (
                    <div style={{ flex: "1 1 120px" }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>배당성향</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: data.payout_ratio > 80 ? C.red : C.text, fontFamily: "monospace" }}>{data.payout_ratio.toFixed(0)}%</div>
                    </div>
                  )}
                  {data.ex_div_date && (
                    <div style={{ flex: "1 1 120px" }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>배당락일</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{data.ex_div_date}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Technical Indicators */}
            {technicals && (
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>TECHNICAL INDICATORS</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {/* RSI */}
                  <div style={{ padding: "14px", borderRadius: 12, background: C.surface, border: `1px solid ${technicals.rsi > 70 ? C.red + "40" : technicals.rsi < 30 ? C.green + "40" : C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>RSI (14)</div>
                    <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: technicals.rsi > 70 ? C.red : technicals.rsi < 30 ? C.green : C.text }}>{technicals.rsi}</div>
                    <div style={{ fontSize: 11, color: technicals.rsi > 70 ? C.red : technicals.rsi < 30 ? C.green : C.muted, marginTop: 4, fontWeight: 700 }}>
                      {technicals.rsi_signal}
                    </div>
                    {/* RSI bar */}
                    <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: C.border, position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${technicals.rsi}%`, borderRadius: 2, background: technicals.rsi > 70 ? C.red : technicals.rsi < 30 ? C.green : C.blue }} />
                    </div>
                  </div>
                  {/* MACD */}
                  <div style={{ padding: "14px", borderRadius: 12, background: C.surface, border: `1px solid ${technicals.macd && technicals.macd > 0 ? C.green + "40" : C.red + "30"}` }}>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>MACD</div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "monospace", color: technicals.macd && technicals.macd > 0 ? C.green : C.red }}>
                      {technicals.macd !== null ? (technicals.macd > 0 ? "+" : "") + technicals.macd.toFixed(2) : "N/A"}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: technicals.macd && technicals.macd > 0 ? C.green : C.red, marginTop: 4 }}>{technicals.macd_signal} 신호</div>
                  </div>
                  {/* Volume */}
                  <div style={{ padding: "14px", borderRadius: 12, background: C.surface, border: `1px solid ${technicals.vol_spike ? "#f59e0b40" : C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>거래량 비율</div>
                    <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: technicals.vol_spike ? "#f59e0b" : C.text }}>{technicals.vol_ratio}x</div>
                    <div style={{ fontSize: 11, color: technicals.vol_spike ? "#f59e0b" : C.muted, fontWeight: 700, marginTop: 4 }}>
                      {technicals.vol_spike ? "⚡ 거래량 급증" : "평균 수준"}
                    </div>
                  </div>
                </div>
                {/* MA summary */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <div style={{ padding: "6px 12px", borderRadius: 8, background: technicals.above_ma20 ? `${C.green}15` : `${C.red}15`, border: `1px solid ${technicals.above_ma20 ? C.green + "30" : C.red + "30"}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: technicals.above_ma20 ? C.green : C.red }}>
                      {technicals.above_ma20 ? "▲" : "▼"} MA20 ${technicals.ma20.toFixed(2)}
                    </span>
                  </div>
                  {technicals.ma50 && (
                    <div style={{ padding: "6px 12px", borderRadius: 8, background: technicals.above_ma50 ? `${C.green}15` : `${C.red}15`, border: `1px solid ${technicals.above_ma50 ? C.green + "30" : C.red + "30"}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: technicals.above_ma50 ? C.green : C.red }}>
                        {technicals.above_ma50 ? "▲" : "▼"} MA50 ${technicals.ma50.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div style={{ padding: "6px 12px", borderRadius: 8, background: `${C.blue}15`, border: `1px solid ${C.blue}30` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>{technicals.trend}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 52-week position bar */}
            {data.week52_low && data.week52_high && data.price && (() => {
              const pct = Math.max(0, Math.min(100, ((data.price - data.week52_low) / (data.week52_high - data.week52_low)) * 100));
              const barColor = pct > 75 ? C.green : pct > 40 ? C.blue : C.red;
              return (
                <div style={{ padding: "16px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2 }}>52주 가격 위치</span>
                    <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>{pct.toFixed(0)}% 구간</span>
                  </div>
                  <div style={{ position: "relative", height: 8, borderRadius: 4, background: C.border }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, borderRadius: 4, background: barColor, transition: "width 0.6s ease" }} />
                    <div style={{ position: "absolute", top: -3, left: `calc(${pct}% - 7px)`, width: 14, height: 14, borderRadius: "50%", background: barColor, border: "2px solid #07070f", boxShadow: `0 0 8px ${barColor}80` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: C.red, fontFamily: "monospace" }}>52주 최저 ${data.week52_low.toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace" }}>52주 최고 ${data.week52_high.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Interactive Chart */}
            <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2 }}>PRICE CHART</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {([["1W", 7], ["1M", 30], ["3M", 90]] as [string, number][]).map(([label, days]) => (
                    <button key={days} onClick={() => setChartDays(days)}
                      style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", transition: "all 0.15s",
                        background: chartDays === days ? (data.change_pct >= 0 ? C.green : C.red) : C.surface,
                        color: chartDays === days ? "#07070f" : C.muted }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {chartPrices.length < 2 ? (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, color: C.muted }}>차트 로딩 중…</div>
                </div>
              ) : (() => {
                const W = 720, H = 160, pad = 12;
                const min = Math.min(...chartPrices), max = Math.max(...chartPrices);
                const range = max - min || 1;
                const color = data.change_pct >= 0 ? C.green : C.red;
                const pts = chartPrices.map((p, i) => ({
                  x: pad + (i / (chartPrices.length - 1)) * (W - pad * 2),
                  y: H - pad - ((p - min) / range) * (H - pad * 2),
                  price: p, date: chartDates[i] || "",
                }));
                const pathD = `M ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`;
                const fillD = `${pathD} L ${pts[pts.length-1].x.toFixed(1)},${(H-pad).toFixed(1)} L ${pts[0].x.toFixed(1)},${(H-pad).toFixed(1)} Z`;
                const minIdx = chartPrices.indexOf(min);
                const maxIdx = chartPrices.indexOf(max);
                // Y-axis grid lines (3 levels)
                const gridLevels = [0, 0.5, 1].map(t => ({
                  y: H - pad - t * (H - pad * 2),
                  price: min + t * range,
                }));
                return (
                  <InteractiveChart
                    pts={pts} pathD={pathD} fillD={fillD}
                    W={W} H={H} pad={pad} color={color}
                    minIdx={minIdx} maxIdx={maxIdx}
                    gridLevels={gridLevels}
                    startDate={chartDates[0] || ""} endDate={chartDates[chartDates.length-1] || ""}
                  />
                );
              })()}
            </div>

            {/* Analyst Consensus */}
            {analyst && analyst.total > 0 && (
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>ANALYST CONSENSUS</p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                  {/* Target price */}
                  {analyst.mean_target && (
                    <div style={{ flex: "1 1 160px", padding: "14px", borderRadius: 12, background: C.surface, border: `1px solid ${analyst.upside_pct && analyst.upside_pct > 0 ? C.green + "30" : C.red + "30"}` }}>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 6 }}>평균 목표주가</div>
                      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: C.text }}>${analyst.mean_target.toFixed(2)}</div>
                      {analyst.upside_pct !== null && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: analyst.upside_pct > 0 ? C.green : C.red, marginTop: 4 }}>
                          {analyst.upside_pct > 0 ? "▲+" : "▼"}{analyst.upside_pct.toFixed(1)}% 상승여력
                        </div>
                      )}
                      {analyst.num_analysts && (
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{analyst.num_analysts}명 애널리스트</div>
                      )}
                    </div>
                  )}
                  {/* Range */}
                  {analyst.low_target && analyst.high_target && (
                    <div style={{ flex: "1 1 160px", padding: "14px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 6 }}>목표주가 범위</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.green, fontFamily: "monospace" }}>${analyst.high_target.toFixed(2)}</div>
                      <div style={{ height: 4, borderRadius: 2, background: C.border, margin: "8px 0", position: "relative" }}>
                        <div style={{ position: "absolute", height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.green})`, borderRadius: 2, width: "100%" }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.red, fontFamily: "monospace" }}>${analyst.low_target.toFixed(2)}</div>
                    </div>
                  )}
                </div>
                {/* Recommendation bar */}
                {analyst.total > 0 && (() => {
                  const { strong_buy: sb, buy: b, hold: h, sell: s, strong_sell: ss, total: t } = analyst;
                  const buyPct = ((sb + b) / t) * 100;
                  const holdPct = (h / t) * 100;
                  const sellPct = ((s + ss) / t) * 100;
                  const consensus = buyPct >= 60 ? "강력 매수" : buyPct >= 40 ? "매수" : holdPct >= 40 ? "보유" : "매도";
                  const consensusColor = buyPct >= 50 ? C.green : holdPct >= 50 ? "#f59e0b" : C.red;
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.muted }}>추천 분포</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: consensusColor }}>컨센서스: {consensus}</span>
                      </div>
                      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                        <div style={{ width: `${buyPct}%`, background: C.green }} />
                        <div style={{ width: `${holdPct}%`, background: "#f59e0b" }} />
                        <div style={{ width: `${sellPct}%`, background: C.red }} />
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: C.muted }}>
                        <span style={{ color: C.green }}>매수 {sb + b}명 ({buyPct.toFixed(0)}%)</span>
                        <span style={{ color: "#f59e0b" }}>보유 {h}명 ({holdPct.toFixed(0)}%)</span>
                        <span style={{ color: C.red }}>매도 {s + ss}명 ({sellPct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* AI Analysis */}
            {data.analysis && (
              <div style={{ padding: "24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                  <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 2 }}>CLAUDE AI ANALYSIS</span>
                </div>
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>{data.analysis}</p>
              </div>
            )}

            {/* Share buttons */}
            <div style={{ padding: "20px 24px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.muted }}>공유하기:</span>
              <button onClick={copyLink}
                style={{ padding: "8px 16px", borderRadius: 8, background: copied ? `${C.green}20` : `${C.blue}15`, border: `1px solid ${copied ? C.green : C.blue}40`, color: copied ? C.green : C.blue, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                {copied ? "✓ 복사됨!" : "🔗 링크 복사"}
              </button>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${upperTicker} AI 분석 결과 👇\n$${data.price.toFixed(2)} ${data.change_pct >= 0 ? "+" : ""}${data.change_pct.toFixed(2)}%`)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ padding: "8px 16px", borderRadius: 8, background: "#1da1f215", border: "1px solid #1da1f230", color: "#1da1f2", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
                X 공유
              </a>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${upperTicker} AI 분석 - 구해조`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ padding: "8px 16px", borderRadius: 8, background: `${C.green}15`, border: `1px solid ${C.green}30`, color: C.green, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
                텔레그램 공유
              </a>
            </div>

            {/* 분기별 재무 (EPS·매출) */}
            {financials && (financials.quarters.length > 0 || financials.ttm_eps) && (
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>
                  📊 QUARTERLY FINANCIALS
                </div>

                {/* TTM / Forward EPS only fallback */}
                {!financials.quarters.length && financials.ttm_eps !== undefined && (
                  <div style={{ display: "flex", gap: 16 }}>
                    {financials.ttm_eps != null && (
                      <div style={{ padding: "12px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>TTM EPS</div>
                        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: financials.ttm_eps >= 0 ? C.green : C.red }}>
                          ${financials.ttm_eps.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {financials.forward_eps != null && (
                      <div style={{ padding: "12px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Forward EPS</div>
                        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: C.blue }}>
                          ${financials.forward_eps.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {financials.quarters.length > 0 && (() => {
                  const qs = financials.quarters;
                  const eps = financials.eps;
                  const rev = financials.revenue;
                  const maxRev = Math.max(...rev.filter(v => v !== null) as number[]);
                  const maxEpsAbs = Math.max(...eps.filter(v => v !== null).map(v => Math.abs(v as number)));

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {/* Revenue bars */}
                      {maxRev > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: C.blue, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>매출 (단위: $B)</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
                            {qs.map((q, i) => {
                              const v = rev[i];
                              const pct = v != null ? (v / maxRev) * 100 : 0;
                              const prev = i > 0 ? rev[i - 1] : null;
                              const up = v != null && prev != null ? v >= prev : null;
                              return (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                  {v != null && (
                                    <div style={{ fontSize: 9, color: up === true ? C.green : up === false ? C.red : C.muted, fontFamily: "monospace", fontWeight: 700 }}>
                                      ${v.toFixed(1)}B
                                    </div>
                                  )}
                                  <div style={{ width: "100%", height: `${pct}%`, borderRadius: "4px 4px 0 0", background: up === true ? C.blue + "cc" : up === false ? C.blue + "66" : C.border, minHeight: 4, transition: "height 0.8s ease" }} />
                                  <div style={{ fontSize: 9, color: C.muted, textAlign: "center", lineHeight: 1.2 }}>{q}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* EPS bars */}
                      {maxEpsAbs > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>주당순이익 EPS ($)</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>
                            {qs.map((q, i) => {
                              const v = eps[i];
                              const pct = v != null ? (Math.abs(v) / maxEpsAbs) * 100 : 0;
                              const color = v != null && v >= 0 ? C.green : C.red;
                              return (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                  {v != null && (
                                    <div style={{ fontSize: 9, color, fontFamily: "monospace", fontWeight: 700 }}>
                                      {v >= 0 ? "+" : ""}{v.toFixed(2)}
                                    </div>
                                  )}
                                  <div style={{ width: "100%", height: `${pct}%`, borderRadius: "4px 4px 0 0", background: color + "bb", minHeight: v != null ? 4 : 0, transition: "height 0.8s ease" }} />
                                  <div style={{ fontSize: 9, color: C.muted, textAlign: "center", lineHeight: 1.2 }}>{q}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 동종 섹터 종목 */}
            {peers.length > 0 && (
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>
                  {peerSector ? `${peerSector.toUpperCase()} · ` : ""}PEER STOCKS
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {peers.map(p => {
                    const up = p.change_pct >= 0;
                    return (
                      <Link key={p.ticker} href={`/stock/${p.ticker}`} style={{ textDecoration: "none" }}>
                        <div style={{ padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${up ? C.green + "30" : C.red + "25"}`, minWidth: 90, cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: C.text }}>{p.ticker}</div>
                          <div style={{ fontSize: 12, color: up ? C.green : C.red, fontWeight: 700, marginTop: 2 }}>
                            {up ? "+" : ""}{p.change_pct.toFixed(2)}%
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>${p.price.toFixed(p.price < 10 ? 3 : 2)}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 종목 뉴스 */}
            {stockNews.length > 0 && (
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 }}>
                  📰 {upperTicker} LATEST NEWS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stockNews.slice(0, 5).map((n, i) => {
                    const sentColor = n.sentiment === "Bullish" || n.sentiment === "Somewhat-Bullish" ? C.green
                      : n.sentiment === "Bearish" || n.sentiment === "Somewhat-Bearish" ? C.red : C.muted;
                    const sentLabel = n.sentiment === "Bullish" ? "강세" : n.sentiment === "Somewhat-Bullish" ? "약강세"
                      : n.sentiment === "Bearish" ? "약세" : n.sentiment === "Somewhat-Bearish" ? "약약세" : "중립";
                    return (
                      <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <div style={{
                          padding: "14px 16px", borderRadius: 12, background: C.card,
                          border: `1px solid ${C.border}`, cursor: "pointer",
                          transition: "border-color 0.2s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = C.blue + "60")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                              {n.summary && (
                                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 6 }}>
                                  {n.summary.slice(0, 120)}{n.summary.length > 120 ? "..." : ""}
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 10, color: C.muted }}>{n.source}</span>
                                {n.published && <span style={{ fontSize: 10, color: C.muted }}>{n.published.slice(0, 4)}-{n.published.slice(4, 6)}-{n.published.slice(6, 8)}</span>}
                              </div>
                            </div>
                            {n.sentiment !== "Neutral" && (
                              <div style={{
                                padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: sentColor + "18", color: sentColor, whiteSpace: "nowrap", flexShrink: 0,
                              }}>{sentLabel}</div>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
                <Link href={`/compare?a=${upperTicker}&b=SPY`}
                  style={{ padding: "10px 20px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  ⚖️ {upperTicker} vs SPY 비교
                </Link>
                <Link href="/compare"
                  style={{ padding: "10px 20px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  ⚖️ 다른 종목과 비교
                </Link>
              </div>
              <p style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>
                텔레그램에서 실시간으로 분석하려면:
              </p>
              <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "14px 32px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: `0 8px 24px ${C.green}25` }}>
                📱 @goohaejo_bot 에서 /{upperTicker} 입력
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
