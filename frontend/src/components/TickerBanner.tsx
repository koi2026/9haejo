"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

const TICKERS = [
  "NVDA","AAPL","MSFT","TSLA","AMZN","META","GOOGL","AVGO",
  "AMD","PLTR","NFLX","COIN","JPM","V","BTC-USD","ETH-USD",
];

interface TickData {
  ticker: string;
  price: number;
  change_pct: number;
}

export default function TickerBanner() {
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTicks = async () => {
    try {
      // Use market/live endpoint for indices + big stocks, supplement with movers
      const [liveR, moversR] = await Promise.all([
        fetch(`${API}/market/live`).then(r => r.json()),
        fetch(`${API}/market/movers`).then(r => r.json()),
      ]);

      const map: Record<string, TickData> = {};

      // Indices
      const indexNames: Record<string, string> = {
        "S&P 500": "SPX", "NASDAQ": "NDX", "DOW": "DJI", "KOSPI": "KOSPI",
      };
      for (const [name, d] of Object.entries(liveR.indices || {})) {
        const sym = indexNames[name] || name;
        map[sym] = { ticker: sym, price: (d as any).price, change_pct: (d as any).change_pct };
      }

      // Big stocks from live
      for (const [sym, d] of Object.entries(liveR.big_stocks || {})) {
        if (d) map[sym] = { ticker: sym, price: (d as any).price, change_pct: (d as any).change_pct };
      }

      // Movers
      for (const s of [...(moversR.gainers || []), ...(moversR.losers || [])]) {
        map[s.ticker] = { ticker: s.ticker, price: s.price, change_pct: s.change_pct };
      }

      const result = Object.values(map).filter(t => t.price > 0);
      if (result.length > 0) { setTicks(result); setLoaded(true); }
    } catch {}
  };

  useEffect(() => {
    fetchTicks();
    intervalRef.current = setInterval(fetchTicks, 60000); // refresh every 60s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (!loaded || ticks.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...ticks, ...ticks];

  return (
    <div style={{
      background: "#08080f",
      borderBottom: "1px solid #1a1a2e",
      overflow: "hidden",
      height: 32,
      display: "flex",
      alignItems: "center",
      position: "relative",
    }}>
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          align-items: center;
          animation: tickerScroll ${Math.max(30, ticks.length * 4)}s linear infinite;
          white-space: nowrap;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Left gradient fade */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 40, zIndex: 2,
        background: "linear-gradient(to right, #08080f, transparent)",
        pointerEvents: "none",
      }} />

      <div className="ticker-track">
        {items.map((t, i) => {
          const up = t.change_pct >= 0;
          const color = up ? "#00d97e" : "#ff4466";
          return (
            <Link
              key={`${t.ticker}-${i}`}
              href={t.ticker.includes("-") || ["SPX","NDX","DJI","KOSPI"].includes(t.ticker) ? "/" : `/stock/${t.ticker}`}
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRight: "1px solid #1a1a2e" }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: "#9ca3b0", fontFamily: "monospace", letterSpacing: 0.5 }}>
                {t.ticker}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#e8e8f0", fontFamily: "monospace" }}>
                {t.price >= 1000
                  ? t.price.toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : t.price.toFixed(2)}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color }}>
                {up ? "▲" : "▼"}{Math.abs(t.change_pct).toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right gradient fade */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 40, zIndex: 2,
        background: "linear-gradient(to left, #08080f, transparent)",
        pointerEvents: "none",
      }} />
    </div>
  );
}
