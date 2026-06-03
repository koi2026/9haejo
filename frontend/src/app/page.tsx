"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import NavSearch from "@/components/NavSearch";
import TickerBanner from "@/components/TickerBanner";
import OnboardingModal from "@/components/OnboardingModal";

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

function StatCard({ value, label, sub, live, highlight }: { value: string; label: string; sub?: string; live?: boolean; highlight?: boolean }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => { setPulse(p => !p); }, 1500);
    return () => clearInterval(id);
  }, [live]);
  return (
    <div style={{
      padding: "20px 24px", borderRadius: 16, background: C.card,
      border: `1px solid ${highlight ? C.green : C.border}`,
      textAlign: "center", flex: "1 1 140px", position: "relative",
      boxShadow: highlight ? `0 0 20px ${C.green}18` : "none",
    }}>
      {live && (
        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: C.green,
            opacity: pulse ? 1 : 0.3, transition: "opacity 0.6s ease",
            boxShadow: pulse ? `0 0 6px ${C.green}` : "none",
          }} />
          <span style={{ fontSize: 9, color: C.green, fontFamily: "monospace", letterSpacing: 1 }}>LIVE</span>
        </div>
      )}
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
  const polarY = (radius: number, deg: number) => cy - radius * Math.sin(rad(deg));

  // Arc from 180deg (left) to 0deg (right), counterclockwise = bottom half hidden
  const arcSeg = (startPct: number, endPct: number) => {
    const sa = 180 - startPct * 1.8;
    const ea = 180 - endPct * 1.8;
    const x1 = polarX(R, sa); const y1 = polarY(R, sa);
    const x2 = polarX(R, ea); const y2 = polarY(R, ea);
    const xi1 = polarX(r2, sa); const yi1 = polarY(R, sa);
    const xi2 = polarX(r2, ea); const yi2 = polarY(r2, ea);
    const large = Math.abs(endPct - startPct) > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${polarX(r2,ea)} ${polarY(r2,ea)} A ${r2} ${r2} 0 ${large} 0 ${polarX(r2,sa)} ${polarY(r2,sa)} Z`;
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

function FxWidget({ fx, lastUpdated }: { fx: Record<string, { price: number; change_pct: number }>; lastUpdated?: number }) {
  const pairs = ["USD/KRW", "USD/JPY", "EUR/USD", "USD/CNH"];
  const icons: Record<string, string> = { "USD/KRW": "🇰🇷", "USD/JPY": "🇯🇵", "EUR/USD": "🇪🇺", "USD/CNH": "🇨🇳" };
  const names: Record<string, string> = { "USD/KRW": "달러/원", "USD/JPY": "달러/엔", "EUR/USD": "유로/달러", "USD/CNH": "달러/위안" };
  const format: Record<string, (v: number) => string> = {
    "USD/KRW": v => "₩" + v.toLocaleString("ko-KR", { maximumFractionDigits: 0 }),
    "USD/JPY": v => "¥" + v.toFixed(2),
    "EUR/USD": v => "$" + v.toFixed(4),
    "USD/CNH": v => "¥" + v.toFixed(4),
  };
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [lastUpdated]);
  const secondsAgo = lastUpdated ? Math.round((Date.now() - lastUpdated) / 1000) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, opacity: pulse ? 1 : 0.4, transition: "opacity 0.3s", boxShadow: pulse ? `0 0 6px ${C.green}` : "none" }} />
          <span style={{ fontSize: 10, color: C.green, fontFamily: "monospace", letterSpacing: 1 }}>LIVE</span>
        </div>
        {secondsAgo !== null && <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.round(secondsAgo/60)}m ago`}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pairs.map(pair => {
          const d = fx[pair];
          if (!d) return null;
          const up = d.change_pct >= 0;
          const color = up ? C.green : C.red;
          const barWidth = Math.min(Math.abs(d.change_pct) / 2 * 100, 100);
          return (
            <div key={pair} style={{ padding: "10px 14px", borderRadius: 10, background: "#08081a", border: `1px solid ${up ? "#00d97e18" : "#ff446618"}`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${barWidth}%`, background: color, opacity: 0.5 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{icons[pair]}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, fontFamily: "monospace" }}>{pair}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{names[pair]}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{format[pair](d.price)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color }}>{up ? "+" : ""}{d.change_pct.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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

interface SectorData { ticker: string; label: string; price: number; change_pct: number }

function SectorHeatmap() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/market/sectors`)
      .then(r => r.json())
      .then(d => { if (d.sectors?.length) { setSectors(d.sectors); setLoaded(true); } })
      .catch(() => {});
  }, []);

  if (!loaded) return null;

  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.change_pct)), 1);

  return (
    <section style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 3 }}>SECTOR HEATMAP</span>
          <span style={{ fontSize: 11, color: C.muted }}>섹터별 등락률</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
          {sectors.map(s => {
            const up = s.change_pct >= 0;
            const intensity = Math.min(Math.abs(s.change_pct) / maxAbs, 1);
            const baseColor = up ? "#00d97e" : "#ff4466";
            const bg = up
              ? `rgba(0,217,126,${0.06 + intensity * 0.22})`
              : `rgba(255,68,102,${0.06 + intensity * 0.22})`;
            const border = up
              ? `rgba(0,217,126,${0.15 + intensity * 0.4})`
              : `rgba(255,68,102,${0.15 + intensity * 0.4})`;
            return (
              <div key={s.ticker} style={{
                padding: "12px 14px", borderRadius: 10,
                background: bg, border: `1px solid ${border}`,
                textAlign: "center", cursor: "default",
                transition: "transform 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>{s.ticker}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: baseColor, fontFamily: "monospace" }}>
                  {up ? "+" : ""}{s.change_pct.toFixed(2)}%
                </div>
                {/* intensity bar */}
                <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: `${baseColor}20`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${intensity * 100}%`, background: baseColor, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10, color: C.muted, justifyContent: "flex-end" }}>
          <span>🟢 색이 짙을수록 강한 상승</span>
          <span>🔴 색이 짙을수록 강한 하락</span>
        </div>
      </div>
    </section>
  );
}

interface Week52Stock { ticker: string; price: number; week52_high: number; week52_low: number; position: number; pct_from_high: number }

function Week52Widget() {
  const [nearHigh, setNearHigh] = useState<Week52Stock[]>([]);
  const [nearLow, setNearLow] = useState<Week52Stock[]>([]);
  const [tab, setTab] = useState<"high" | "low">("high");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/market/week52`)
      .then(r => r.json())
      .then(d => { if (d.near_high || d.near_low) { setNearHigh(d.near_high || []); setNearLow(d.near_low || []); setLoaded(true); } })
      .catch(() => {});
  }, []);

  if (!loaded) return null;
  const list = tab === "high" ? nearHigh : nearLow;

  return (
    <section style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3 }}>52W EXTREMES</span>
            <span style={{ fontSize: 11, color: C.muted }}>52주 가격 위치</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["high", "low"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: tab === t ? (t === "high" ? `${C.green}20` : `${C.red}20`) : "transparent",
                color: tab === t ? (t === "high" ? C.green : C.red) : C.muted,
                border: `1px solid ${tab === t ? (t === "high" ? C.green : C.red) : C.border}`,
                transition: "all 0.15s",
              }}>
                {t === "high" ? "📈 신고가 근접" : "📉 신저가 근접"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {list.map(s => {
            const isHigh = tab === "high";
            const color = isHigh ? C.green : C.red;
            return (
              <Link key={s.ticker} href={`/stock/${s.ticker}`} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "12px 14px", borderRadius: 12, background: C.card,
                  border: `1px solid ${color}20`, transition: "all 0.15s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; (e.currentTarget as HTMLElement).style.borderColor = color + "50"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.borderColor = color + "20"; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "monospace", marginBottom: 4 }}>{s.ticker}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "monospace", marginBottom: 6 }}>${s.price.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color, fontWeight: 700 }}>
                    {isHigh ? `고가 ${s.pct_from_high.toFixed(1)}%` : `저가 +${(s.position).toFixed(0)}%권`}
                  </div>
                  {/* 52w position bar */}
                  <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: C.border, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${s.position}%`, background: color, borderRadius: 2 }} />
                    <div style={{ position: "absolute", top: -1, left: `${s.position}%`, transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: color }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface MoverStock { ticker: string; price: number; change_pct: number }

function MarketMovers() {
  const [gainers, setGainers] = useState<MoverStock[]>([]);
  const [losers, setLosers] = useState<MoverStock[]>([]);
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/market/movers`)
      .then(r => r.json())
      .then(d => {
        if (d.gainers?.length) { setGainers(d.gainers); setLosers(d.losers || []); setLoaded(true); }
      })
      .catch(() => {});
  }, []);

  if (!loaded) return null;
  const list = tab === "gainers" ? gainers : losers;

  return (
    <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3 }}>MARKET MOVERS</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["gainers", "losers"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: tab === t ? (t === "gainers" ? `${C.green}20` : `${C.red}20`) : "transparent",
                color: tab === t ? (t === "gainers" ? C.green : C.red) : C.muted,
                border: `1px solid ${tab === t ? (t === "gainers" ? C.green : C.red) : C.border}`,
                transition: "all 0.15s",
              }}>
                {t === "gainers" ? "📈 상승" : "📉 하락"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {list.map(s => {
            const up = s.change_pct >= 0;
            const color = up ? C.green : C.red;
            return (
              <Link key={s.ticker} href={`/stock/${s.ticker}`} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "14px 16px", borderRadius: 12, background: C.card,
                  border: `1px solid ${color}20`,
                  transition: "transform 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; (e.currentTarget as HTMLElement).style.borderColor = color + "50"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.borderColor = color + "20"; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "monospace", marginBottom: 4 }}>{s.ticker}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>${s.price.toFixed(2)}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color }}>
                    {up ? "▲" : "▼"} {up ? "+" : ""}{s.change_pct.toFixed(2)}%
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EarningsCalendar() {
  const [events, setEvents] = useState<{ ticker: string; name: string; date: string; days_left: number; is_past: boolean }[]>([]);
  useEffect(() => {
    fetch(`${API}/calendar/earnings`)
      .then(r => r.json())
      .then(d => { if (d.events?.length) setEvents(d.events); })
      .catch(() => {});
  }, []);
  if (!events.length) return null;
  const upcoming = events.filter(e => !e.is_past).slice(0, 8);
  if (!upcoming.length) return null;
  return (
    <section style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace", letterSpacing: 3 }}>EARNINGS CALENDAR</span>
          <span style={{ fontSize: 11, color: C.muted }}>실적 발표 일정</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {upcoming.map(ev => {
            const isImminent = ev.days_left <= 3;
            const color = isImminent ? "#f59e0b" : C.muted;
            return (
              <Link key={ev.ticker + ev.date} href={`/stock/${ev.ticker}`} style={{ textDecoration: "none" }}>
                <div style={{ padding: "12px 16px", borderRadius: 12, background: C.card, border: `1px solid ${isImminent ? "#f59e0b40" : C.border}`, cursor: "pointer", transition: "border-color 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{ev.ticker}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color, background: `${color}18`, padding: "2px 8px", borderRadius: 6 }}>
                      {ev.days_left === 0 ? "오늘!" : `D-${ev.days_left}`}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{ev.date}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const POPULAR_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AVGO", "BTC-USD", "ETH-USD"];

const AUTOCOMPLETE_LIST: { ticker: string; name: string; sector: string }[] = [
  { ticker: "NVDA", name: "NVIDIA", sector: "반도체" },
  { ticker: "TSLA", name: "Tesla", sector: "전기차" },
  { ticker: "AAPL", name: "Apple", sector: "기술" },
  { ticker: "MSFT", name: "Microsoft", sector: "기술" },
  { ticker: "AMZN", name: "Amazon", sector: "이커머스" },
  { ticker: "META", name: "Meta Platforms", sector: "소셜미디어" },
  { ticker: "GOOGL", name: "Alphabet", sector: "기술" },
  { ticker: "AVGO", name: "Broadcom", sector: "반도체" },
  { ticker: "AMD", name: "AMD", sector: "반도체" },
  { ticker: "INTC", name: "Intel", sector: "반도체" },
  { ticker: "QCOM", name: "Qualcomm", sector: "반도체" },
  { ticker: "PLTR", name: "Palantir", sector: "AI" },
  { ticker: "CRM", name: "Salesforce", sector: "SaaS" },
  { ticker: "ORCL", name: "Oracle", sector: "기술" },
  { ticker: "NFLX", name: "Netflix", sector: "스트리밍" },
  { ticker: "COIN", name: "Coinbase", sector: "크립토" },
  { ticker: "MSTR", name: "MicroStrategy", sector: "크립토" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "금융" },
  { ticker: "GS", name: "Goldman Sachs", sector: "금융" },
  { ticker: "BAC", name: "Bank of America", sector: "금융" },
  { ticker: "XOM", name: "ExxonMobil", sector: "에너지" },
  { ticker: "LLY", name: "Eli Lilly", sector: "바이오" },
  { ticker: "UNH", name: "UnitedHealth", sector: "헬스케어" },
  { ticker: "V", name: "Visa", sector: "금융" },
  { ticker: "MA", name: "Mastercard", sector: "금융" },
  { ticker: "SPY", name: "S&P500 ETF", sector: "ETF" },
  { ticker: "QQQ", name: "NASDAQ ETF", sector: "ETF" },
  { ticker: "SOXX", name: "반도체 ETF", sector: "ETF" },
  { ticker: "BTC-USD", name: "Bitcoin", sector: "크립토" },
  { ticker: "ETH-USD", name: "Ethereum", sector: "크립토" },
];

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState<{
    ticker: string; price: number; change_pct: number; change: number; volume: number;
    name?: string; sector?: string; pe_ratio?: number | null; market_cap?: number | null;
    week52_high?: number | null; week52_low?: number | null; week52_position?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hotSearches, setHotSearches] = useState<{ ticker: string; count: number }[]>([]);

  useEffect(() => {
    fetch(`${API}/market/trending-searches`)
      .then(r => r.json())
      .then(d => { if (d.tickers?.length) setHotSearches(d.tickers); })
      .catch(() => {});
  }, []);

  const suggestions = query.length >= 1
    ? AUTOCOMPLETE_LIST.filter(s =>
        s.ticker.startsWith(query.toUpperCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

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

  // 자동 검색: 정확한 티커(2~6자 알파) 입력 시 600ms 후 자동 조회
  useEffect(() => {
    const q = query.trim();
    if (/^[A-Z]{2,6}$/.test(q)) {
      const t = setTimeout(() => search(q), 600);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line
  }, [query]);

  const up = result ? result.change_pct >= 0 : null;

  return (
    <section id="lookup" style={{ padding: "60px 24px", background: C.bg }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: C.blue, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>STOCK LOOKUP</p>
        <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", marginBottom: 8, color: C.text }}>종목 실시간 시세</h2>
        <p style={{ color: C.muted, textAlign: "center", marginBottom: 28, fontSize: 14 }}>티커를 입력하면 실시간 가격을 조회합니다</p>

        {/* Search bar */}
        <form onSubmit={(e) => { e.preventDefault(); setShowSuggestions(false); search(query); }} style={{ display: "flex", gap: 8, marginBottom: 16, position: "relative" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value.toUpperCase()); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="NVDA, TSLA, AAPL..."
              autoComplete="off"
              style={{
                width: "100%", padding: "14px 18px", borderRadius: 12, background: C.card, border: `1px solid ${showSuggestions && suggestions.length > 0 ? C.blue : C.border}`,
                color: C.text, fontSize: 16, fontFamily: "monospace", fontWeight: 700, outline: "none", boxSizing: "border-box",
              }}
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                marginTop: 4, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}>
                {suggestions.map(s => (
                  <button key={s.ticker} type="button"
                    onMouseDown={() => { setQuery(s.ticker); setShowSuggestions(false); search(s.ticker); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "10px 16px", background: "transparent",
                      border: "none", borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${C.blue}10`)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{s.ticker}</span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${C.blue}18`, color: C.blue }}>{s.sector}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" disabled={loading} style={{
            padding: "14px 24px", borderRadius: 12, background: C.grad, color: "#07070f",
            fontWeight: 800, fontSize: 14, border: "none", cursor: loading ? "wait" : "pointer",
          }}>
            {loading ? "..." : "조회"}
          </button>
        </form>

        {/* Popular tickers */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {POPULAR_TICKERS.map(t => (
            <button key={t} onClick={() => { setQuery(t); search(t); }} style={{
              padding: "4px 10px", borderRadius: 6, background: C.card, border: `1px solid ${C.border}`,
              color: C.muted, fontSize: 11, fontFamily: "monospace", cursor: "pointer", fontWeight: 600,
            }}>{t}</button>
          ))}
        </div>
        {/* Hot searches */}
        {hotSearches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "monospace", letterSpacing: 2 }}>🔥 HOT</span>
            {hotSearches.map((h, i) => (
              <button key={h.ticker} onClick={() => { setQuery(h.ticker); search(h.ticker); }} style={{
                padding: "3px 10px", borderRadius: 6, background: `#f59e0b${i === 0 ? "20" : "10"}`,
                border: `1px solid #f59e0b${i === 0 ? "50" : "25"}`,
                color: "#f59e0b", fontSize: 11, fontFamily: "monospace", cursor: "pointer", fontWeight: 700,
              }}>
                {i + 1}. {h.ticker}
              </button>
            ))}
          </div>
        )}

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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/stock/${result.ticker}`}
                style={{ flex: 1, minWidth: 120, padding: "10px 16px", borderRadius: 10, background: `${C.green}15`, border: `1px solid ${C.green}30`, color: C.green, fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                🔍 AI 심층 분석
              </Link>
              <Link href={`/compare?a=${result.ticker}&b=SPY`}
                style={{ flex: 1, minWidth: 100, padding: "10px 16px", borderRadius: 10, background: `${C.blue}10`, border: `1px solid ${C.blue}30`, color: C.blue, fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                ⚖️ 비교
              </Link>
              <a href={`https://t.me/goohaejo_bot`} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, minWidth: 100, padding: "10px 16px", borderRadius: 10, background: "#08081a", border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                🤖 봇 분석
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Check if dismissed
    if (localStorage.getItem("pwa-banner-dismissed")) return;

    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    if (!ios) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler as EventListener);
      return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
    } else {
      // Show iOS instructions after 3 seconds
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") dismiss();
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 200,
      background: C.card, border: `1px solid ${C.green}40`,
      borderRadius: 16, padding: "16px 20px",
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${C.green}15`,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#07070f", flexShrink: 0 }}>9</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>구해조 앱으로 설치</div>
        {isIOS ? (
          <div style={{ fontSize: 11, color: C.muted }}>Safari에서 공유 버튼 → 홈 화면에 추가</div>
        ) : (
          <div style={{ fontSize: 11, color: C.muted }}>홈 화면에 추가하고 앱처럼 사용하세요</div>
        )}
      </div>
      {!isIOS && (
        <button onClick={install} style={{
          padding: "8px 16px", borderRadius: 8, background: C.grad, color: "#07070f",
          fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer", flexShrink: 0,
        }}>설치</button>
      )}
      <button onClick={dismiss} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "4px", flexShrink: 0 }}>✕</button>
    </div>
  );
}

type SentInfo = { emoji: string; label: string; color: string; group: string };
function NewsSection({ news, getSentInfo }: { news: { title: string; source: string; sentiment: string; url: string; summary?: string }[]; getSentInfo: (s: string) => SentInfo }) {
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const filtered = filter === "all" ? news : news.filter(n => getSentInfo(n.sentiment).group === filter);
  const counts = {
    positive: news.filter(n => getSentInfo(n.sentiment).group === "positive").length,
    negative: news.filter(n => getSentInfo(n.sentiment).group === "negative").length,
    neutral: news.filter(n => getSentInfo(n.sentiment).group === "neutral").length,
  };
  const filters: { key: "all" | "positive" | "negative" | "neutral"; label: string; color: string; count?: number }[] = [
    { key: "all", label: "전체", color: C.muted, count: news.length },
    { key: "positive", label: "📈 긍정", color: C.green, count: counts.positive },
    { key: "negative", label: "📉 부정", color: C.red, count: counts.negative },
    { key: "neutral", label: "😐 중립", color: C.muted, count: counts.neutral },
  ];
  return (
    <section id="news" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>WALL STREET NEWS</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4, color: C.text }}>오늘의 월가 뉴스</h2>
            <p style={{ color: C.muted, fontSize: 13 }}>AI 감성 분석 · 클릭해서 원문 확인</p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: filter === f.key ? `${f.color}20` : "transparent",
                  color: filter === f.key ? f.color : C.muted,
                  border: `1px solid ${filter === f.key ? f.color : C.border}`,
                  transition: "all 0.15s",
                }}>
                  {f.label} {f.count !== undefined && <span style={{ opacity: 0.7 }}>({f.count})</span>}
                </button>
              ))}
            </div>
            <Link href="/news" style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
              전체 뉴스 →
            </Link>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 480px), 1fr))", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ color: C.muted, textAlign: "center", padding: 40, gridColumn: "1/-1" }}>해당 카테고리 뉴스가 없습니다.</div>
          ) : filtered.map((n, i) => {
            const si = getSentInfo(n.sentiment);
            const isExp = expanded === i;
            return (
              <div key={i} style={{ borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, overflow: "hidden", transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = si.color + "40")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "14px 18px 10px", textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: `${si.color}18`, color: si.color, border: `1px solid ${si.color}30`, whiteSpace: "nowrap" }}>
                      {si.emoji} {si.label}
                    </span>
                    <span style={{ fontSize: 10, color: C.muted }}>{n.source}</span>
                  </div>
                  <p style={{ fontSize: 13, color: C.text, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{n.title}</p>
                </a>
                {n.summary && (
                  <>
                    <div style={{ padding: "0 18px 10px" }}>
                      <p style={{
                        fontSize: 12, color: C.muted, lineHeight: 1.6, margin: 0,
                        overflow: "hidden", maxHeight: isExp ? "none" : "2.8em",
                        display: isExp ? "block" : "-webkit-box",
                        WebkitLineClamp: isExp ? undefined : 2,
                        WebkitBoxOrient: "vertical" as const,
                      }}>
                        {n.summary}
                      </p>
                    </div>
                    <button onClick={() => setExpanded(isExp ? null : i)}
                      style={{ display: "block", width: "100%", padding: "7px 18px", background: "none", border: "none", borderTop: `1px solid ${C.border}`, cursor: "pointer", fontSize: 11, color: C.muted, textAlign: "left" }}>
                      {isExp ? "▲ 접기" : "▼ 요약 더 보기"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const TRANSLATIONS = {
  ko: {
    siteName: "구해조",
    subscribe: "무료 구독하기",
    heroTag: "AI 주식 브리핑 서비스",
    heroTitle: "월가를 한눈에",
    heroSub: "매일 오전 8시, Claude AI가 분석한 미국 증시 핵심 브리핑을 텔레그램으로 받아보세요.",
    cta: "지금 구독하기 — 무료",
    ctaSub: "신용카드 불필요 · 언제든 해지 가능",
    subscribers: "구독자",
    briefings: "AI 브리핑",
    briefingLabel: "오늘의 AI 브리핑",
    footerTag: "미국 증시 AI 브리핑 서비스.",
    langToggle: "EN",
  },
  en: {
    siteName: "9haejo",
    subscribe: "Subscribe Free",
    heroTag: "AI Stock Briefing Service",
    heroTitle: "Wall Street at a Glance",
    heroSub: "Every morning at 8AM KST, receive Claude AI's analysis of US markets via Telegram.",
    cta: "Subscribe Now — Free",
    ctaSub: "No credit card · Cancel anytime",
    subscribers: "Subscribers",
    briefings: "AI Briefings",
    briefingLabel: "Today's AI Briefing",
    footerTag: "US Stock Market AI Briefing Service.",
    langToggle: "KO",
  },
};

export default function Home() {
  const [chatId, setChatId] = useState("");
  const [subState, setSubState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [subMsg, setSubMsg] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const T = TRANSLATIONS[lang];
  const toggleLang = () => {
    setLang(p => {
      const next = p === "ko" ? "en" : "ko";
      localStorage.setItem("lang", next);
      return next;
    });
  };
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
  const [news, setNews] = useState<{ title: string; source: string; sentiment: string; url: string; summary?: string }[]>([]);
  const [adminStats, setAdminStats] = useState<{ total_price_alerts?: number; total_watchlist_items?: number } | null>(null);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [historyBriefing, setHistoryBriefing] = useState<{ [date: string]: string[] }>({});
  const [sparklines, setSparklines] = useState<{ [ticker: string]: number[] }>({});
  const [trending, setTrending] = useState<{ ticker: string; price: number; change_pct: number; mentions: number; sentiment_score: number }[]>([]);
  const [movers, setMovers] = useState<{ gainers: { ticker: string; price: number; change_pct: number }[]; losers: { ticker: string; price: number; change_pct: number }[] } | null>(null);
  const [insight, setInsight] = useState<{ insight: string; date: string } | null>(null);
  const [marketData, setMarketData] = useState<{
    indices: Record<string, { price: number; change_pct: number }>;
    fx: Record<string, { price: number; change_pct: number }>;
    fear_greed: { score: number; label_kr: string };
    big_stocks?: Record<string, { price: number; change_pct: number }>;
    sectors?: Record<string, { price: number; change_pct: number } | null>;
  } | null>(null);
  const [marketLastUpdated, setMarketLastUpdated] = useState<number | undefined>(undefined);
  const marketRef = useRef<NodeJS.Timeout | null>(null);
  const [myStocks, setMyStocks] = useState<{ ticker: string; price: number; change_pct: number }[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<{
    totalValue: number; totalCost: number; gainPct: number; gainAmt: number;
    bestTicker: string; bestPct: number; worstTicker: string; worstPct: number; count: number;
  } | null>(null);
  const animatedCount = useCountUp(subCount);
  const marketSession = useMarketSession();
  const nextBriefing = useNextBriefingCountdown();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    const saved = localStorage.getItem("theme");
    if (saved === "light") setIsDark(false);
    const savedLang = localStorage.getItem("lang");
    if (savedLang === "en") setLang("en");

    // 포트폴리오 요약 로드 → 홈 배너
    try {
      const positions: { ticker: string; quantity: number; avgCost: number; name?: string }[] =
        JSON.parse(localStorage.getItem("9haejo_portfolio_v2") || "[]");
      if (positions.length) {
        Promise.all(
          positions.map(p =>
            fetch(`${API}/stock/quote/${p.ticker}`).then(r => r.json()).then(d => ({
              ticker: p.ticker, price: d.price ?? p.avgCost, change_pct: d.change_pct ?? 0,
              quantity: p.quantity, avgCost: p.avgCost,
            })).catch(() => ({ ticker: p.ticker, price: p.avgCost, change_pct: 0, quantity: p.quantity, avgCost: p.avgCost }))
          )
        ).then(results => {
          const totalValue = results.reduce((s, r) => s + r.price * r.quantity, 0);
          const totalCost = results.reduce((s, r) => s + r.avgCost * r.quantity, 0);
          const gainAmt = totalValue - totalCost;
          const gainPct = totalCost > 0 ? (gainAmt / totalCost) * 100 : 0;
          const sorted = [...results].sort((a, b) => b.change_pct - a.change_pct);
          setPortfolioSummary({
            totalValue, totalCost, gainPct, gainAmt,
            bestTicker: sorted[0]?.ticker || "", bestPct: sorted[0]?.change_pct || 0,
            worstTicker: sorted[sorted.length - 1]?.ticker || "", worstPct: sorted[sorted.length - 1]?.change_pct || 0,
            count: results.length,
          });
        });
      }
    } catch {}

    // 로컬 관심종목 로드 → 홈 미니 위젯
    try {
      const wl = JSON.parse(localStorage.getItem("9haejo_watchlist_v1") || "[]") as string[];
      if (wl.length) {
        Promise.all(
          wl.slice(0, 6).map(ticker =>
            fetch(`${API}/stock/quote/${ticker}`).then(r => r.json()).then(d => d.error ? null : { ticker, price: d.price, change_pct: d.change_pct }).catch(() => null)
          )
        ).then(results => setMyStocks(results.filter(Boolean) as { ticker: string; price: number; change_pct: number }[]));
      }
    } catch {}
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

    // 구독자 수 (30초마다 갱신)
    const loadSubCount = () => {
      fetch(`${API}/subscribers/count`)
        .then(r => r.json())
        .then(d => setSubCount(d.count))
        .catch(() => {});
    };
    loadSubCount();
    const subInterval = setInterval(loadSubCount, 30000);

    // 실시간 시장 데이터 (30초마다 갱신)
    const loadMarket = () => {
      fetch(`${API}/market/live`)
        .then(r => r.json())
        .then(d => { setMarketData(d); setMarketLastUpdated(Date.now()); })
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

    // 오늘의 AI 인사이트
    fetch(`${API}/market/insight`)
      .then(r => r.json())
      .then(d => { if (d.insight) setInsight(d); })
      .catch(() => {});

    // 당일 상승/하락 상위 종목
    fetch(`${API}/market/movers`)
      .then(r => r.json())
      .then(d => { if (d.gainers?.length || d.losers?.length) setMovers(d); })
      .catch(() => {});


    // 지수 + 빅테크 스파크라인 (7일 데이터)
    const sparkTickers = { "S&P500": "^GSPC", "NASDAQ": "^IXIC", "DOW": "^DJI", "VIX": "^VIX", "KOSPI": "^KS11", "NVDA": "NVDA", "TSLA": "TSLA", "AAPL": "AAPL", "MSFT": "MSFT", "META": "META", "AMZN": "AMZN", "GOOGL": "GOOGL", "AVGO": "AVGO" };
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

    return () => {
      if (marketRef.current) clearInterval(marketRef.current);
      clearInterval(subInterval);
    };
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
    <div className={isDark ? "" : "light-mode"} style={{ background: isDark ? C.bg : "#f0f4ff", minHeight: "100vh", color: isDark ? C.text : "#0d0d1a", transition: "background 0.3s, color 0.3s", paddingBottom: isMobile ? 72 : 0 }}>

      {/* NAV — 모바일 최적화 */}
      <style>{`
        .nav-desktop { display: flex; }
        .nav-mobile-only { display: none; }
        @media (max-width: 767px) {
          .nav-desktop { display: none; }
          .nav-mobile-only { display: flex; }
        }
      `}</style>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#07070f", flexShrink: 0 }}>9</div>
            <span style={{ fontWeight: 800, fontSize: 15 }}>구해조</span>
            {/* 장 상태 — 데스크탑만 */}
            {marketSession.label && (
              <span className="nav-desktop" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${marketSession.color}15`, color: marketSession.color, border: `1px solid ${marketSession.color}30`, fontFamily: "monospace" }}>
                {marketSession.label}
              </span>
            )}
          </div>

          {/* 데스크탑 메뉴 */}
          <div className="nav-desktop" style={{ alignItems: "center", gap: 6 }}>
            <Link href="/news" style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📰 뉴스</Link>
            <Link href="/briefings" style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📋 브리핑</Link>
            <Link href="/chat" style={{ padding: "6px 10px", borderRadius: 8, background: `${C.green}12`, border: `1px solid ${C.green}30`, color: C.green, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>🤖 AI챗</Link>
            <Link href="/commands" style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>⌨️ 커맨드</Link>
            <Link href="/watchlist" style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>⭐ 관심종목</Link>
            <Link href="/portfolio" style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.green}40`, color: C.green, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📊 포트폴리오</Link>
            <Link href="/alerts" style={{ padding: "6px 10px", borderRadius: 8, background: `${C.amber}12`, border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>🔔 알림</Link>
            <Link href="/screener" style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>🔍 스크리너</Link>
            <NavSearch />
            <button onClick={toggleLang} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, fontFamily: "monospace", cursor: "pointer" }}>{T.langToggle}</button>
            <button onClick={toggleTheme} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, cursor: "pointer" }}>{isDark ? "☀️" : "🌙"}</button>
            <a href="#subscribe" style={{ padding: "7px 16px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>{T.subscribe}</a>
          </div>

          {/* 모바일 메뉴 — 검색 + CTA만 */}
          <div className="nav-mobile-only" style={{ alignItems: "center", gap: 8 }}>
            <NavSearch />
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "7px 14px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
              📱 텔레그램
            </a>
          </div>
        </div>
      </nav>

      {/* SCROLLING TICKER BAR */}
      {marketData && (() => {
        const fxFormat = (name: string, price: number) => {
          if (name.includes("KRW")) return "₩" + Math.round(price).toLocaleString("ko-KR");
          if (name.includes("JPY")) return "¥" + price.toFixed(2);
          return price.toFixed(4);
        };
        const tickerItems = [
          ...Object.entries(marketData.indices).map(([n, d]) => ({ label: n, price: d.price.toLocaleString(undefined, { maximumFractionDigits: 0 }), pct: d.change_pct })),
          ...Object.entries(marketData.fx).map(([n, d]) => ({ label: n, price: fxFormat(n, d.price), pct: d.change_pct })),
          ...(marketData.big_stocks ? Object.entries(marketData.big_stocks).slice(0, 6).map(([n, d]) => ({ label: n, price: "$" + (d.price as number).toFixed(2), pct: d.change_pct })) : []),
          { label: "F&G", price: String(marketData.fear_greed.score) + "pt", pct: null },
        ];
        const items = [...tickerItems, ...tickerItems];
        return (
          <div style={{ background: "#050510", borderBottom: "1px solid #111128", overflow: "hidden", height: 34, display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", animation: "marquee 60s linear infinite", whiteSpace: "nowrap" }}>
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

      {/* ===== EPISODE 5: HERO MARKET CARDS ===== */}
      <style>{`
        .hero-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 640px) { .hero-grid { grid-template-columns: repeat(4, 1fr); } }
        @keyframes heroBarPulse { 0%,100% { opacity: 0.25; } 50% { opacity: 0.75; } }
        @keyframes sessionDot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
      {marketData && (() => {
        const heroIndices = [
          { key: "S&P500", data: marketData.indices["S&P500"] },
          { key: "NASDAQ", data: marketData.indices["NASDAQ"] },
          { key: "DOW", data: marketData.indices["DOW"] },
          { key: "KOSPI", data: marketData.indices["KOSPI"] },
        ];
        const isLive = marketSession.label === "정규장 운영중" || marketSession.label === "Pre-Market" || marketSession.label === "After-Hours";
        return (
          <section style={{ background: "linear-gradient(180deg,#07070f 0%,#0d0d1a 100%)", borderBottom: `1px solid ${C.border}`, padding: "clamp(20px,3vw,40px) clamp(16px,3vw,24px) clamp(16px,2vw,28px)" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              {/* Status row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 12px", borderRadius: 20,
                  border: `1px solid ${marketSession.color}40`,
                  background: `${marketSession.color}12`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: marketSession.color, animation: isLive ? "sessionDot 1.5s ease-in-out infinite" : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: marketSession.color }}>{marketSession.label || "장 마감"}</span>
                </div>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{marketSession.nyTime}</span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginLeft: "auto" }}>30초마다 갱신</span>
              </div>
              {/* 4 index cards */}
              <div className="hero-grid">
                {heroIndices.map(({ key, data }) => {
                  if (!data) return (
                    <div key={key} style={{ borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, padding: "20px 18px", height: 110 }} />
                  );
                  const up = data.change_pct >= 0;
                  const col = up ? C.green : C.red;
                  const fmtPrice = key === "KOSPI" || key === "DOW"
                    ? data.price.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
                    : data.price.toLocaleString("en-US", { maximumFractionDigits: 0 });
                  return (
                    <div key={key} style={{
                      borderRadius: 16, background: C.card,
                      border: `1px solid ${col}30`,
                      padding: "20px 18px", position: "relative", overflow: "hidden",
                      boxShadow: `0 0 24px ${col}12`,
                    }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: col, animation: "heroBarPulse 2s ease-in-out infinite" }} />
                      {isLive && (
                        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "sessionDot 1.5s ease-in-out infinite" }} />
                          <span style={{ fontSize: 9, color: C.green, fontFamily: "monospace", letterSpacing: 1 }}>LIVE</span>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>{key}</div>
                      <div style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 900, color: C.text, fontFamily: "monospace", lineHeight: 1, marginBottom: 6 }}>{fmtPrice}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: col }}>{up ? "▲+" : "▼"}{data.change_pct.toFixed(2)}%</div>
                    </div>
                  );
                })}
              </div>
              {/* Briefing snippet */}
              {briefing.length > 0 && (
                <div id="briefing-snippet" style={{ marginTop: 16, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`, borderRadius: 16, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: C.green, fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>오늘의 브리핑</div>
                    <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {briefing[0].slice(0, 160)}{briefing[0].length > 160 ? "…" : ""}
                    </p>
                  </div>
                  <Link href="/briefings" style={{ fontSize: 12, color: C.blue, textDecoration: "none", fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${C.blue}40`, padding: "6px 14px", borderRadius: 8 }}>
                    전체 보기 →
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ===== FLOATING ACTION BUTTONS ===== */}
      <div style={{ position: "fixed", bottom: isMobile ? 80 : 24, right: 20, zIndex: 150, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => document.getElementById("briefing-snippet")?.scrollIntoView({ behavior: "smooth" })}
          style={{ padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: C.card, border: `1px solid ${C.green}40`, color: C.green, cursor: "pointer", boxShadow: `0 4px 16px ${C.green}18`, backdropFilter: "blur(8px)", whiteSpace: "nowrap" }}
        >
          📊 브리핑
        </button>
        <a
          href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
          style={{ padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: C.grad, color: "#07070f", textDecoration: "none", boxShadow: `0 4px 16px ${C.green}30`, textAlign: "center", whiteSpace: "nowrap" }}
        >
          📱 텔레그램
        </a>
      </div>

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
            <span style={{ color: C.text }}>{lang === "ko" ? "월가의 밤," : "Wall Street's Night,"}</span><br />
            <span style={{ background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{lang === "ko" ? "당신의 아침에" : "Your Morning"}</span>
          </h1>

          <p style={{ textAlign: "center", fontSize: 18, color: C.muted, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 44px" }}>
            {lang === "ko" ? (
              <>미국 증시 마감 후 Claude AI가 분석하고,<br /><strong style={{ color: C.text }}>매일 오전 8시</strong> 텔레그램으로 브리핑을 전달합니다.</>
            ) : (
              <>After US market close, Claude AI analyzes everything.<br />Delivered to Telegram every morning at <strong style={{ color: C.text }}>8AM KST</strong>.</>
            )}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 48, flexWrap: "wrap" }}>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "13px 28px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: "0 8px 32px rgba(0,217,126,0.25)" }}>
              📱 텔레그램 시작하기
            </a>
            <Link href="/chat"
              style={{ padding: "13px 20px", borderRadius: 12, background: `${C.green}12`, border: `1px solid ${C.green}30`, color: C.green, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              🤖 AI 챗 바로가기
            </Link>
            <Link href="/commands"
              style={{ padding: "13px 20px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              ⌨️ 전체 커맨드 보기
            </Link>
          </div>

          {/* 마일스톤 배지 */}
          {subCount !== null && (() => {
            const milestones = [50, 100, 200, 500, 1000, 2000, 5000];
            const achieved = milestones.filter(m => subCount >= m);
            const next = milestones.find(m => subCount < m) || milestones[milestones.length - 1];
            const prev = achieved[achieved.length - 1] || 0;
            const progress = Math.min(((subCount - prev) / (next - prev)) * 100, 100);
            const latestBadge = achieved[achieved.length - 1];
            return (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <div style={{ padding: "12px 24px", borderRadius: 16, background: `${C.green}08`, border: `1px solid ${C.green}25`, maxWidth: 400, width: "100%" }}>
                  {latestBadge && (
                    <div style={{ textAlign: "center", fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 8 }}>
                      🎉 {latestBadge}명 달성 완료!
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 6 }}>
                    <span>{prev}명</span>
                    <span style={{ color: C.green, fontWeight: 700 }}>다음 목표: {next}명</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: `${C.border}`, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, borderRadius: 3, background: C.grad, transition: "width 1s ease" }} />
                  </div>
                  <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 6 }}>
                    {next - subCount}명 더 구독하면 달성!
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 지표 */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <StatCard value={subCount !== null ? `${animatedCount}명` : "-"} label="구독자" sub="30초마다 갱신" live highlight />
            <StatCard value={adminStats?.total_watchlist_items != null ? `${adminStats.total_watchlist_items}개` : "200+"} label="관심종목 등록" sub="누적" />
            <StatCard value={adminStats?.total_price_alerts != null ? `${adminStats.total_price_alerts}개` : "0"} label="가격 알림" sub="활성" />
            <StatCard value="08:00" label="발송 시각" sub="KST 매일" />
            {nextBriefing && <StatCard value={nextBriefing} label="다음 브리핑까지" sub="실시간 카운트다운" />}
          </div>
        </div>
      </section>

      {/* 포트폴리오 퍼포먼스 배너 */}
      {portfolioSummary && (
        <Link href="/portfolio" style={{ textDecoration: "none" }}>
          <div style={{
            background: portfolioSummary.gainAmt >= 0 ? `${C.green}08` : `${C.red}08`,
            borderTop: `1px solid ${portfolioSummary.gainAmt >= 0 ? C.green + "30" : C.red + "30"}`,
            padding: "12px 24px", cursor: "pointer",
            transition: "background 0.2s",
          }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2 }}>📊 내 포트폴리오</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>
                ${portfolioSummary.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: portfolioSummary.gainAmt >= 0 ? C.green : C.red }}>
                {portfolioSummary.gainAmt >= 0 ? "+" : ""}${Math.abs(portfolioSummary.gainAmt).toFixed(0)} ({portfolioSummary.gainPct >= 0 ? "+" : ""}{portfolioSummary.gainPct.toFixed(2)}%)
              </span>
              {portfolioSummary.bestTicker && (
                <span style={{ fontSize: 11, color: C.muted }}>
                  최고 <span style={{ color: C.green, fontWeight: 700 }}>{portfolioSummary.bestTicker} +{portfolioSummary.bestPct.toFixed(1)}%</span>
                  {portfolioSummary.count > 1 && <> · 최저 <span style={{ color: C.red, fontWeight: 700 }}>{portfolioSummary.worstTicker} {portfolioSummary.worstPct.toFixed(1)}%</span></>}
                </span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>자세히 보기 →</span>
            </div>
          </div>
        </Link>
      )}

      {/* LIVE MARKET WIDGET */}
      {marketData && (
        <section id="market" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "40px 24px" }}>
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
                <FxWidget fx={marketData.fx} lastUpdated={marketLastUpdated} />
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

      {/* 내 관심종목 미니 위젯 (로컬 watchlist 있을 때만) */}
      {myStocks.length > 0 && (
        <section style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "16px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 2 }}>⭐ 내 관심종목</span>
              <Link href="/watchlist" style={{ fontSize: 11, color: C.muted, textDecoration: "none", marginLeft: "auto" }}>전체 보기 →</Link>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {myStocks.map(s => {
                const up = s.change_pct >= 0;
                return (
                  <Link key={s.ticker} href={`/stock/${s.ticker}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "8px 14px", borderRadius: 10, background: C.card,
                      border: `1px solid ${up ? C.green + "25" : C.red + "20"}`,
                      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 900, fontFamily: "monospace", color: C.text }}>{s.ticker}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: C.text }}>${s.price >= 1000 ? s.price.toLocaleString() : s.price.toFixed(2)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>{up ? "▲+" : "▼"}{s.change_pct.toFixed(2)}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* AI DAILY INSIGHT */}
      {insight && (
        <section style={{ background: "linear-gradient(135deg, #0d0d1a 0%, #111120 100%)", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "20px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
              <div>
                <div style={{ fontSize: 9, color: C.green, fontFamily: "monospace", letterSpacing: 2 }}>AI INSIGHT</div>
                <div style={{ fontSize: 9, color: C.muted }}>{insight.date}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6, margin: 0, flex: 1 }}>{insight.insight}</p>
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 16px", borderRadius: 8, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>
              더 보기
            </a>
          </div>
        </section>
      )}

      {/* SECTOR HEATMAP */}
      {/* ===== EPISODE 9: 섹터 히트맵 (업그레이드) + 빅테크 카드 ===== */}
      {marketData?.sectors && Object.values(marketData.sectors).some(v => v !== null) && (
        <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 3 }}>SECTOR HEATMAP</span>
                <span style={{ fontSize: 11, color: C.muted }}>섹터별 등락률 · 클릭하면 분석</span>
              </div>
              {/* 상승/하락 요약 */}
              {(() => {
                const valid = Object.values(marketData.sectors).filter(Boolean) as { price: number; change_pct: number }[];
                const up = valid.filter(v => v.change_pct >= 0).length;
                const dn = valid.length - up;
                return (
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>▲ {up}개 상승</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>▼ {dn}개 하락</span>
                  </div>
                );
              })()}
            </div>
            {/* 히트맵 타일 — 등락률 절댓값에 비례한 폰트 크기 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {Object.entries(marketData.sectors)
                .filter(([, d]) => d !== null)
                .sort(([, a], [, b]) => (b as { change_pct: number }).change_pct - (a as { change_pct: number }).change_pct)
                .map(([name, d]) => {
                  if (!d) return null;
                  const pct = d.change_pct;
                  const abs = Math.abs(pct);
                  const intensity = Math.min(abs / 3, 1);
                  const up = pct >= 0;
                  const bg = up
                    ? `rgba(0,217,126,${0.06 + intensity * 0.32})`
                    : `rgba(255,68,102,${0.06 + intensity * 0.32})`;
                  const borderCol = up
                    ? `rgba(0,217,126,${0.2 + intensity * 0.5})`
                    : `rgba(255,68,102,${0.2 + intensity * 0.5})`;
                  const color = up ? C.green : C.red;
                  const shortName = name.split("(")[0].trim();
                  const etfTicker = name.match(/\(([^)]+)\)/)?.[1] || "";
                  const pctFontSize = 14 + Math.min(abs * 2.5, 10); // 14~24px
                  return (
                    <Link key={name} href={etfTicker ? `/stock/${etfTicker}` : "#"} style={{ textDecoration: "none" }}>
                      <div style={{
                        padding: "16px 12px", borderRadius: 14, background: bg,
                        border: `1px solid ${borderCol}`, textAlign: "center",
                        cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                        boxShadow: intensity > 0.5 ? `0 0 20px ${color}18` : "none",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${color}30`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = intensity > 0.5 ? `0 0 20px ${color}18` : "none"; }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{shortName}</div>
                        <div style={{ fontSize: pctFontSize, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }}>
                          {up ? "+" : ""}{pct.toFixed(2)}%
                        </div>
                        {etfTicker && <div style={{ fontSize: 9, color: `${color}80`, fontFamily: "monospace", marginTop: 5 }}>{etfTicker}</div>}
                      </div>
                    </Link>
                  );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== EPISODE 10: 빅테크 실시간 카드 ===== */}
      {marketData?.big_stocks && Object.keys(marketData.big_stocks).length > 0 && (
        <section style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: C.blue, fontFamily: "monospace", letterSpacing: 3 }}>BIG TECH</span>
              <span style={{ fontSize: 11, color: C.muted }}>주요 종목 실시간</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {Object.entries(marketData.big_stocks).map(([ticker, d]) => {
                const up = d.change_pct >= 0;
                const col = up ? C.green : C.red;
                const sp = sparklines[ticker];
                return (
                  <Link key={ticker} href={`/stock/${ticker}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "16px 16px 12px", borderRadius: 14, background: C.card,
                      border: `1px solid ${col}25`, cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${col}60`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${col}18`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${col}25`; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{ticker}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{up ? "▲+" : "▼"}{d.change_pct.toFixed(2)}%</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>${d.price.toFixed(2)}</div>
                        </div>
                      </div>
                      {/* 미니 스파크라인 */}
                      {sp && sp.length >= 2 && (() => {
                        const mn = Math.min(...sp), mx = Math.max(...sp), rng = mx - mn || 1;
                        const W = 130, H = 32;
                        const pts = sp.map((p, i) => {
                          const x = (i / (sp.length - 1)) * W;
                          const y = H - ((p - mn) / rng) * (H - 4) - 2;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(" ");
                        return (
                          <svg width={W} height={H} style={{ display: "block", width: "100%" }}>
                            <polyline points={pts} fill="none" stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
                          </svg>
                        );
                      })()}
                    </div>
                  </Link>
                );
              })}
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

      {/* TOP MOVERS */}
      {movers && (
        <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "28px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 3 }}>TOP MOVERS</span>
              <span style={{ fontSize: 11, color: C.muted }}>당일 상승/하락 상위</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Gainers */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 8, letterSpacing: 1 }}>🟢 상승 TOP 5</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {movers.gainers.map((t, i) => (
                    <Link key={t.ticker} href={`/stock/${t.ticker}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.green}20`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", width: 14 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{t.ticker}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>+{t.change_pct.toFixed(2)}%</div>
                          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>${t.price.toFixed(t.price < 10 ? 3 : 2)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              {/* Losers */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 8, letterSpacing: 1 }}>🔴 하락 TOP 5</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {movers.losers.map((t, i) => (
                    <Link key={t.ticker} href={`/stock/${t.ticker}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.red}20`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", width: 14 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{t.ticker}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{t.change_pct.toFixed(2)}%</div>
                          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>${t.price.toFixed(t.price < 10 ? 3 : 2)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TODAY'S BRIEFING */}
      <section id="briefing" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "60px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>TODAY'S BRIEFING</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text }}>{T.briefingLabel}</h2>
            <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>매일 아침 8시 전송되는 실제 브리핑 내용입니다</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {briefingLoading
              ? [0,1,2,3,4].map(i => <SkeletonCard key={i} />)
              : briefing.length > 0
                ? briefing.map((t, i) => <BriefingCard key={i} text={t} index={i} />)
                : <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🌙</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>
                      오늘의 브리핑 준비 중
                    </div>
                    <p style={{ fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
                      매일 <strong style={{ color: C.text }}>오전 8시 KST</strong>에 Claude AI가<br/>
                      미국 증시 마감 분석을 정리해서 전송합니다.<br/>
                      텔레그램에서 먼저 받아보세요.
                    </p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                      <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                        style={{ padding: "12px 24px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
                        📱 텔레그램 구독하기
                      </a>
                      <Link href="/briefings"
                        style={{ padding: "12px 24px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                        📚 지난 브리핑 보기
                      </Link>
                    </div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 13 }}>{ticker}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{desc}</div>
                      </div>
                      {liveData && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>${liveData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>{up ? "+" : ""}{liveData.change_pct.toFixed(2)}%</div>
                        </div>
                      )}
                    </div>
                    {sparklines[ticker] && (
                      <div style={{ marginTop: 8, marginBottom: 4 }}>
                        <MiniSparkline prices={sparklines[ticker]} color={up ? C.green : C.red} />
                      </div>
                    )}
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: `${C.green}60`, marginTop: 4 }}>@goohaejo_bot &gt; {ticker}</div>
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

      {/* 52W EXTREMES */}
      <Week52Widget />

      {/* MARKET MOVERS */}
      <MarketMovers />

      {/* SECTOR HEATMAP */}
      <SectorHeatmap />

      {/* ECONOMIC CALENDAR */}
      <EarningsCalendar />
      <EconomicCalendar />

      {/* STOCK SEARCH WIDGET */}
      <StockSearchWidget isMobile={isMobile} />

      {/* NEWS SECTION */}
      {news.length > 0 && (() => {
        const getSentInfo = (sentiment: string) => {
          if (sentiment === "Bullish") return { emoji: "📈", label: "긍정", color: C.green, group: "positive" };
          if (sentiment === "Somewhat-Bullish") return { emoji: "📊", label: "다소긍정", color: C.green, group: "positive" };
          if (sentiment === "Bearish") return { emoji: "📉", label: "부정", color: C.red, group: "negative" };
          if (sentiment === "Somewhat-Bearish") return { emoji: "⚠️", label: "다소부정", color: C.red, group: "negative" };
          return { emoji: "😐", label: "중립", color: C.muted, group: "neutral" };
        };
        return (
          <NewsSection news={news} getSentInfo={getSentInfo} />
        );
      })()}

      {/* FEATURES */}

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
                <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: C.green, marginBottom: 8 }}>구독 완료!</h3>
                <p style={{ color: C.muted, marginBottom: 20 }}>{subMsg}</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                    style={{ padding: "12px 24px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, textDecoration: "none", fontSize: 14 }}>
                    텔레그램 열기 →
                  </a>
                  <button onClick={() => {
                    const shareText = "미국 증시 AI 브리핑 서비스 구해조! 매일 오전 8시 텔레그램으로 받아보세요 👉 https://9haejo.vercel.app";
                    if (navigator.share) {
                      navigator.share({ title: "구해조", text: shareText, url: "https://9haejo.vercel.app" });
                    } else {
                      navigator.clipboard.writeText(shareText).then(() => alert("링크가 복사되었습니다!"));
                    }
                  }} style={{ padding: "12px 24px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    친구에게 공유 📤
                  </button>
                </div>
                <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, background: "#08081a", border: `1px solid ${C.green}30` }}>
                  <p style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>👀 다음에 할 것</p>
                  <p style={{ fontSize: 13, color: C.text }}>
                    텔레그램에서 <code style={{ background: "#1a1a2e", padding: "2px 6px", borderRadius: 4, color: C.green }}>/watchlist add NVDA</code> 로 관심종목 추가하기
                  </p>
                </div>
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
                {T.footerTag}<br />
                {lang === "ko" ? "Claude AI 기반, 매일 오전 8시 KST." : "Powered by Claude AI, every 8AM KST."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>서비스</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>텔레그램 봇</a>
                  <a href="#subscribe" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>구독하기</a>
                  <a href="/briefings" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>브리핑 아카이브</a>
                  <a href="/news" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>뉴스 분석</a>
                  <a href="/compare" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>종목 비교</a>
                  <a href="/watchlist" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>관심종목</a>
                  <a href="/alerts" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>가격 알림</a>
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

      {/* 모바일 하단 탭바 */}
      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(7,7,15,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "8px 0 4px" }}>
            {[
              { icon: "📊", label: "시황", href: "#market" },
              { icon: "📋", label: "브리핑", href: "#briefing" },
              { icon: "⚖️", label: "비교", href: "/compare", isLink: true },
              { icon: "⭐", label: "관심", href: "/watchlist", isLink: true },
              { icon: "✅", label: "구독", href: "#subscribe", cta: true },
            ].map(tab => (
              <a key={tab.label} href={tab.href} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                textDecoration: "none", flex: 1, padding: "8px 4px",
                minHeight: 52,
              }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, color: (tab as {cta?: boolean}).cta ? C.green : C.muted, fontWeight: 700 }}>{tab.label}</span>
              </a>
            ))}
          </div>
        </nav>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 6px #00d97e} 50%{opacity:.4;box-shadow:none} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes needleSpin { from{transform-origin:54px 68px;transform:rotate(-90deg)} to{transform-origin:54px 68px;transform:rotate(0deg)} }
        /* Light mode overrides */
        .light-mode {
          background: #f0f4ff !important;
          color: #0d0d1a !important;
        }
        .light-mode nav {
          background: rgba(240,244,255,0.95) !important;
          border-bottom-color: #d0d4e8 !important;
        }
        .light-mode [style*="background: #07070f"],
        .light-mode [style*="background:#07070f"] {
          background: #f0f4ff !important;
        }
        .light-mode [style*="background: #0d0d1a"],
        .light-mode [style*="background:#0d0d1a"] {
          background: #e8ecf8 !important;
        }
        .light-mode [style*="background: #111120"],
        .light-mode [style*="background:#111120"] {
          background: #ffffff !important;
        }
        .light-mode [style*="color: #e8e8f0"],
        .light-mode [style*="color:#e8e8f0"] {
          color: #0d0d1a !important;
        }
        .light-mode [style*="color: #6b6b80"],
        .light-mode [style*="color:#6b6b80"] {
          color: #555570 !important;
        }
        .light-mode [style*="border: 1px solid #1a1a2e"],
        .light-mode [style*="border:1px solid #1a1a2e"] {
          border-color: #c8cce0 !important;
        }
        .light-mode code, .light-mode pre {
          background: #e0e4f5 !important;
          color: #0d0d1a !important;
        }
        .ticker-item:hover { background: rgba(255,255,255,0.05) !important; }
        @media (max-width: 768px) { body { padding-bottom: 68px; } }
      `}</style>
      <PWAInstallBanner />
      <OnboardingModal />
    </div>
  );
}
