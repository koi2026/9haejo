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

interface StockItem {
  ticker: string;
  price: number;
  change_pct: number;
  change?: number;
  name?: string;
  sparkline?: number[];
}

/* ── 미니 스파크라인 ── */
function Sparkline({ prices, color, width = 90, height = 32 }: { prices: number[]; color: string; width?: number; height?: number }) {
  if (!prices || prices.length < 2) return <div style={{ width, height }} />;
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const range = mx - mn || 1;
  const pad = 3;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p - mn) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastX = pad + (width - pad * 2);
  const lastY = height - pad - ((prices[prices.length - 1] - mn) / range) * (height - pad * 2);
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${pad},${height} ${pts} ${lastX},${height}`}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}

/* ── 종목 카드 ── */
const CHATID_KEY = "9haejo_telegram_chat_id";
const NOTES_KEY = "9haejo_stock_notes_v1";

function getNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
}
function saveNote(ticker: string, note: string) {
  const n = getNotes(); n[ticker] = note;
  localStorage.setItem(NOTES_KEY, JSON.stringify(n));
}

function NoteModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [note, setNote] = useState(() => getNotes()[ticker] || "");
  const save = () => { saveNote(ticker, note); onClose(); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#111120", borderRadius: 20, padding: "24px", width: "100%", maxWidth: 340, border: "1px solid #1a1a2e" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#e8e8f0", marginBottom: 14 }}>📝 {ticker} 메모</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="매수 이유, 목표가, 리스크 등..."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#0d0d1a", border: "1px solid #1a1a2e", color: "#e8e8f0", fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid #1a1a2e", color: "#6b6b80", fontWeight: 700, cursor: "pointer" }}>취소</button>
          <button onClick={save} style={{ flex: 2, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg,#00d97e,#3b82f6)", color: "#07070f", fontWeight: 800, border: "none", cursor: "pointer" }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function AlertModal({ ticker, price, onClose }: { ticker: string; price: number; onClose: () => void }) {
  const [target, setTarget] = useState(price.toFixed(2));
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const chatId = typeof window !== "undefined" ? localStorage.getItem(CHATID_KEY) : null;

  const submit = async () => {
    if (!chatId) {
      setStatus("err");
      setMsg("Chat ID 없음 — /alerts 페이지에서 먼저 연결하세요");
      return;
    }
    try {
      const r = await fetch(`${API}/alerts/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, target: parseFloat(target), direction }),
      });
      const d = await r.json();
      if (d.ok) { setStatus("ok"); setMsg("✅ 알림 설정 완료!"); setTimeout(onClose, 1200); }
      else { setStatus("err"); setMsg(d.error || "오류"); }
    } catch { setStatus("err"); setMsg("네트워크 오류"); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#111120", borderRadius: 20, padding: "24px", width: "100%", maxWidth: 340,
        border: "1px solid #1a1a2e", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#e8e8f0", marginBottom: 6 }}>🔔 {ticker} 알림 설정</div>
        <div style={{ fontSize: 12, color: "#6b6b80", marginBottom: 18 }}>현재가 ${price.toFixed(2)}</div>

        <select value={direction} onChange={e => setDirection(e.target.value as "above" | "below")}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#0d0d1a", border: "1px solid #1a1a2e", color: "#e8e8f0", fontSize: 13, marginBottom: 10 }}>
          <option value="above">📈 이상 도달 시 (목표가)</option>
          <option value="below">📉 이하 도달 시 (손절가)</option>
        </select>

        <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#0d0d1a", border: "1px solid #1a1a2e", color: "#e8e8f0", fontSize: 14, fontFamily: "monospace", marginBottom: 14, boxSizing: "border-box" }} />

        {msg && <div style={{ fontSize: 12, color: status === "ok" ? "#00d97e" : "#ff4466", marginBottom: 10 }}>{msg}</div>}
        {!chatId && <div style={{ fontSize: 11, color: "#6b6b80", marginBottom: 10 }}>💡 <a href="/alerts" style={{ color: "#3b82f6" }}>Chat ID를 먼저 연결</a>하세요</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid #1a1a2e", color: "#6b6b80", fontWeight: 700, cursor: "pointer" }}>취소</button>
          <button onClick={submit} style={{ flex: 2, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg,#00d97e,#3b82f6)", color: "#07070f", fontWeight: 800, border: "none", cursor: "pointer" }}>알림 설정</button>
        </div>
      </div>
    </div>
  );
}

function StockCard({ item, onRemove, showRemove }: { item: StockItem; onRemove?: () => void; showRemove?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}")[item.ticker] || ""; } catch { return ""; }
  });
  const up = item.change_pct >= 0;
  const color = up ? C.green : C.red;

  useEffect(() => {
    setPriceFlash(up ? "up" : "down");
    const t = setTimeout(() => setPriceFlash(null), 700);
    return () => clearTimeout(t);
  }, [item.price]);

  const fmtPrice = (p: number) => p >= 1000
    ? p.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : p < 1 ? p.toFixed(4)
    : p.toFixed(2);

  const change = item.change ?? null;

  return (
    <Link href={`/stock/${item.ticker}`} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "16px 18px",
          borderRadius: 16,
          background: hovered ? "#14142a" : C.card,
          border: `1px solid ${hovered ? color + "40" : C.border}`,
          cursor: "pointer",
          transition: "all 0.18s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Remove button */}
        {showRemove && onRemove && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            style={{
              position: "absolute", top: 10, right: 10,
              background: "none", border: "none", cursor: "pointer",
              color: C.muted, fontSize: 16, lineHeight: 1, padding: 4,
              opacity: hovered ? 1 : 0, transition: "opacity 0.15s",
            }}
          >×</button>
        )}

        {/* Top row: ticker + price */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: C.text, letterSpacing: 0.5 }}>{item.ticker}</div>
            {item.name && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 16, fontWeight: 900, fontFamily: "monospace",
              color: priceFlash === "up" ? C.green : priceFlash === "down" ? C.red : C.text,
              transition: "color 0.3s",
            }}>
              ${fmtPrice(item.price)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>
              {up ? "▲" : "▼"} {up ? "+" : ""}{item.change_pct.toFixed(2)}%
              {change !== null && (
                <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 4 }}>
                  ({up ? "+" : ""}{change.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sparkline + change bar */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <Sparkline prices={item.sparkline || [item.price]} color={color} width={90} height={32} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: color,
                width: `${Math.min(Math.abs(item.change_pct) / 5 * 100, 100)}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        </div>

        {/* Bottom: 분석 chip + 알림 버튼 */}
        <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 6,
            background: `${color}15`, color, fontWeight: 700,
          }}>
            {up ? "📈" : "📉"} {up ? "상승중" : "하락중"}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>AI 분석 →</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {noteText && <span style={{ fontSize: 10, color: C.muted }}>📝</span>}
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setShowNoteModal(true); }}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${C.muted}10`, color: C.muted, fontWeight: 700, border: `1px solid ${C.border}`, cursor: "pointer", opacity: hovered ? 1 : 0.4, transition: "opacity 0.15s" }}
            >메모</button>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setShowAlertModal(true); }}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${C.amber}15`, color: C.amber, fontWeight: 700, border: `1px solid ${C.amber}30`, cursor: "pointer", opacity: hovered ? 1 : 0.5, transition: "opacity 0.15s" }}
            >🔔 알림</button>
          </div>
        </div>
        {noteText && (
          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: `${C.muted}08`, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {noteText.slice(0, 80)}{noteText.length > 80 ? "…" : ""}
          </div>
        )}
      </div>
    </Link>
    {showAlertModal && <AlertModal ticker={item.ticker} price={item.price} onClose={() => setShowAlertModal(false)} />}
    {showNoteModal && <NoteModal ticker={item.ticker} onClose={() => { setNoteText(getNotes()[item.ticker] || ""); setShowNoteModal(false); }} />}
  );
}

/* ── 퍼포먼스 배너 ── */
function PerformanceBanner({ items }: { items: StockItem[] }) {
  if (!items.length) return null;
  const up = items.filter(i => i.change_pct >= 0);
  const down = items.filter(i => i.change_pct < 0);
  const avg = items.reduce((s, i) => s + i.change_pct, 0) / items.length;
  const best = [...items].sort((a, b) => b.change_pct - a.change_pct)[0];
  const worst = [...items].sort((a, b) => a.change_pct - b.change_pct)[0];

  return (
    <div style={{
      padding: "16px 20px", borderRadius: 16,
      background: avg >= 0 ? `${C.green}08` : `${C.red}08`,
      border: `1px solid ${avg >= 0 ? C.green + "25" : C.red + "25"}`,
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>관심종목 평균</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: avg >= 0 ? C.green : C.red }}>
            {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>상승</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{up.length}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>하락</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{down.length}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>전체</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{items.length}</div>
          </div>
        </div>
        {best && worst && best.ticker !== worst.ticker && (
          <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: C.muted }}>Best </span>
              <span style={{ fontFamily: "monospace", fontWeight: 800, color: C.green }}>{best.ticker}</span>
              <span style={{ color: C.green }}> +{best.change_pct.toFixed(2)}%</span>
            </div>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: C.muted }}>Worst </span>
              <span style={{ fontFamily: "monospace", fontWeight: 800, color: C.red }}>{worst.ticker}</span>
              <span style={{ color: C.red }}> {worst.change_pct.toFixed(2)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 정렬 옵션 ── */
type SortKey = "change" | "change_asc" | "alpha" | "price";

export default function WatchlistPage() {
  // ── 로컬 관심종목 ──
  const [localTickers, setLocalTickers] = useState<string[]>([]);
  const [addInput, setAddInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [localItems, setLocalItems] = useState<StockItem[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>("change");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── 텔레그램 연동 ──
  const [chatId, setChatId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [tgItems, setTgItems] = useState<StockItem[]>([]);
  const [tgFound, setTgFound] = useState<boolean | null>(null);
  const [tgLoading, setTgLoading] = useState(false);

  // ── 탭 ──
  const [tab, setTab] = useState<"local" | "telegram" | "news">("local");

  // ── 관심종목 뉴스 ──
  const [wlNews, setWlNews] = useState<{title:string;url:string;sentiment:string;tickers:string[];source?:string;summary?:string}[]>([]);
  const [wlNewsLoading, setWlNewsLoading] = useState(false);

  // ── 로컬 ticker 영속성 ──
  useEffect(() => {
    const saved = localStorage.getItem("9haejo_watchlist_v1");
    if (saved) {
      try { setLocalTickers(JSON.parse(saved)); } catch {}
    }
    const savedChatId = localStorage.getItem("watchlist_chat_id");
    if (savedChatId) { setChatId(savedChatId); setChatInput(savedChatId); }
  }, []);

  const saveLocalTickers = (tickers: string[]) => {
    setLocalTickers(tickers);
    localStorage.setItem("9haejo_watchlist_v1", JSON.stringify(tickers));
  };

  const fetchWlNews = useCallback(async (tickers: string[]) => {
    if (!tickers.length) return;
    setWlNewsLoading(true);
    try {
      const r = await fetch(`${API}/news/for-tickers?tickers=${tickers.join(",")}`);
      const d = await r.json();
      setWlNews(d.news || []);
    } catch {} finally {
      setWlNewsLoading(false);
    }
  }, []);

  // ── 로컬 시세 조회 ──
  const fetchLocalItems = useCallback(async (tickers: string[]) => {
    if (!tickers.length) { setLocalItems([]); return; }
    setLocalLoading(true);
    try {
      const results = await Promise.all(
        tickers.map(async ticker => {
          const [quoteRes, histRes] = await Promise.all([
            fetch(`${API}/stock/quote/${ticker}`).then(r => r.json()).catch(() => null),
            fetch(`${API}/stock/history/${ticker}?days=14`).then(r => r.json()).catch(() => null),
          ]);
          if (!quoteRes || quoteRes.error) return null;
          return {
            ticker,
            price: quoteRes.price ?? 0,
            change_pct: quoteRes.change_pct ?? 0,
            prev_close: quoteRes.prev_close,
            name: quoteRes.name ?? ticker,
            change: quoteRes.change,
            sparkline: histRes?.prices ?? [],
          } as StockItem;
        })
      );
      setLocalItems(results.filter(Boolean) as StockItem[]);
      setLastUpdated(new Date());
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (localTickers.length) fetchLocalItems(localTickers);
  }, [localTickers, fetchLocalItems]);

  // auto-refresh every 60s
  useEffect(() => {
    if (!localTickers.length) return;
    const id = setInterval(() => fetchLocalItems(localTickers), 60000);
    return () => clearInterval(id);
  }, [localTickers, fetchLocalItems]);

  // ── 종목 추가 ──
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = addInput.trim().toUpperCase();
    if (!ticker || localTickers.includes(ticker)) { setAddInput(""); return; }
    setAddLoading(true);
    try {
      const r = await fetch(`${API}/stock/quote/${ticker}`);
      const d = await r.json();
      if (d.error) { alert(`${ticker} 를 찾을 수 없습니다.`); return; }
      saveLocalTickers([...localTickers, ticker]);
      setAddInput("");
    } catch {
      alert("조회 실패. 티커를 확인하세요.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = (ticker: string) => {
    saveLocalTickers(localTickers.filter(t => t !== ticker));
    setLocalItems(prev => prev.filter(i => i.ticker !== ticker));
  };

  // ── 텔레그램 조회 ──
  const fetchTg = async (id: string) => {
    if (!id.trim()) return;
    setTgLoading(true);
    try {
      const r = await fetch(`${API}/watchlist/${encodeURIComponent(id.trim())}`);
      const d = await r.json();
      setTgFound(d.found);
      // enrich with sparklines
      if (d.tickers?.length) {
        const enriched = await Promise.all(
          d.tickers.map(async (item: { ticker: string; price: number; change_pct: number }) => {
            const histRes = await fetch(`${API}/stock/history/${item.ticker}?days=14`)
              .then(r => r.json()).catch(() => null);
            return { ...item, sparkline: histRes?.prices ?? [] };
          })
        );
        setTgItems(enriched);
      } else {
        setTgItems([]);
      }
    } catch {
      setTgFound(false);
    } finally {
      setTgLoading(false);
    }
  };

  const handleTgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = chatInput.trim();
    if (!id) return;
    setChatId(id);
    localStorage.setItem("watchlist_chat_id", id);
    fetchTg(id);
  };

  useEffect(() => {
    if (chatId) fetchTg(chatId);
  }, [chatId]);

  // ── 정렬 ──
  const sorted = (items: StockItem[]) => {
    const copy = [...items];
    if (sort === "change") return copy.sort((a, b) => b.change_pct - a.change_pct);
    if (sort === "change_asc") return copy.sort((a, b) => a.change_pct - b.change_pct);
    if (sort === "alpha") return copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
    if (sort === "price") return copy.sort((a, b) => b.price - a.price);
    return copy;
  };

  const currentItems = tab === "local" ? sorted(localItems) : sorted(tgItems);

  const POPULAR = ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL", "AMD"];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 100 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .wl-tab { transition: all 0.15s ease; cursor: pointer; }
        .wl-tab:hover { color: #e8e8f0 !important; }
        .wl-sort { transition: all 0.15s ease; cursor: pointer; }
        .wl-sort:hover { background: #1a1a2e !important; }
        input:focus { border-color: #00d97e !important; outline: none; box-shadow: 0 0 0 3px #00d97e18; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.97)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 11, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, color: C.muted }}>관심종목</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <NavSearch />
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "7px 14px", borderRadius: 9, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 12, textDecoration: "none" }}>
              📱 봇
            </a>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 6 }}>WATCHLIST</p>
          <h1 style={{ fontSize: "clamp(24px,5vw,36px)", fontWeight: 900, color: C.text, marginBottom: 6 }}>⭐ 관심종목</h1>
          <p style={{ fontSize: 14, color: C.muted }}>실시간 시세 · 7일 차트 · AI 분석 바로가기</p>
        </div>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: C.surface, borderRadius: 12, padding: 4, width: "fit-content", border: `1px solid ${C.border}` }}>
          {([["local", "⭐ 내 관심종목"], ["news", "📰 관련 뉴스"], ["telegram", "📱 텔레그램 연동"]] as [typeof tab, string][]).map(([key, label]) => (
            <button key={key} className="wl-tab" onClick={() => { setTab(key); if (key === "news") fetchWlNews(localTickers); }}
              style={{
                padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                background: tab === key ? C.card : "transparent",
                color: tab === key ? C.text : C.muted,
                fontWeight: tab === key ? 800 : 500,
                fontSize: 13,
                boxShadow: tab === key ? `0 0 0 1px ${C.border}` : "none",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 로컬 탭 ── */}
        {tab === "local" && (
          <>
            {/* 종목 추가 */}
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input
                value={addInput}
                onChange={e => setAddInput(e.target.value.toUpperCase())}
                placeholder="티커 입력 (예: NVDA, AAPL...)"
                style={{
                  flex: 1, minWidth: 200, padding: "11px 16px", borderRadius: 11,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 14, fontFamily: "monospace",
                  transition: "border-color 0.15s",
                }}
              />
              <button type="submit" disabled={addLoading || !addInput.trim()}
                style={{
                  padding: "11px 24px", borderRadius: 11, background: C.grad, color: "#07070f",
                  fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer",
                  opacity: addLoading || !addInput.trim() ? 0.6 : 1,
                }}>
                {addLoading ? "확인 중..." : "+ 추가"}
              </button>
            </form>

            {/* 인기 종목 빠른 추가 */}
            {!localTickers.length && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>💡 빠른 추가</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {POPULAR.map(t => (
                    <button key={t} onClick={() => { setAddInput(t); }}
                      style={{
                        padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
                        background: C.card, color: C.text, cursor: "pointer", fontSize: 12,
                        fontFamily: "monospace", fontWeight: 700, transition: "all 0.1s",
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 로딩 */}
            {localLoading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${C.border}`, borderTop: `3px solid ${C.green}`, animation: "spin 0.8s linear infinite" }} />
              </div>
            )}

            {/* 퍼포먼스 배너 */}
            {!localLoading && localItems.length > 0 && (
              <>
                <PerformanceBanner items={localItems} />

                {/* 정렬 + 업데이트 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {([["change", "등락 높은순"], ["change_asc", "등락 낮은순"], ["alpha", "이름순"], ["price", "가격순"]] as [SortKey, string][]).map(([key, label]) => (
                      <button key={key} className="wl-sort" onClick={() => setSort(key)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, border: `1px solid ${sort === key ? C.green + "50" : C.border}`,
                          background: sort === key ? `${C.green}12` : "transparent",
                          color: sort === key ? C.green : C.muted,
                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {lastUpdated && (
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                      {lastUpdated.toLocaleTimeString("ko-KR")} 업데이트
                    </span>
                  )}
                </div>

                {/* 카드 그리드 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
                  {currentItems.map(item => (
                    <StockCard key={item.ticker} item={item} onRemove={() => handleRemove(item.ticker)} showRemove />
                  ))}
                </div>
              </>
            )}

            {/* 빈 상태 */}
            {!localLoading && !localItems.length && localTickers.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>⭐</div>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>관심종목이 없습니다</p>
                <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>위에서 티커를 입력해 추가하거나 인기 종목을 클릭하세요</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {POPULAR.map(t => (
                    <button key={t} onClick={() => { setAddInput(t); }}
                      style={{
                        padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
                        background: C.card, color: C.text, cursor: "pointer", fontSize: 14,
                        fontFamily: "monospace", fontWeight: 800,
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 뉴스 탭 ── */}
        {tab === "news" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2 }}>관심종목 관련 뉴스</span>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {localTickers.length > 0 ? `${localTickers.join(", ")} 관련 뉴스` : "관심종목을 먼저 추가하세요"}
                </div>
              </div>
              <button onClick={() => fetchWlNews(localTickers)} style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🔄 새로고침</button>
            </div>

            {wlNewsLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>📰 뉴스 불러오는 중...</div>
            ) : localTickers.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
                <div style={{ fontSize: 14, color: C.muted }}>관심종목을 먼저 추가하면<br />관련 뉴스를 여기서 모아볼 수 있어요</div>
              </div>
            ) : wlNews.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, color: C.muted }}>현재 관심종목 관련 뉴스가 없습니다</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {wlNews.map((n, i) => {
                  const sentColor = n.sentiment === "Bullish" || n.sentiment === "Somewhat-Bullish" ? C.green
                    : n.sentiment === "Bearish" || n.sentiment === "Somewhat-Bearish" ? C.red : C.muted;
                  const sentLabel = n.sentiment?.includes("Bullish") ? "긍정" : n.sentiment?.includes("Bearish") ? "부정" : "중립";
                  return (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{
                        padding: "14px 16px", borderRadius: 14, background: C.card,
                        border: `1px solid ${C.border}`,
                        transition: "border-color 0.15s",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = sentColor + "60")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: sentColor + "18", color: sentColor, fontWeight: 700 }}>{sentLabel}</span>
                          {(n.tickers || []).filter(t => localTickers.includes(t)).map(t => (
                            <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: `${C.blue}15`, color: C.blue, fontWeight: 700 }}>{t}</span>
                          ))}
                          {n.source && <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>{n.source}</span>}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.5, marginBottom: n.summary ? 6 : 0 }}>{n.title}</div>
                        {n.summary && <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{n.summary.slice(0, 120)}{n.summary.length > 120 ? "…" : ""}</div>}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 텔레그램 탭 ── */}
        {tab === "telegram" && (
          <>
            <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 700, marginBottom: 8 }}>📱 텔레그램 Chat ID 연동</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
                <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>@goohaejo_bot</a> 에서{" "}
                <code style={{ background: C.surface, padding: "1px 6px", borderRadius: 4, color: C.green }}>/내통계</code> 입력 후 나오는 Chat ID를 여기 입력하세요.
                텔레그램 봇에 등록한 관심종목을 웹에서 실시간으로 확인할 수 있습니다.
              </div>
              <form onSubmit={handleTgSubmit} style={{ display: "flex", gap: 10 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Chat ID (예: 1234567890)"
                  style={{
                    flex: 1, padding: "11px 16px", borderRadius: 11,
                    background: C.surface, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 14, fontFamily: "monospace",
                  }}
                />
                <button type="submit" disabled={tgLoading}
                  style={{ padding: "11px 24px", borderRadius: 11, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}>
                  {tgLoading ? "조회 중..." : "조회"}
                </button>
              </form>
            </div>

            {tgLoading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${C.border}`, borderTop: `3px solid ${C.green}`, animation: "spin 0.8s linear infinite" }} />
              </div>
            )}

            {!tgLoading && tgFound === false && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <p style={{ fontSize: 16, color: C.muted }}>관심종목이 없거나 올바르지 않은 Chat ID입니다.</p>
                <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 16, padding: "12px 28px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
                  봇에서 추가하기
                </a>
              </div>
            )}

            {!tgLoading && tgFound && tgItems.length > 0 && (
              <>
                <PerformanceBanner items={tgItems} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {([["change", "등락 높은순"], ["change_asc", "등락 낮은순"], ["alpha", "이름순"], ["price", "가격순"]] as [SortKey, string][]).map(([key, label]) => (
                      <button key={key} className="wl-sort" onClick={() => setSort(key)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, border: `1px solid ${sort === key ? C.green + "50" : C.border}`,
                          background: sort === key ? `${C.green}12` : "transparent",
                          color: sort === key ? C.green : C.muted,
                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: C.muted }}>텔레그램 봇 데이터</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
                  {sorted(tgItems).map(item => (
                    <StockCard key={item.ticker} item={item} />
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: C.muted }}>봇에서 관심종목 관리:</span>
                  <code style={{ fontSize: 12, color: C.green, background: C.card, padding: "3px 8px", borderRadius: 6 }}>/watchlist add NVDA</code>
                  <code style={{ fontSize: 12, color: C.red, background: C.card, padding: "3px 8px", borderRadius: 6 }}>/watchlist remove NVDA</code>
                </div>
              </>
            )}

            {!tgLoading && !chatId && tgFound === null && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📱</div>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>텔레그램 봇과 연동하세요</p>
                <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>봇에서 추가한 관심종목을 웹에서 실시간으로 확인할 수 있습니다</p>
                <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", padding: "14px 32px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
                  @goohaejo_bot 시작하기
                </a>
              </div>
            )}
          </>
        )}

        {/* 하단 링크 */}
        <div style={{ marginTop: 40, padding: "20px 24px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>더 많은 기능</span>
          <Link href="/portfolio" style={{ padding: "8px 18px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>📊 포트폴리오</Link>
          <Link href="/compare" style={{ padding: "8px 18px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>⚖️ 종목 비교</Link>
          <Link href="/commands" style={{ padding: "8px 18px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>⌨️ 커맨드</Link>
        </div>
      </div>
    </div>
  );
}
