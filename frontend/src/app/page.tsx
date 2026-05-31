"use client";
import { useState, useEffect, useRef } from "react";

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

function useMarketSession() {
  const [session, setSession] = useState({ label: "", color: "#6b6b80", nyTime: "" });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = ny.getHours(), m = ny.getMinutes(), d = ny.getDay();
      const t = h * 60 + m;
      const nyStr = ny.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
      let label = "장 마감", color = "#6b6b80";
      if (d === 0 || d === 6) { label = "주말 휴장"; color = "#6b6b80"; }
      else if (t >= 240 && t < 570) { label = "Pre-Market"; color = "#f59e0b"; }
      else if (t >= 570 && t < 960) { label = "정규장 운영중"; color = "#00d97e"; }
      else if (t >= 960 && t < 1080) { label = "After-Hours"; color = "#3b82f6"; }
      setSession({ label, color, nyTime: nyStr + " ET" });
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);
  return session;
}

function useNextBriefingCountdown() {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      // Next KST 08:00
      const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const next = new Date(kst);
      next.setHours(8, 0, 0, 0);
      if (kst >= next) next.setDate(next.getDate() + 1);
      const diff = next.getTime() - kst.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return countdown;
}

function useCountUp(target: number | null, duration = 1200) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const start = Date.now();
    const startVal = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, textAlign: "center", flex: "1 1 140px" }}>
      <div style={{ fontSize: 28, fontWeight: 900, background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

function BriefingCard({ text, index }: { text: string; index: number }) {
  const labels = ["시장 요약", "섹터 분석", "주목 종목", "한국 영향", "내일 전망"];
  const colors = [C.green, "#a78bfa", "#f59e0b", "#3b82f6", "#ec4899"];
  return (
    <div style={{ padding: "20px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${colors[index] || C.green}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors[index] || C.green, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
        {labels[index] || `Part ${index + 1}`}
      </div>
      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

function FearGauge({ score, label }: { score: number; label: string }) {
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const dur = 1400;
    const tick = () => {
      const t = Math.min((Date.now() - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimScore(Math.round(score * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  const pct = Math.max(0, Math.min(100, animScore));
  const W = 200; const H = 120;
  const cx = W / 2; const cy = 106;
  const R = 80; const r2 = 56;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const polarX = (radius: number, deg: number) => cx + radius * Math.cos(rad(deg));
  const polarY = (radius: number, deg: number) => cy + radius * Math.sin(rad(deg));

  // Arc from 180deg (left) to 0deg (right), counterclockwise = bottom half hidden
  const arcSeg = (startPct: number, endPct: number) => {
    const sa = 180 - startPct * 1.8;
    const ea = 180 - endPct * 1.8;
    const x1 = polarX(R, sa); const y1 = polarY(R, sa);
    const x2 = polarX(R, ea); const y2 = polarY(R, ea);
    const xi1 = polarX(r2, sa); const yi1 = polarY(R, sa);
    const xi2 = polarX(r2, ea); const yi2 = polarY(r2, ea);
    const large = Math.abs(endPct - startPct) > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 0 ${x2} ${y2} L ${polarX(r2,ea)} ${polarY(r2,ea)} A ${r2} ${r2} 0 ${large} 1 ${polarX(r2,sa)} ${polarY(r2,sa)} Z`;
  };

  const zones = [
    { label: "극단공포", color: "#ff3355", start: 0, end: 20 },
    { label: "공포", color: "#ff7733", start: 20, end: 40 },
    { label: "중립", color: "#aaaaaa", start: 40, end: 60 },
    { label: "탐욕", color: "#00cc88", start: 60, end: 80 },
    { label: "극단탐욕", color: "#00d97e", start: 80, end: 100 },
  ];

  const needleAngle = 180 - pct * 1.8;
  const nx = polarX(72, needleAngle);
  const ny = polarY(72, needleAngle);
  const activeZone = zones.find(z => score >= z.start && score < z.end) || zones[4];
  const activeColor = activeZone.color;

  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        <defs>
          <filter id="glowFG">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Background track */}
        {zones.map(z => (
          <path key={z.start} d={arcSeg(z.start, z.end)} fill={z.color} opacity={0.12} />
        ))}
        {/* Active fill up to score */}
        {zones.map(z => {
          const fillEnd = Math.min(pct, z.end);
          if (fillEnd <= z.start) return null;
          return <path key={`a${z.start}`} d={arcSeg(z.start, fillEnd)} fill={z.color} opacity={0.85} />;
        })}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={activeColor} strokeWidth={3} strokeLinecap="round" filter="url(#glowFG)" />
        <circle cx={cx} cy={cy} r={7} fill={activeColor} filter="url(#glowFG)" />
        <circle cx={cx} cy={cy} r={4} fill="#07070f" />
        {/* Score */}
        <text x={cx} y={cy - 14} textAnchor="middle" fill={activeColor} fontSize="22" fontWeight="900">{animScore}</text>
        {/* Zone labels */}
        <text x={polarX(R+10, 178)} y={polarY(R+10, 178)} textAnchor="end" fill="#ff3355" fontSize="8" opacity="0.7">극단공포</text>
        <text x={polarX(R+10, 2)} y={polarY(R+10, 2)} textAnchor="start" fill="#00d97e" fontSize="8" opacity="0.7">극단탐욕</text>
        <text x={cx} y={cy - R - 6} textAnchor="middle" fill="#aaaaaa" fontSize="8" opacity="0.6">중립</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 800, color: activeColor, marginTop: 4, letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function FxWidget({ fx }: { fx: Record<string, { price: number; change_pct: number }> }) {
  const pairs = ["USD/KRW", "USD/JPY", "EUR/USD"];
  const icons: Record<string, string> = { "USD/KRW": "🇰🇷", "USD/JPY": "🇯🇵", "EUR/USD": "🇪🇺" };
  const format: Record<string, (v: number) => string> = {
    "USD/KRW": v => v.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원",
    "USD/JPY": v => v.toFixed(2) + "¥",
    "EUR/USD": v => v.toFixed(4),
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pairs.map(pair => {
        const d = fx[pair];
        if (!d) return null;
        const up = d.change_pct >= 0;
        return (
          <div key={pair} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "#08081a", border: `1px solid ${up ? "#00d97e18" : "#ff446618"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{icons[pair]}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, fontFamily: "monospace" }}>{pair}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{format[pair](d.price)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>{up ? "+" : ""}{d.change_pct.toFixed(2)}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IndexTicker({ name, data, sparkPrices }: { name: string; data: { price: number; change_pct: number } | null; sparkPrices?: number[] }) {
  if (!data) return null;
  const up = data.change_pct >= 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "#08081a", border: "1px solid #1a1a2e" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e8e8f0" }}>{name}</span>
      {sparkPrices && <MiniSparkline prices={sparkPrices} color={up ? "#00d97e" : "#ff4466"} />}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#e8e8f0" }}>{data.price.toLocaleString()}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: up ? "#00d97e" : "#ff4466" }}>{up ? "+" : ""}{data.change_pct.toFixed(2)}%</div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ padding: "20px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
      <div style={{ height: 12, width: "30%", borderRadius: 6, background: C.border, marginBottom: 12 }} />
      <div style={{ height: 10, width: "100%", borderRadius: 4, background: C.border, marginBottom: 8 }} />
      <div style={{ height: 10, width: "80%", borderRadius: 4, background: C.border }} />
    </div>
  );
}

function MiniSparkline({ prices, color }: { prices: number[]; color: string }) {
  if (!prices || prices.length < 2) return null;
  const w = 80, h = 28;
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const range = mx - mn || 1;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - mn) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

const TAG_COLORS: Record<string, string> = {
  FOMC: "#3b82f6",
  CPI: "#f59e0b",
  NFP: "#00d97e",
  PCE: "#a78bfa",
  GDP: "#ec4899",
  ISM: "#06b6d4",
};

function EconomicCalendar() {
  const [events, setEvents] = useState<{ date: string; tag: string; name: string; days_left: number; is_past: boolean }[]>([]);
  useEffect(() => {
    fetch(`${API}/calendar/upcoming`)
      .then(r => r.json())
      .then(d => { if (d.events) setEvents(d.events); })
      .catch(() => {});
  }, []);
  if (!events.length) return null;
  const upcoming = events.filter(e => !e.is_past).slice(0, 6);
  return (
    <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "40px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3 }}>ECONOMIC CALENDAR</span>
          <span style={{ fontSize: 11, color: C.muted }}>주요 경제지표 일정</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {upcoming.map((ev) => {
            const color = TAG_COLORS[ev.tag] || C.muted;
            const isImminent = ev.days_left <= 3;
            return (
              <div key={ev.date + ev.tag} style={{
                padding: "14px 18px", borderRadius: 12, background: C.card,
                border: `1px solid ${isImminent ? color + "50" : C.border}`,
                borderLeft: `3px solid ${color}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: color + "20", color }}>{ev.tag}</span>
                    {isImminent && <span style={{ fontSize: 10, color, fontWeight: 700 }}>D-{ev.days_left}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>{ev.date}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isImminent ? color : C.muted }}>{ev.days_left}일</div>
                  <div style={{ fontSize: 10, color: C.muted }}>후</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const POPULAR_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AVGO", "BTC-USD", "ETH-USD"];

function Week52Bar({ position }: { position: number | null }) {
  if (position === null) return null;
  const pct = Math.max(0, Math.min(100, position));
  const color = pct >= 80 ? C.green : pct >= 40 ? "#f59e0b" : C.red;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: C.muted }}>
        <span>52주 저가</span>
        <span style={{ color, fontWeight: 700 }}>{pct.toFixed(0)}% 위치</span>
        <span>52주 고가</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#1a1a2e", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
        <div style={{ position: "absolute", top: -2, left: `${pct}%`, transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%", background: color, border: "2px solid #07070f" }} />
      </div>
    </div>
  );
}

function StockSearchWidget({ isMobile }: { isMobile: boolean }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    ticker: string; price: number; change_pct: number; change: number; volume: number;
    name?: string; sector?: string; pe_ratio?: number | null; market_cap?: number | null;
    week52_high?: number | null; week52_low?: number | null; week52_position?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (ticker: string) => {
    if (!ticker.trim()) return;
    const t = ticker.trim().toUpperCase();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch(`${API}/stock/quote/${t}`);
      const d = await r.json();
      if (d.error) { setError(d.error); }
      else { setResult(d); }
    } catch {
      setError("조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const up = result ? result.change_pct >= 0 : null;

  return (
    <section style={{ padding: "60px 24px", background: C.bg }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: C.blue, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>STOCK LOOKUP</p>
        <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 8, color: C.text }}>종목 실시간 시세</h2>
        <p style={{ color: C.muted, textAlign: "center", marginBottom: 28, fontSize: 14 }}>티커를 입력하면 실시간 가격을 조회합니다</p>

        {/* Search bar */}
        <form onSubmit={(e) => { e.preventDefault(); search(query); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            placeholder="NVDA, TSLA, AAPL..."
            style={{
              flex: 1, padding: "14px 18px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 16, fontFamily: "monospace", fontWeight: 700, outline: "none",
            }}
          />
          <button type="submit" disabled={loading} style={{
            padding: "14px 24px", borderRadius: 12, background: C.grad, color: "#07070f",
            fontWeight: 800, fontSize: 14, border: "none", cursor: loading ? "wait" : "pointer",
          }}>
            {loading ? "..." : "조회"}
          </button>
        </form>

        {/* Popular tickers */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {POPULAR_TICKERS.map(t => (
            <button key={t} onClick={() => { setQuery(t); search(t); }} style={{
              padding: "4px 10px", borderRadius: 6, background: C.card, border: `1px solid ${C.border}`,
              color: C.muted, fontSize: 11, fontFamily: "monospace", cursor: "pointer", fontWeight: 600,
            }}>{t}</button>
          ))}
        </div>

        {/* Result */}
        {error && <div style={{ padding: 16, borderRadius: 12, background: `${C.red}10`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 14 }}>{error}</div>}
        {result && (
          <div style={{ padding: "24px", borderRadius: 16, background: C.card, border: `2px solid ${up ? `${C.green}40` : `${C.red}40`}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{result.ticker}</div>
                {result.name && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{result.name}</div>}
                {result.sector && <div style={{ fontSize: 11, color: C.blue, marginTop: 2 }}>{result.sector}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>
                  ${result.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: up ? C.green : C.red }}>
                  {up ? "▲" : "▼"} {up ? "+" : ""}{result.change.toFixed(2)} ({up ? "+" : ""}{result.change_pct.toFixed(2)}%)
                </div>
              </div>
            </div>
            {/* 52주 위치 게이지 */}
            {result.week52_position !== null && result.week52_position !== undefined && (
              <div style={{ marginBottom: 16 }}>
                <Week52Bar position={result.week52_position} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                  <span>${result.week52_low?.toFixed(2) ?? "N/A"}</span>
                  <span>${result.week52_high?.toFixed(2) ?? "N/A"}</span>
                </div>
              </div>
            )}
            {/* 세부 정보 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {result.pe_ratio && (
                <div style={{ padding: "6px 12px", borderRadius: 8, background: "#08081a", fontSize: 12, color: C.muted }}>
                  PER <span style={{ color: C.text, fontWeight: 700 }}>{result.pe_ratio}</span>
                </div>
              )}
              {result.volume && (
                <div style={{ padding: "6px 12px", borderRadius: 8, background: "#08081a", fontSize: 12, color: C.muted }}>
                  거래량 <span style={{ color: C.text, fontWeight: 700 }}>{(result.volume / 1e6).toFixed(1)}M</span>
                </div>
              )}
              {result.market_cap && (
                <div style={{ padding: "6px 12px", borderRadius: 8, background: "#08081a", fontSize: 12, color: C.muted }}>
                  시총 <span style={{ color: C.text, fontWeight: 700 }}>${(result.market_cap / 1e12).toFixed(2)}T</span>
                </div>
              )}
            </div>
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#08081a", fontSize: 13, color: C.muted }}>
              💡 <span style={{ color: C.text }}>@goohaejo_bot</span> 에서 <code style={{ background: "#1a1a2e", padding: "2px 6px", borderRadius: 4, color: C.green }}>{result.ticker}</code> 를 입력하면 AI 분석 리포트를 받을 수 있습니다.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [chatId, setChatId] = useState("");
  const [subState, setSubState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [subMsg, setSubMsg] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => {
    setIsDark(p => {
      const next = !p;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };
  const [briefing, setBriefing] = useState<string[]>([]);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [subCount, setSubCount] = useState<number | null>(null);
  const [news, setNews] = useState<{ title: string; source: string; sentiment: string; url: string }[]>([]);
  const [adminStats, setAdminStats] = useState<{ total_price_alerts?: number; total_watchlist_items?: number } | null>(null);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [historyBriefing, setHistoryBriefing] = useState<{ [date: string]: string[] }>({});
  const [sparklines, setSparklines] = useState<{ [ticker: string]: number[] }>({});
  const [trending, setTrending] = useState<{ ticker: string; price: number; change_pct: number; mentions: number; sentiment_score: number }[]>([]);
  const [marketData, setMarketData] = useState<{
    indices: Record<string, { price: number; change_pct: number }>;
    fx: Record<string, { price: number; change_pct: number }>;
    fear_greed: { score: number; label_kr: string };
    big_stocks?: Record<string, { price: number; change_pct: number }>;
  } | null>(null);
  const marketRef = useRef<NodeJS.Timeout | null>(null);
  const animatedCount = useCountUp(subCount);
  const marketSession = useMarketSession();
  const nextBriefing = useNextBriefingCountdown();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    const saved = localStorage.getItem("theme");
    if (saved === "light") setIsDark(false);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // 브리핑 미리보기
    fetch(`${API}/summary/latest`)
      .then(r => r.json())
      .then(d => {
        if (d.tweets?.length) setBriefing(d.tweets);
      })
      .catch(() => {})
      .finally(() => setBriefingLoading(false));

    // 구독자 수
    fetch(`${API}/subscribers/count`)
      .then(r => r.json())
      .then(d => setSubCount(d.count))
      .catch(() => {});

    // 실시간 시장 데이터 (30초마다 갱신)
    const loadMarket = () => {
      fetch(`${API}/market/live`)
        .then(r => r.json())
        .then(d => setMarketData(d))
        .catch(() => {});
    };
    loadMarket();
    marketRef.current = setInterval(loadMarket, 30000);

    // 관리자 통계
    fetch(`${API}/admin/stats`)
      .then(r => r.json())
      .then(d => setAdminStats(d))
      .catch(() => {});

    // 뉴스
    fetch(`${API}/news/latest`)
      .then(r => r.json())
      .then(d => { if (d.news?.length) setNews(d.news.slice(0, 5)); })
      .catch(() => {});

    // 트렌딩 종목
    fetch(`${API}/market/trending`)
      .then(r => r.json())
      .then(d => { if (d.tickers?.length) setTrending(d.tickers); })
      .catch(() => {});

    // 지수 스파크라인 (7일 데이터)
    const sparkTickers = { "S&P500": "^GSPC", "NASDAQ": "^IXIC", "NVDA": "NVDA", "TSLA": "TSLA" };
    Object.entries(sparkTickers).forEach(([name, sym]) => {
      fetch(`${API}/stock/history/${encodeURIComponent(sym)}?days=7`)
        .then(r => r.json())
        .then(d => { if (d.prices?.length) setSparklines(prev => ({ ...prev, [name]: d.prices })); })
        .catch(() => {});
    });

    // 브리핑 히스토리 날짜 목록
    fetch(`${API}/summary/history`)
      .then(r => r.json())
      .then(d => {
        if (d.dates?.length) {
          setHistoryDates(d.dates);
        }
      })
      .catch(() => {});

    return () => { if (marketRef.current) clearInterval(marketRef.current); };
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId.trim()) return;
    setSubState("loading");
    try {
      const r = await fetch(`${API}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId.trim() }),
      });
      const d = await r.json();
      setSubMsg(d.message || "완료");
      setSubState("done");
      if (d.total_subscribers) setSubCount(d.total_subscribers);
    } catch {
      setSubState("error");
      setSubMsg("오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className={isDark ? "" : "light-mode"} style={{ background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#07070f" }}>9</div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>구해조</span>
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#0a1f14", color: C.green, border: `1px solid ${C.green}30`, fontFamily: "monospace" }}>BETA</span>
            {marketSession.label && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${marketSession.color}15`, color: marketSession.color, border: `1px solid ${marketSession.color}30`, fontFamily: "monospace" }}>
                {marketSession.label}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={toggleTheme} style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, cursor: "pointer" }}>
              {isDark ? "☀️" : "🌙"}
            </button>
            <a href="#subscribe" style={{ padding: "8px 18px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              무료 구독하기
            </a>
          </div>
        </div>
      </nav>

      {/* SCROLLING TICKER BAR */}
      {marketData && (() => {
        const tickerItems = [
          ...Object.entries(marketData.indices).map(([n, d]) => ({ label: n, price: d.price.toLocaleString(), pct: d.change_pct })),
          ...Object.entries(marketData.fx).slice(0, 3).map(([n, d]) => ({ label: n, price: n.includes("KRW") ? Math.round(d.price).toLocaleString() + "w" : d.price.toFixed(2), pct: d.change_pct })),
          { label: "F&G", price: String(marketData.fear_greed.score), pct: null },
        ];
        const items = [...tickerItems, ...tickerItems];
        return (
          <div style={{ background: "#050510", borderBottom: "1px solid #111128", overflow: "hidden", height: 34, display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", animation: "marquee 40s linear infinite", whiteSpace: "nowrap" }}>
              {items.map((item, i) => {
                const up = item.pct === null ? null : item.pct >= 0;
                const col = item.pct === null ? "#6b6b80" : up ? "#00d97e" : "#ff4466";
                return (
                  <span key={i} className="ticker-item" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 20px", borderRight: "1px solid #111128", height: 34, cursor: "default" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b6b80", fontFamily: "monospace" }}>{item.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#e8e8f0", fontFamily: "monospace" }}>{item.price}</span>
                    {item.pct !== null && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: col, fontFamily: "monospace" }}>{up ? "+" : ""}{item.pct.toFixed(2)}%</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* HERO */}
      <section style={{ padding: "80px 24px 60px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#1a1a2e15 1px,transparent 1px),linear-gradient(90deg,#1a1a2e15 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 500, background: "radial-gradient(ellipse,rgba(0,217,126,0.05) 0%,transparent 65%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(0,217,126,0.07)", border: `1px solid rgba(0,217,126,0.2)`, fontSize: 12, color: C.green, fontFamily: "monospace" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 2s infinite" }} />
              매일 08:00 KST · AI 미국 증시 브리핑
            </div>
          </div>

          <h1 style={{ textAlign: "center", fontSize: "clamp(36px,7vw,72px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-2px", marginBottom: 24 }}>
            <span style={{ color: C.text }}>월가의 밤,</span><br />
            <span style={{ background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>당신의 아침에</span>
          </h1>

          <p style={{ textAlign: "center", fontSize: 18, color: C.muted, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 44px" }}>
            미국 증시 마감 후 Claude AI가 분석하고,<br />
            <strong style={{ color: C.text }}>매일 오전 8시</strong> 텔레그램으로 브리핑을 전달합니다.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 60, flexWrap: "wrap" }}>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "14px 32px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: "0 8px 32px rgba(0,217,126,0.25)" }}>
              📱 텔레그램 시작하기
            </a>
            <a href="#subscribe" style={{ padding: "14px 24px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Chat ID로 구독 ↓
            </a>
          </div>

          {/* 지표 */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <StatCard value={subCount !== null ? `${animatedCount}명` : "-"} label="구독자" sub="실시간" />
            <StatCard value={adminStats?.total_watchlist_items != null ? `${adminStats.total_watchlist_items}개` : "200+"} label="관심종목 등록" sub="누적" />
            <StatCard value={adminStats?.total_price_alerts != null ? `${adminStats.total_price_alerts}개` : "0"} label="가격 알림" sub="활성" />
            <StatCard value="08:00" label="발송 시각" sub="KST 매일" />
            {nextBriefing && <StatCard value={nextBriefing} label="다음 브리핑까지" sub="실시간 카운트다운" />}
          </div>
        </div>
      </section>

      {/* LIVE MARKET WIDGET */}
      {marketData && (
        <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "40px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3 }}>LIVE MARKET</span>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>30초마다 갱신</span>
              {marketSession.nyTime && <span style={{ fontSize: 11, color: marketSession.color, marginLeft: 8, fontFamily: "monospace" }}>{marketSession.nyTime} · {marketSession.label}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
              {/* 지수 */}
              <div style={{ padding: "20px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 }}>US INDICES</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(marketData.indices).map(([name, d]) => (
                    <IndexTicker key={name} name={name} data={d} sparkPrices={sparklines[name]} />
                  ))}
                </div>
              </div>
              {/* 환율 */}
              <div style={{ padding: "20px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 }}>FX RATES</p>
                <FxWidget fx={marketData.fx} />
                <div style={{ display: "none", flexDirection: "column", gap: 8 }}>
                  {Object.entries(marketData.fx).map(([name, d]) => (
                    <IndexTicker key={name} name={name} data={d} />
                  ))}
                </div>
              </div>
              {/* 공포탐욕 + VIX */}
              <div style={{ padding: "20px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2 }}>FEAR & GREED</p>
                  {marketData.indices["VIX"] && (() => {
                    const vix = marketData.indices["VIX"];
                    const vixColor = vix.price >= 30 ? "#ff4466" : vix.price >= 20 ? "#f59e0b" : "#00d97e";
                    return (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 2 }}>VIX 공포지수</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: vixColor, fontFamily: "monospace" }}>
                          {vix.price.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: vixColor }}>
                          {vix.price >= 30 ? "😱 극단공포" : vix.price >= 20 ? "😰 경계" : "😌 안정"}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <FearGauge score={marketData.fear_greed.score} label={marketData.fear_greed.label_kr} />
                <p style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>CNN Fear & Greed Index</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TRENDING STOCKS */}
      {trending.length > 0 && (
        <section style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace", letterSpacing: 3 }}>TRENDING</span>
              <span style={{ fontSize: 11, color: C.muted }}>뉴스 언급 급등 종목</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {trending.map(t => {
                const up = t.change_pct >= 0;
                const sentColor = t.sentiment_score > 0.15 ? C.green : t.sentiment_score < -0.15 ? C.red : C.muted;
                return (
                  <div key={t.ticker} style={{ padding: "12px 16px", borderRadius: 12, background: C.card, border: `1px solid ${up ? `${C.green}25` : `${C.red}20`}`, minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{t.ticker}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: up ? C.green : C.red }}>{up ? "+" : ""}{t.change_pct.toFixed(2)}%</div>
                    <div style={{ fontSize: 10, color: sentColor, marginTop: 3 }}>뉴스 {t.mentions}건 {t.sentiment_score > 0.1 ? "▲" : t.sentiment_score < -0.1 ? "▼" : "-"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TODAY'S BRIEFING */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "60px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>TODAY'S BRIEFING</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text }}>오늘의 AI 브리핑</h2>
            <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>매일 아침 8시 전송되는 실제 브리핑 내용입니다</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {briefingLoading
              ? [0,1,2,3,4].map(i => <SkeletonCard key={i} />)
              : briefing.length > 0
                ? briefing.map((t, i) => <BriefingCard key={i} text={t} index={i} />)
                : <div style={{ color: C.muted, gridColumn: "1/-1", textAlign: "center", padding: 40 }}>
                    브리핑 데이터를 불러오는 중입니다. 잠시 후 새로고침 해주세요.
                  </div>
            }
          </div>
        </div>
      </section>

      {/* BRIEFING HISTORY */}
      {historyDates.length > 0 && (
        <section style={{ padding: "40px 24px", background: C.bg }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3 }}>BRIEFING HISTORY</span>
              <span style={{ fontSize: 11, color: C.muted }}>지난 7일 브리핑</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {historyDates.map(date => (
                <button key={date} onClick={async () => {
                  if (historyBriefing[date]) { setSelectedDate(date); return; }
                  try {
                    const r = await fetch(`${API}/summary/history/${date}`);
                    const d = await r.json();
                    if (d.tweets) {
                      setHistoryBriefing(prev => ({ ...prev, [date]: d.tweets }));
                      setSelectedDate(date);
                    }
                  } catch {}
                }} style={{
                  padding: "6px 14px", borderRadius: 8, border: `1px solid ${selectedDate === date ? C.green : C.border}`,
                  background: selectedDate === date ? `${C.green}15` : C.card, color: selectedDate === date ? C.green : C.muted,
                  fontSize: 12, fontFamily: "monospace", cursor: "pointer", fontWeight: 600, transition: "all 0.2s"
                }}>{date}</button>
              ))}
            </div>
            {selectedDate && historyBriefing[selectedDate] && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                {historyBriefing[selectedDate].map((t, i) => <BriefingCard key={i} text={t} index={i} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* LIVE STOCK DEMO */}
      {marketData && (
        <section style={{ padding: "60px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>STOCK ANALYSIS</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 8, color: C.text }}>텔레그램에서 즉시 조회</h2>
            <p style={{ color: C.muted, textAlign: "center", marginBottom: 36, fontSize: 14 }}>종목명이나 티커를 입력하면 AI 분석 리포트를 즉시 받아보세요</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { name: "NVIDIA", ticker: "NVDA", emoji: "🟢", desc: "AI 반도체" },
                { name: "TESLA", ticker: "TSLA", emoji: "⚡", desc: "전기차" },
                { name: "APPLE", ticker: "AAPL", emoji: "🍎", desc: "빅테크" },
                { name: "MSFT", ticker: "MSFT", emoji: "🪟", desc: "클라우드" },
                { name: "AMAZON", ticker: "AMZN", emoji: "📦", desc: "이커머스·AI" },
                { name: "META", ticker: "META", emoji: "👁", desc: "소셜·VR" },
              ].map(({ name, ticker, emoji, desc }) => {
                const liveData = marketData?.big_stocks?.[ticker];
                const up = liveData ? liveData.change_pct >= 0 : null;
                return (
                  <div key={ticker} style={{ padding: "16px", borderRadius: 14, background: C.card, border: `1px solid ${up === null ? C.border : up ? `${C.green}30` : `${C.red}20`}`, position: "relative", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 22 }}>{emoji}</div>
                      {liveData && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>${liveData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>{up ? "+" : ""}{liveData.change_pct.toFixed(2)}%</div>
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, color: C.text, fontSize: 13 }}>{ticker}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: `${C.green}80`, marginTop: 4 }}>@goohaejo_bot &gt; {ticker}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center" }}>
              <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
                텔레그램에서 직접 해보기 →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ECONOMIC CALENDAR */}
      <EconomicCalendar />

      {/* STOCK SEARCH WIDGET */}
      <StockSearchWidget isMobile={isMobile} />

      {/* NEWS SECTION */}
      {news.length > 0 && (
        <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "60px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>WALL STREET NEWS</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: C.text }}>오늘의 월가 뉴스</h2>
            <p style={{ color: C.muted, marginBottom: 28, fontSize: 14 }}>Alpha Vantage 뉴스 감성 분석</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {news.map((n, i) => {
                const sentColor = n.sentiment === "Bullish" || n.sentiment === "Somewhat-Bullish" ? C.green : n.sentiment === "Bearish" || n.sentiment === "Somewhat-Bearish" ? C.red : C.muted;
                const sentLabel = n.sentiment === "Bullish" ? "긍정" : n.sentiment === "Somewhat-Bullish" ? "다소긍정" : n.sentiment === "Bearish" ? "부정" : n.sentiment === "Somewhat-Bearish" ? "다소부정" : "중립";
                return (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, textDecoration: "none" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: `${sentColor}20`, color: sentColor, whiteSpace: "nowrap" }}>{sentLabel}</span>
                    <span style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: 500 }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{n.source}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section style={{ padding: "60px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>FEATURES</p>
          <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 40, color: C.text }}>한국 투자자를 위한 서비스</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {[
              { icon: "🤖", title: "AI 브리핑", desc: "Claude AI가 200개 이상의 데이터 포인트를 분석해 핵심만 전달. 지수·섹터·환율·한국 영향까지.", color: C.green },
              { icon: "🔍", title: "종목 즉시 분석", desc: "텔레그램에 'NVDA' 또는 '삼성전자' 입력 → AI 분석 리포트 즉시 발송. 실시간 데이터 기반.", color: "#a78bfa" },
              { icon: "📋", title: "관심종목 알림", desc: "/watchlist add NVDA 로 추가. 매일 아침 관심종목 현황을 함께 받아보세요.", color: "#f59e0b" },
              { icon: "🌏", title: "한국 투자자 맞춤", desc: "USD/KRW 환율 영향, 삼성·하이닉스·카카오·네이버 등 한국 주식에 미치는 영향 분석.", color: "#3b82f6" },
              { icon: "⚡", title: "빠른 시황", desc: "/시황 커맨드로 현재 주요 지수와 빅테크 현황을 즉시 확인.", color: "#ec4899" },
              { icon: "📊", title: "섹터 분석", desc: "/sector 반도체 처럼 섹터별 흐름을 한국어로 쉽게 받아보세요.", color: "#06b6d4" },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div style={{ padding: "24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid ${f.color}30` }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* COMMANDS REFERENCE */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "60px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>COMMANDS</p>
          <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 8, color: C.text }}>전체 커맨드</h2>
          <p style={{ color: C.muted, textAlign: "center", marginBottom: 36, fontSize: 14 }}>@goohaejo_bot 에서 바로 사용하세요</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {[
              { cmd: "/브리핑", desc: "AI 미국 증시 브리핑 (즉시)", color: C.green },
              { cmd: "/시황", desc: "지수·환율·공포탐욕 현황", color: C.green },
              { cmd: "/뉴스", desc: "월가 뉴스 한국어 요약", color: C.green },
              { cmd: "/뉴스 NVDA", desc: "종목별 뉴스 요약", color: C.green },
              { cmd: "/매크로", desc: "VIX·DXY·금리·오일·금", color: "#a78bfa" },
              { cmd: "/상승 반도체", desc: "섹터별 상승 종목 랭킹", color: "#a78bfa" },
              { cmd: "/하락 tech", desc: "섹터별 하락 종목 랭킹", color: "#a78bfa" },
              { cmd: "/랭킹 crypto", desc: "암호화폐·빅테크·코스피", color: "#a78bfa" },
              { cmd: "/종목전망 NVDA", desc: "주간 전망 AI 분석", color: "#f59e0b" },
              { cmd: "/compare NVDA TSLA", desc: "종목 비교 분석", color: "#f59e0b" },
              { cmd: "/환율", desc: "USD/KRW·JPY AI 전망", color: "#f59e0b" },
              { cmd: "/sector 반도체", desc: "섹터 ETF 분석", color: "#f59e0b" },
              { cmd: "/watchlist add NVDA", desc: "관심종목 추가·조회", color: "#3b82f6" },
              { cmd: "/알림 NVDA 200", desc: "가격 알림 등록", color: "#3b82f6" },
              { cmd: "/포트폴리오", desc: "관심종목 AI 진단", color: "#3b82f6" },
              { cmd: "/내통계", desc: "내 구독·알림 현황", color: "#3b82f6" },
              { cmd: "/구독", desc: "매일 8시 브리핑 구독", color: "#ec4899" },
              { cmd: "/지난브리핑", desc: "어제 브리핑 다시보기", color: "#ec4899" },
            ].map(({ cmd, desc, color }) => (
              <div key={cmd} style={{ padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}40` }}>
                <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>{cmd}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              텔레그램에서 바로 시작하기 →
            </a>
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section style={{ padding: "40px 24px", background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3, marginBottom: 20, textAlign: "center" }}>POWERED BY</p>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
            {[
              { name: "Claude AI", desc: "AI 분석 엔진", emoji: "🤖", color: "#c77dff" },
              { name: "Railway", desc: "백엔드 인프라", emoji: "🚂", color: "#7c3aed" },
              { name: "Vercel", desc: "프론트엔드", emoji: "▲", color: "#e8e8f0" },
              { name: "yfinance", desc: "실시간 시세", emoji: "📈", color: "#00d97e" },
              { name: "Telegram Bot", desc: "메시지 채널", emoji: "✈️", color: "#3b82f6" },
            ].map(({ name, desc, emoji, color }) => (
              <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 28 }}>{emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW TO */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "60px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>HOW TO START</p>
          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 40, color: C.text }}>30초면 시작합니다</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { n: "01", title: "텔레그램 열기", desc: "@goohaejo_bot 검색 후 /start 입력", color: C.green },
              { n: "02", title: "/구독 입력", desc: "구독 커맨드 입력 → 즉시 완료. 또는 아래 Chat ID 폼 사용", color: "#a78bfa" },
              { n: "03", title: "내일 8시 확인", desc: "다음 날 오전 8시에 첫 브리핑이 도착합니다", color: "#f59e0b" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, textAlign: "left" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 22, color: s.color, minWidth: 32 }}>{s.n}</span>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: C.muted }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUBSCRIBE FORM */}
      <section id="subscribe" style={{ padding: "60px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>SUBSCRIBE</p>
          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, textAlign: "center", color: C.text }}>지금 구독하기</h2>
          <p style={{ color: C.muted, textAlign: "center", marginBottom: 36, fontSize: 14 }}>
            텔레그램 Chat ID를 입력하면 매일 8시에 브리핑이 전송됩니다
          </p>

          <div style={{ padding: "36px", borderRadius: 20, background: C.card, border: `1px solid rgba(0,217,126,0.2)` }}>
            {subState === "done" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: C.green, marginBottom: 8 }}>구독 완료!</h3>
                <p style={{ color: C.muted }}>{subMsg}</p>
                <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 20, padding: "12px 28px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, textDecoration: "none" }}>
                  텔레그램 열기 →
                </a>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={chatId}
                    onChange={e => setChatId(e.target.value)}
                    placeholder="Chat ID 입력 (예: 123456789)"
                    style={{ flex: "1 1 180px", padding: "13px 16px", borderRadius: 10, background: "#08081a", border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontFamily: "monospace", outline: "none" }}
                  />
                  <button type="submit" disabled={subState === "loading"}
                    style={{ padding: "13px 24px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", opacity: subState === "loading" ? 0.7 : 1 }}>
                    {subState === "loading" ? "처리 중..." : "구독하기 →"}
                  </button>
                </form>
                {subState === "error" && (
                  <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{subMsg}</p>
                )}
                <p style={{ fontSize: 12, color: "#2a2a44", marginTop: 14 }}>
                  Chat ID 모르시면{" "}
                  <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ color: `${C.green}80`, textDecoration: "underline" }}>@goohaejo_bot</a>
                  {" "}에서 /start 입력 후 확인하세요
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "40px 24px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 28 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#07070f" }}>9</div>
                <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>구해조</span>
              </div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 260 }}>
                미국 증시 AI 브리핑 서비스.<br />
                Claude AI 기반, 매일 오전 8시 KST.
              </p>
            </div>
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>서비스</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>텔레그램 봇</a>
                  <a href="#subscribe" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>구독하기</a>
                  <a href="/briefings" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>브리핑 아카이브</a>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>기술 스택</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["FastAPI · Railway", "Next.js · Vercel", "Claude AI · yfinance"].map(t => (
                    <span key={t} style={{ fontSize: 13, color: C.muted }}>{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>링크</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href="https://github.com/norandal/9haejo" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>GitHub</a>
                  <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>@goohaejo_bot</a>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <p style={{ fontSize: 11, color: "#22224a" }}>© 2026 구해조</p>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#0a1f14", color: C.green, border: `1px solid ${C.green}30`, fontFamily: "monospace" }}>v3.0 BETA</span>
              <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.muted, textDecoration: "none" }}>피드백 보내기 →</a>
            </div>
            <p style={{ fontSize: 11, color: "#22224a" }}>본 서비스는 투자 권유가 아닙니다. 투자 판단은 본인 책임입니다.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 6px #00d97e} 50%{opacity:.4;box-shadow:none} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes needleSpin { from{transform-origin:54px 68px;transform:rotate(-90deg)} to{transform-origin:54px 68px;transform:rotate(0deg)} }
        .light-mode { filter: invert(1) hue-rotate(180deg); }
        .light-mode img, .light-mode video, .light-mode svg { filter: invert(1) hue-rotate(180deg); }
        .ticker-item:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>
    </div>
  );
}
