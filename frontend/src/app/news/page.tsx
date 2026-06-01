"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

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
  gold: "#f59e0b",
};

interface NewsItem {
  title: string;
  url: string;
  tickers: string[];
  sentiment: "Bullish" | "Bearish" | "Neutral";
  sentiment_score: number;
  published_at?: string;
  source?: string;
  summary?: string;
}

type FilterType = "all" | "Bullish" | "Bearish";

function SentimentBadge({ s, score }: { s: string; score: number }) {
  const cfg =
    s === "Bullish"
      ? { color: C.green, bg: `${C.green}15`, border: `${C.green}40`, icon: "🟢" }
      : s === "Bearish"
      ? { color: C.red, bg: `${C.red}15`, border: `${C.red}40`, icon: "🔴" }
      : { color: C.muted, bg: `${C.muted}10`, border: `${C.muted}30`, icon: "🟡" };
  const label = s === "Bullish" ? "호재" : s === "Bearish" ? "악재" : "중립";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontSize: 11, fontWeight: 700,
    }}>
      {cfg.icon} {label} {score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}
    </span>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const tickers = (item.tickers || []).slice(0, 3);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{
        background: C.card, borderRadius: 14, padding: "18px 20px",
        border: `1px solid ${item.sentiment === "Bullish" ? `${C.green}25` : item.sentiment === "Bearish" ? `${C.red}20` : C.border}`,
        transition: "border-color 0.2s",
        cursor: "pointer",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <SentimentBadge s={item.sentiment} score={item.sentiment_score} />
          {tickers.map(t => (
            <Link key={t} href={`/stock/${t}`} onClick={e => e.stopPropagation()} style={{
              padding: "2px 8px", borderRadius: 6,
              background: `${C.blue}15`, border: `1px solid ${C.blue}30`,
              color: C.blue, fontSize: 11, fontWeight: 700, textDecoration: "none",
            }}>
              {t}
            </Link>
          ))}
          {item.source && (
            <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>{item.source}</span>
          )}
        </div>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, lineHeight: 1.5, margin: 0, marginBottom: item.summary ? 8 : 0 }}>
          {item.title}
        </h3>
        {item.summary && (
          <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            {item.summary}
          </p>
        )}
      </div>
    </a>
  );
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    fetch(`${API}/news/latest`)
      .then(r => r.json())
      .then(d => {
        const items: NewsItem[] = (d.news || d.items || []).map((n: {
          title?: string;
          url?: string;
          tickers?: string[];
          sentiment?: string;
          sentiment_score?: number;
          time_published?: string;
          source?: string;
          summary?: string;
        }) => ({
          title: n.title || "",
          url: n.url || "#",
          tickers: n.tickers || [],
          sentiment: (n.sentiment as "Bullish" | "Bearish" | "Neutral") || "Neutral",
          sentiment_score: n.sentiment_score || 0,
          published_at: n.time_published,
          source: n.source,
          summary: n.summary,
        }));
        setNews(items);
        setLoading(false);

        // AI summary
        setAiLoading(true);
        fetch(`${API}/news/ai-summary`)
          .then(r => r.json())
          .then(d => setAiSummary(d.summary || d.result || ""))
          .catch(() => {})
          .finally(() => setAiLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = news
    .filter(n => filter === "all" || n.sentiment === filter)
    .filter(n => !searchQ || n.title.toLowerCase().includes(searchQ.toLowerCase()) || n.tickers.some(t => t.toLowerCase().includes(searchQ.toLowerCase())));

  const bullishCount = news.filter(n => n.sentiment === "Bullish").length;
  const bearishCount = news.filter(n => n.sentiment === "Bearish").length;
  const neutralCount = news.filter(n => n.sentiment === "Neutral").length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00d97e,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: C.bg }}>9</div>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>구해조</span>
          </Link>
          <span style={{ color: C.muted, fontSize: 13 }}>/ 뉴스</span>
        </div>
        <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg,#00d97e,#3b82f6)", color: C.bg, fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
          🤖 텔레그램 봇
        </a>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>📰 월가 AI 뉴스</h1>
          <p style={{ color: C.muted, fontSize: 14 }}>Alpha Vantage + Claude AI가 분석한 실시간 미국 증시 뉴스</p>
        </div>

        {/* AI summary card */}
        {(aiLoading || aiSummary) && (
          <div style={{ background: C.surface, borderRadius: 16, padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🤖</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>AI 오늘의 뉴스 요약</span>
              {aiLoading && <span style={{ fontSize: 11, color: C.muted }}>분석 중...</span>}
            </div>
            {aiLoading ? (
              <div style={{ color: C.muted, fontSize: 13 }}>Claude AI가 뉴스를 분석하고 있습니다...</div>
            ) : (
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiSummary}</div>
            )}
          </div>
        )}

        {/* Stats bar */}
        {!loading && news.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ padding: "8px 16px", borderRadius: 10, background: `${C.green}15`, border: `1px solid ${C.green}30`, color: C.green, fontSize: 13, fontWeight: 700 }}>
              🟢 호재 {bullishCount}건
            </div>
            <div style={{ padding: "8px 16px", borderRadius: 10, background: `${C.red}15`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13, fontWeight: 700 }}>
              🔴 악재 {bearishCount}건
            </div>
            <div style={{ padding: "8px 16px", borderRadius: 10, background: `${C.muted}10`, border: `1px solid ${C.muted}30`, color: C.muted, fontSize: 13, fontWeight: 700 }}>
              🟡 중립 {neutralCount}건
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11, color: C.muted, alignSelf: "center" }}>
              전체 {news.length}건
            </div>
          </div>
        )}

        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="종목명 또는 키워드 검색..."
            style={{ flex: 1, minWidth: 180, background: C.card, border: `1px solid ${searchQ ? C.green : C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none" }}
          />
          {(["all", "Bullish", "Bearish"] as const).map(f => {
            const labels = { all: "전체", Bullish: "🟢 호재", Bearish: "🔴 악재" };
            const active = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "10px 16px", borderRadius: 10,
                background: active ? (f === "Bullish" ? `${C.green}20` : f === "Bearish" ? `${C.red}20` : `${C.blue}20`) : C.card,
                border: `1px solid ${active ? (f === "Bullish" ? C.green : f === "Bearish" ? C.red : C.blue) : C.border}`,
                color: active ? (f === "Bullish" ? C.green : f === "Bearish" ? C.red : C.blue) : C.muted,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                {labels[f]}
              </button>
            );
          })}
        </div>

        {/* News list */}
        {loading ? (
          <div style={{ display: "grid", gap: 12 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ background: C.card, borderRadius: 14, padding: "20px", border: `1px solid ${C.border}`, height: 100, opacity: 0.5 }} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((item, i) => <NewsCard key={i} item={item} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 60, color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>해당 조건의 뉴스가 없어요.</div>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 48, padding: "32px 24px", background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>텔레그램에서 실시간으로</h3>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
            @goohaejo_bot 에서 /뉴스 NVDA 입력하면 AI 뉴스 분석을 즉시 받아볼 수 있어요
          </p>
          <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ padding: "12px 28px", borderRadius: 12, background: "linear-gradient(135deg,#00d97e,#3b82f6)", color: C.bg, fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-block" }}>
            텔레그램 봇 열기
          </a>
        </div>
      </div>
    </div>
  );
}
