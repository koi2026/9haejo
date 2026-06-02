"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const C = {
  bg: "#07070f", card: "#111120", border: "#1a1a2e",
  text: "#e8e8f0", muted: "#6b6b80", blue: "#3b82f6", green: "#00d97e",
};

const QUICK_LIST = [
  { ticker: "NVDA", name: "NVIDIA", sector: "반도체" },
  { ticker: "TSLA", name: "Tesla", sector: "전기차" },
  { ticker: "AAPL", name: "Apple", sector: "기술" },
  { ticker: "MSFT", name: "Microsoft", sector: "기술" },
  { ticker: "AMZN", name: "Amazon", sector: "이커머스" },
  { ticker: "META", name: "Meta", sector: "소셜" },
  { ticker: "GOOGL", name: "Alphabet", sector: "기술" },
  { ticker: "AVGO", name: "Broadcom", sector: "반도체" },
  { ticker: "AMD", name: "AMD", sector: "반도체" },
  { ticker: "PLTR", name: "Palantir", sector: "AI" },
  { ticker: "NFLX", name: "Netflix", sector: "스트리밍" },
  { ticker: "CRM", name: "Salesforce", sector: "SaaS" },
  { ticker: "ORCL", name: "Oracle", sector: "기술" },
  { ticker: "INTC", name: "Intel", sector: "반도체" },
  { ticker: "JPM", name: "JPMorgan", sector: "금융" },
  { ticker: "LLY", name: "Eli Lilly", sector: "바이오" },
  { ticker: "SPY", name: "S&P500 ETF", sector: "ETF" },
  { ticker: "QQQ", name: "NASDAQ ETF", sector: "ETF" },
  { ticker: "BTC-USD", name: "Bitcoin", sector: "크립토" },
  { ticker: "COIN", name: "Coinbase", sector: "크립토" },
  { ticker: "SOFI", name: "SoFi", sector: "핀테크" },
  { ticker: "RIVN", name: "Rivian", sector: "전기차" },
  { ticker: "SHOP", name: "Shopify", sector: "이커머스" },
  { ticker: "SNOW", name: "Snowflake", sector: "클라우드" },
  { ticker: "MSTR", name: "MicroStrategy", sector: "크립토" },
];

export default function NavSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length >= 1
    ? QUICK_LIST.filter(s =>
        s.ticker.startsWith(query.toUpperCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : QUICK_LIST.slice(0, 6);

  const go = (ticker: string) => {
    router.push(`/stock/${ticker}`);
    setQuery("");
    setOpen(false);
    setShow(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      go(query.trim().toUpperCase());
    }
    if (e.key === "Escape") {
      setOpen(false);
      setShow(false);
    }
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setShow(true);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShow(false);
        setTimeout(() => setOpen(false), 150);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 10,
            background: C.card, border: `1px solid ${C.border}`,
            color: C.muted, fontSize: 13, cursor: "pointer",
            fontFamily: "monospace", transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = C.blue + "60";
            (e.currentTarget as HTMLButtonElement).style.color = C.text;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
            (e.currentTarget as HTMLButtonElement).style.color = C.muted;
          }}
        >
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ display: "none", /* hidden on very small */ }}>종목 검색</span>
          <span style={{ fontSize: 10, color: "#333355", background: "#1a1a2e", padding: "1px 5px", borderRadius: 4 }}>
            NVDA...
          </span>
        </button>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            onFocus={() => setShow(true)}
            placeholder="NVDA, TSLA..."
            autoComplete="off"
            style={{
              width: 180, padding: "8px 14px", borderRadius: 10,
              background: C.card, border: `1px solid ${C.blue}60`,
              color: C.text, fontSize: 13, fontFamily: "monospace",
              fontWeight: 700, outline: "none",
              opacity: show ? 1 : 0, transition: "opacity 0.15s",
            }}
          />
          {/* Dropdown */}
          {show && filtered.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              width: 220, background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, overflow: "hidden", zIndex: 200,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}>
              {query.length === 0 && (
                <div style={{ padding: "8px 14px", fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: 2, borderBottom: `1px solid ${C.border}` }}>
                  인기 종목
                </div>
              )}
              {filtered.map(s => (
                <button key={s.ticker}
                  onMouseDown={() => go(s.ticker)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "9px 14px",
                    background: "transparent", border: "none",
                    borderBottom: `1px solid ${C.border}`,
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${C.blue}10`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{s.ticker}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${C.blue}18`, color: C.blue }}>
                    {s.sector}
                  </span>
                </button>
              ))}
              {query.trim().length >= 2 && (
                <button
                  onMouseDown={() => go(query.trim())}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "10px 14px",
                    background: `${C.green}08`, border: "none",
                    cursor: "pointer", color: C.green, fontSize: 12, fontWeight: 700,
                  }}
                >
                  <span>↗</span> {query.trim()} 바로 조회
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
