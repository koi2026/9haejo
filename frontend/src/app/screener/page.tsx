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
  amber: "#f59e0b", purple: "#a78bfa",
};

interface Stock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
  volume?: number;
}

const SORT_OPTIONS = [
  { key: "change_pct_desc", label: "📈 상승률순" },
  { key: "change_pct_asc",  label: "📉 하락률순" },
  { key: "volume_desc",     label: "🔥 거래량순" },
  { key: "price_desc",      label: "💰 고가순" },
  { key: "price_asc",       label: "💸 저가순" },
];

function fmtVol(v?: number) {
  if (!v) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [sector, setSector] = useState("all");
  const [sort, setSort] = useState("change_pct_desc");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch_ = useCallback(async (s: string, sec: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/screener?sort=${s}&sector=${encodeURIComponent(sec)}`);
      const d = await r.json();
      if (d.stocks) {
        setStocks(d.stocks);
        setSectors(d.sectors || []);
        setLastUpdated(new Date());
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(sort, sector); }, [sort, sector, fetch_]);

  const maxAbsPct = Math.max(...stocks.map(s => Math.abs(s.change_pct)), 1);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        .stock-row:hover { background: #14142a !important; }
        .sort-btn:hover { border-color: #3b82f6 !important; color: #3b82f6 !important; }
        .sector-btn:hover { opacity: 1 !important; }
        input:focus { outline: none; border-color: #00d97e !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.97)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 11, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🔍 스크리너</span>
          </div>
          <NavSearch />
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 100px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: C.purple, fontFamily: "monospace", letterSpacing: 3, marginBottom: 6 }}>STOCK SCREENER</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>주식 스크리너</h1>
          <p style={{ fontSize: 13, color: C.muted }}>
            {stocks.length}개 종목 · 섹터 및 정렬 필터로 종목 탐색
            {lastUpdated && <span style={{ marginLeft: 8, fontFamily: "monospace" }}>{lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준</span>}
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {/* Sort */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {SORT_OPTIONS.map(opt => (
              <button key={opt.key} className="sort-btn" onClick={() => setSort(opt.key)} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: sort === opt.key ? `${C.blue}20` : "transparent",
                color: sort === opt.key ? C.blue : C.muted,
                border: `1px solid ${sort === opt.key ? C.blue : C.border}`,
                transition: "all 0.15s",
              }}>{opt.label}</button>
            ))}
          </div>
          <button onClick={() => fetch_(sort, sector)} style={{
            padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: "transparent", border: `1px solid ${C.border}`, color: C.muted,
          }}>🔄 새로고침</button>
        </div>

        {/* Sector filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {["all", ...sectors].map(s => (
            <button key={s} className="sector-btn" onClick={() => setSector(s)} style={{
              padding: "4px 12px", borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: sector === s ? `${C.purple}20` : "transparent",
              color: sector === s ? C.purple : C.muted,
              border: `1px solid ${sector === s ? C.purple : C.border}`,
              transition: "all 0.15s", opacity: 0.8,
            }}>{s === "all" ? "전체" : s}</button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: C.muted }}>⏳ 종목 데이터 로딩 중...</div>
        ) : (
          <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "60px 1fr 80px 100px 100px 80px",
              padding: "10px 18px", background: C.surface,
              borderBottom: `1px solid ${C.border}`,
              fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1,
            }}>
              <span>#</span><span>종목</span><span style={{ textAlign: "right" }}>섹터</span>
              <span style={{ textAlign: "right" }}>현재가</span>
              <span style={{ textAlign: "right" }}>등락률</span>
              <span style={{ textAlign: "right" }}>거래량</span>
            </div>

            {stocks.map((s, i) => {
              const up = s.change_pct >= 0;
              const color = up ? C.green : C.red;
              const intensity = Math.abs(s.change_pct) / maxAbsPct;
              return (
                <Link key={s.ticker} href={`/stock/${s.ticker}`} style={{ textDecoration: "none" }}>
                  <div className="stock-row" style={{
                    display: "grid", gridTemplateColumns: "60px 1fr 80px 100px 100px 80px",
                    padding: "12px 18px", background: C.card,
                    borderBottom: `1px solid ${C.border}`,
                    alignItems: "center", cursor: "pointer",
                    transition: "background 0.15s",
                    borderLeft: `3px solid ${color}${Math.round(intensity * 200).toString(16).padStart(2, "0")}`,
                  }}>
                    <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>{s.ticker}</span>
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 5,
                      background: `${C.purple}15`, color: C.purple, fontWeight: 700,
                      textAlign: "center",
                    }}>{s.sector}</span>
                    <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>
                      ${s.price >= 1000 ? s.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : s.price.toFixed(2)}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: "monospace" }}>
                        {up ? "+" : ""}{s.change_pct.toFixed(2)}%
                      </span>
                      {/* Mini bar */}
                      <div style={{ marginTop: 3, height: 2, borderRadius: 1, background: C.border, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${intensity * 100}%`, background: color }} />
                      </div>
                    </div>
                    <span style={{ textAlign: "right", fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{fmtVol(s.volume)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Info */}
        <div style={{ marginTop: 16, fontSize: 11, color: C.muted, textAlign: "center" }}>
          5분마다 자동 갱신 · 클릭하면 종목 상세 페이지로 이동
        </div>
      </div>
    </div>
  );
}
