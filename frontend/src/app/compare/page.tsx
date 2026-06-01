"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

interface StockData {
  ticker: string;
  price: number;
  change_pct: number;
  name?: string;
  sector?: string;
  market_cap?: number;
  pe?: number;
  volume?: number;
  week52_high?: number;
  week52_low?: number;
  avg_volume?: number;
  dividend_yield?: number;
}

function fmt(v: number | undefined | null, prefix = "", suffix = "", decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  if (Math.abs(v) >= 1e12) return prefix + (v / 1e12).toFixed(1) + "T" + suffix;
  if (Math.abs(v) >= 1e9) return prefix + (v / 1e9).toFixed(1) + "B" + suffix;
  if (Math.abs(v) >= 1e6) return prefix + (v / 1e6).toFixed(1) + "M" + suffix;
  return prefix + v.toFixed(decimals) + suffix;
}

function WinnerBadge({ label }: { label: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 20,
      background: `${C.gold}20`, border: `1px solid ${C.gold}60`,
      color: C.gold, fontSize: 11, fontWeight: 700,
    }}>
      👑 {label}
    </div>
  );
}

function CompareRow({
  label, v1, v2, higher = "a", format,
}: {
  label: string;
  v1: number | undefined | null;
  v2: number | undefined | null;
  higher?: "a" | "b" | "none";
  format?: (v: number) => string;
}) {
  const fmtFn = format || ((v: number) => v.toFixed(2));
  const valid1 = v1 != null && !isNaN(v1);
  const valid2 = v2 != null && !isNaN(v2);
  const win1 = valid1 && valid2 && (higher === "a" ? v1 > v2 : higher === "b" ? v1 < v2 : false);
  const win2 = valid1 && valid2 && (higher === "a" ? v2 > v1 : higher === "b" ? v2 < v1 : false);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 120px 1fr",
      alignItems: "center", padding: "12px 16px",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        textAlign: "right",
        color: win1 ? C.text : C.muted,
        fontWeight: win1 ? 800 : 400,
        fontSize: 14,
        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8,
      }}>
        {win1 && <span style={{ color: C.gold, fontSize: 12 }}>▶</span>}
        {valid1 ? fmtFn(v1!) : "—"}
      </div>
      <div style={{ textAlign: "center", color: C.muted, fontSize: 11, padding: "0 8px" }}>{label}</div>
      <div style={{
        textAlign: "left",
        color: win2 ? C.text : C.muted,
        fontWeight: win2 ? 800 : 400,
        fontSize: 14,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {valid2 ? fmtFn(v2!) : "—"}
        {win2 && <span style={{ color: C.gold, fontSize: 12 }}>◀</span>}
      </div>
    </div>
  );
}

function ComparePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [inputA, setInputA] = useState(params.get("a") || "NVDA");
  const [inputB, setInputB] = useState(params.get("b") || "TSLA");
  const [dataA, setDataA] = useState<StockData | null>(null);
  const [dataB, setDataB] = useState<StockData | null>(null);
  const [aiVerdict, setAiVerdict] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const doCompare = async (a: string, b: string) => {
    if (!a || !b) return;
    setLoading(true);
    setError("");
    setDataA(null);
    setDataB(null);
    setAiVerdict("");

    try {
      const [rA, rB] = await Promise.all([
        fetch(`${API}/stock/${a.toUpperCase()}`),
        fetch(`${API}/stock/${b.toUpperCase()}`),
      ]);
      const [dA, dB] = await Promise.all([rA.json(), rB.json()]);
      if (!dA.price || !dB.price) throw new Error("데이터 없음");
      setDataA({ ...dA, ticker: a.toUpperCase() });
      setDataB({ ...dB, ticker: b.toUpperCase() });
      // update URL
      router.replace(`/compare?a=${a.toUpperCase()}&b=${b.toUpperCase()}`);

      // AI verdict async
      setAiLoading(true);
      try {
        const rAI = await fetch(`${API}/compare/${a.toUpperCase()}/${b.toUpperCase()}`);
        const dAI = await rAI.json();
        setAiVerdict(dAI.verdict || dAI.result || "");
      } catch {
        setAiVerdict("");
      } finally {
        setAiLoading(false);
      }
    } catch (e) {
      setError(`데이터를 불러올 수 없어요. 올바른 티커를 입력해주세요.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const a = params.get("a");
    const b = params.get("b");
    if (a && b) doCompare(a, b);
    // eslint-disable-next-line
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doCompare(inputA, inputB);
  };

  // Score: who wins more categories
  let scoreA = 0, scoreB = 0;
  if (dataA && dataB) {
    if (dataA.change_pct > dataB.change_pct) scoreA++; else scoreB++;
    if ((dataA.pe || 999) < (dataB.pe || 999)) scoreA++; else scoreB++;
    if ((dataA.market_cap || 0) > (dataB.market_cap || 0)) scoreA++; else scoreB++;
    if ((dataA.dividend_yield || 0) > (dataB.dividend_yield || 0)) scoreA++; else scoreB++;
    const rangeA = dataA.week52_high && dataA.week52_low && dataA.price
      ? (dataA.price - dataA.week52_low) / (dataA.week52_high - dataA.week52_low)
      : 0.5;
    const rangeB = dataB.week52_high && dataB.week52_low && dataB.price
      ? (dataB.price - dataB.week52_low) / (dataB.week52_high - dataB.week52_low)
      : 0.5;
    if (rangeA > rangeB) scoreA++; else scoreB++;
  }

  const isUp = (pct: number) => pct >= 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00d97e,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: C.bg }}>9</div>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>구해조</span>
        </Link>
        <span style={{ color: C.muted, fontSize: 13 }}>/ 종목 비교</span>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
        {/* Title */}
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, textAlign: "center" }}>
          ⚖️ 종목 비교
        </h1>
        <p style={{ color: C.muted, textAlign: "center", marginBottom: 32, fontSize: 14 }}>
          두 종목을 나란히 비교하고 AI 판정을 받아보세요
        </p>

        {/* Input form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, marginBottom: 32, alignItems: "center" }}>
          <input
            value={inputA}
            onChange={e => setInputA(e.target.value.toUpperCase())}
            placeholder="NVDA"
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "monospace", outline: "none", textAlign: "center" }}
          />
          <span style={{ color: C.muted, fontWeight: 700, fontSize: 18 }}>vs</span>
          <input
            value={inputB}
            onChange={e => setInputB(e.target.value.toUpperCase())}
            placeholder="TSLA"
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "monospace", outline: "none", textAlign: "center" }}
          />
          <button type="submit" disabled={loading} style={{ padding: "12px 20px", borderRadius: 10, background: "linear-gradient(135deg,#00d97e,#3b82f6)", border: "none", color: C.bg, fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, whiteSpace: "nowrap" }}>
            {loading ? "조회 중..." : "비교하기"}
          </button>
        </form>

        {/* Quick picks */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 32 }}>
          {[["NVDA","TSLA"],["AAPL","MSFT"],["AMZN","GOOGL"],["META","NFLX"],["NVDA","AMD"]].map(([a,b]) => (
            <button key={a+b} onClick={() => { setInputA(a); setInputB(b); doCompare(a, b); }} style={{ padding: "6px 14px", borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              {a} vs {b}
            </button>
          ))}
        </div>

        {error && <div style={{ textAlign: "center", color: C.red, padding: 20 }}>{error}</div>}

        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚖️</div>
            <div>데이터 조회 중...</div>
          </div>
        )}

        {dataA && dataB && !loading && (
          <>
            {/* Header cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 24, alignItems: "center" }}>
              {/* Stock A */}
              <div style={{ background: C.card, borderRadius: 16, padding: "20px 16px", border: `2px solid ${scoreA > scoreB ? C.gold + "60" : C.border}`, textAlign: "center" }}>
                {scoreA > scoreB && <WinnerBadge label="우세" />}
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "monospace", marginTop: scoreA > scoreB ? 8 : 0 }}>{dataA.ticker}</div>
                {dataA.name && <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{dataA.name.slice(0, 20)}</div>}
                <div style={{ fontSize: 22, fontWeight: 900 }}>${dataA.price.toFixed(2)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isUp(dataA.change_pct) ? C.green : C.red }}>
                  {isUp(dataA.change_pct) ? "▲" : "▼"} {Math.abs(dataA.change_pct).toFixed(2)}%
                </div>
              </div>

              <div style={{ textAlign: "center", color: C.muted, fontWeight: 800, fontSize: 16 }}>VS</div>

              {/* Stock B */}
              <div style={{ background: C.card, borderRadius: 16, padding: "20px 16px", border: `2px solid ${scoreB > scoreA ? C.gold + "60" : C.border}`, textAlign: "center" }}>
                {scoreB > scoreA && <WinnerBadge label="우세" />}
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "monospace", marginTop: scoreB > scoreA ? 8 : 0 }}>{dataB.ticker}</div>
                {dataB.name && <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{dataB.name.slice(0, 20)}</div>}
                <div style={{ fontSize: 22, fontWeight: 900 }}>${dataB.price.toFixed(2)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isUp(dataB.change_pct) ? C.green : C.red }}>
                  {isUp(dataB.change_pct) ? "▲" : "▼"} {Math.abs(dataB.change_pct).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Comparison table */}
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 24, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 120px 1fr", textAlign: "center" }}>
                <span style={{ fontWeight: 900, color: C.text, textAlign: "right" }}>{dataA.ticker}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>지표</span>
                <span style={{ fontWeight: 900, color: C.text }}>{dataB.ticker}</span>
              </div>

              <CompareRow label="오늘 등락" v1={dataA.change_pct} v2={dataB.change_pct} higher="a"
                format={v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%"} />
              <CompareRow label="시가총액" v1={dataA.market_cap} v2={dataB.market_cap} higher="a"
                format={v => fmt(v, "$")} />
              <CompareRow label="PER" v1={dataA.pe} v2={dataB.pe} higher="b"
                format={v => v.toFixed(1) + "x"} />
              <CompareRow label="배당수익률" v1={dataA.dividend_yield} v2={dataB.dividend_yield} higher="a"
                format={v => v.toFixed(2) + "%"} />
              <CompareRow label="거래량" v1={dataA.volume} v2={dataB.volume} higher="a"
                format={v => fmt(v)} />
              <CompareRow label="52주 최고" v1={dataA.week52_high} v2={dataB.week52_high} higher="none"
                format={v => "$" + v.toFixed(2)} />
              <CompareRow label="52주 최저" v1={dataA.week52_low} v2={dataB.week52_low} higher="none"
                format={v => "$" + v.toFixed(2)} />

              {/* 52주 위치 */}
              {dataA.week52_high && dataA.week52_low && dataB.week52_high && dataB.week52_low && (() => {
                const posA = Math.round(((dataA.price - dataA.week52_low!) / (dataA.week52_high! - dataA.week52_low!)) * 100);
                const posB = Math.round(((dataB.price - dataB.week52_low!) / (dataB.week52_high! - dataB.week52_low!)) * 100);
                return (
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginBottom: 10 }}>52주 가격 위치</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 8, alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, textAlign: "right" }}>{posA}%</div>
                        <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${posA}%`, background: C.green, borderRadius: 3 }} />
                        </div>
                      </div>
                      <div />
                      <div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{posB}%</div>
                        <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${posB}%`, background: C.blue, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* AI Verdict */}
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>AI 분석 판정</span>
                {aiLoading && <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>분석 중...</span>}
              </div>
              {aiLoading ? (
                <div style={{ color: C.muted, fontSize: 14 }}>Claude AI가 두 종목을 분석하고 있습니다...</div>
              ) : aiVerdict ? (
                <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiVerdict}</div>
              ) : (
                <div style={{ color: C.muted, fontSize: 14 }}>AI 판정을 불러올 수 없어요. 잠시 후 다시 시도해주세요.</div>
              )}
            </div>

            {/* CTA */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={`/stock/${dataA.ticker}`} style={{ padding: "10px 20px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                📈 {dataA.ticker} 심층 분석
              </Link>
              <Link href={`/stock/${dataB.ticker}`} style={{ padding: "10px 20px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                📈 {dataB.ticker} 심층 분석
              </Link>
              <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#00d97e,#3b82f6)", border: "none", color: C.bg, textDecoration: "none", fontSize: 13, fontWeight: 800 }}>
                🤖 텔레그램 AI 봇
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#07070f", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b6b80" }}>로딩 중...</div>}>
      <ComparePage />
    </Suspense>
  );
}
