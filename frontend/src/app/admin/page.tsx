"use client";
import { useState, useEffect, useCallback } from "react";
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
  gold: "#f59e0b",
  text: "#e8e8f0",
  muted: "#6b6b80",
};

interface Stats {
  subscribers: number;
  total_price_alerts: number;
  users_with_alerts: number;
  total_watchlist_items: number;
  users_with_watchlist: number;
  last_briefing_date: string | null;
  next_briefing_utc: string;
  scheduler_running: boolean;
  cache: {
    quote: CacheStats;
    news: CacheStats;
    analysis: CacheStats;
  };
}

interface CacheStats {
  size: number;
  max_size: number;
  hits: number;
  misses: number;
  hit_rate_pct: number;
  ttl_default: number;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: color || C.text, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CacheBar({ name, stats }: { name: string; stats: CacheStats }) {
  const fillPct = Math.round((stats.size / stats.max_size) * 100);
  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: C.text }}>{name}</span>
        <span style={{ fontSize: 12, color: C.muted }}>{stats.size}/{stats.max_size} entries · TTL {stats.ttl_default}s</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${fillPct}%`, background: fillPct > 80 ? C.gold : C.green, borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: C.muted }}>
        <span>히트율 <b style={{ color: stats.hit_rate_pct > 50 ? C.green : C.muted }}>{stats.hit_rate_pct.toFixed(1)}%</b></span>
        <span>히트 {stats.hits}</span>
        <span>미스 {stats.misses}</span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trending, setTrending] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [marketSnap, setMarketSnap] = useState<Record<string, { price: number; change_pct: number }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rStats, rTrend, rMarket] = await Promise.all([
        fetch(`${API}/admin/stats`),
        fetch(`${API}/market/trending-searches`),
        fetch(`${API}/market/live`),
      ]);
      const [dStats, dTrend, dMarket] = await Promise.all([rStats.json(), rTrend.json(), rMarket.json()]);
      setStats(dStats);
      setTrending(dTrend.tickers || []);
      const snap: Record<string, { price: number; change_pct: number }> = {};
      for (const [k, v] of Object.entries(dMarket.indices || {})) {
        if (v && typeof v === "object") snap[k] = v as { price: number; change_pct: number };
      }
      setMarketSnap(snap);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const nextBriefingKST = stats?.next_briefing_utc
    ? new Date(stats.next_briefing_utc).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })
    : "--";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00d97e,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: C.bg }}>9</div>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>구해조</span>
          </Link>
          <span style={{ color: C.muted, fontSize: 13 }}>/ Admin Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
              {lastRefresh.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 기준
            </span>
          )}
          <button onClick={load} disabled={loading} style={{ padding: "6px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, cursor: "pointer" }}>
            {loading ? "⟳" : "🔄 새로고침"}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>📊 운영 대시보드</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: stats?.scheduler_running ? C.green : C.red, boxShadow: stats?.scheduler_running ? `0 0 8px ${C.green}` : "none" }} />
            <span style={{ fontSize: 12, color: stats?.scheduler_running ? C.green : C.red, fontFamily: "monospace" }}>
              스케줄러 {stats?.scheduler_running ? "실행 중" : "중단"}
            </span>
          </div>
        </div>

        {/* 주요 지표 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginBottom: 28 }}>
          <StatCard label="SUBSCRIBERS" value={stats?.subscribers ?? "—"} sub="텔레그램 구독자" color={C.green} />
          <StatCard label="PRICE ALERTS" value={stats?.total_price_alerts ?? "—"} sub={`${stats?.users_with_alerts ?? 0}명 활성`} color={C.gold} />
          <StatCard label="WATCHLIST" value={stats?.total_watchlist_items ?? "—"} sub={`${stats?.users_with_watchlist ?? 0}명 사용`} color={C.blue} />
          <StatCard label="LAST BRIEFING" value={stats?.last_briefing_date ?? "없음"} sub={`다음: KST ${nextBriefingKST}`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
          {/* 시장 스냅샷 */}
          <div style={{ background: C.card, borderRadius: 16, padding: "20px 24px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 }}>MARKET SNAPSHOT</div>
            {Object.entries(marketSnap).map(([name, q]) => {
              const up = q.change_pct >= 0;
              return (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{name}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: C.text }}>{q.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                    <span style={{ fontSize: 12, color: up ? C.green : C.red, marginLeft: 8 }}>{up ? "+" : ""}{q.change_pct.toFixed(2)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 인기 검색 종목 */}
          <div style={{ background: C.card, borderRadius: 16, padding: "20px 24px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 }}>TRENDING SEARCHES</div>
            {trending.length > 0 ? trending.map((t, i) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.muted, fontFamily: "monospace", width: 24 }}>{i + 1}</span>
                <Link href={`/stock/${t}`} style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: C.blue, textDecoration: "none" }}>{t}</Link>
              </div>
            )) : (
              <div style={{ color: C.muted, fontSize: 13, padding: "20px 0" }}>검색 데이터 없음 (Railway 재시작 후 누적)</div>
            )}
          </div>
        </div>

        {/* 캐시 현황 */}
        {stats?.cache && (
          <div style={{ background: C.card, borderRadius: 16, padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>CACHE STATUS</div>
            <CacheBar name="quote (TTL 60s)" stats={stats.cache.quote} />
            <CacheBar name="news (TTL 300s)" stats={stats.cache.news} />
            <CacheBar name="analysis (TTL 600s)" stats={stats.cache.analysis} />
          </div>
        )}

        {/* 빠른 링크 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "📋 브리핑 아카이브", href: "/briefings" },
            { label: "📰 뉴스 피드", href: "/news" },
            { label: "⚖️ 종목 비교", href: "/compare" },
            { label: "🤖 Railway 로그", href: "https://railway.app", ext: true },
            { label: "☁️ Vercel 대시보드", href: "https://vercel.com", ext: true },
          ].map(l => (
            <Link key={l.label} href={l.href} target={l.ext ? "_blank" : undefined}
              style={{ padding: "10px 18px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
