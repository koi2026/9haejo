"use client";
import { useState, useEffect, use } from "react";
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
  const [chartDays, setChartDays] = useState(30);
  const [chartPrices, setChartPrices] = useState<number[]>([]);
  const [chartDates, setChartDates] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API}/stock/${upperTicker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
    // 스파크라인 14일 히스토리 (헤더용)
    fetch(`${API}/stock/history/${upperTicker}?days=14`)
      .then(r => r.json())
      .then(d => { if (d.prices?.length) setSparkPrices(d.prices); })
      .catch(() => {});
    // 동종 종목
    fetch(`${API}/stock/${upperTicker}/peers`)
      .then(r => r.json())
      .then(d => { if (d.peers?.length) { setPeers(d.peers); setPeerSector(d.sector || ""); } })
      .catch(() => {});
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
          <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
            style={{ padding: "8px 18px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            봇에서 분석하기
          </a>
        </div>
      </nav>

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
                  <div style={{ fontSize: 36, fontWeight: 900, color: C.text, fontFamily: "monospace" }}>
                    ${data.price.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: data.change_pct >= 0 ? C.green : C.red }}>
                    {data.change_pct >= 0 ? "▲+" : "▼"}{data.change_pct.toFixed(2)}%
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

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ padding: "20px 24px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>VALUATION</p>
                <StatRow label="시가총액" value={fmtCap(data.market_cap)} />
                <StatRow label="PER" value={data.pe_ratio ? data.pe_ratio.toFixed(1) + "x" : "N/A"} />
                <StatRow label="52주 최고" value={data.week52_high ? `$${data.week52_high.toFixed(2)}` : "N/A"} />
                <StatRow label="52주 최저" value={data.week52_low ? `$${data.week52_low.toFixed(2)}` : "N/A"} />
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
                <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, color: C.muted }}>차트 로딩 중…</div>
                </div>
              ) : (() => {
                const W = 720, H = 120, pad = 8;
                const min = Math.min(...chartPrices), max = Math.max(...chartPrices);
                const range = max - min || 1;
                const color = data.change_pct >= 0 ? C.green : C.red;
                const pts = chartPrices.map((p, i) => {
                  const x = pad + (i / (chartPrices.length - 1)) * (W - pad * 2);
                  const y = H - pad - ((p - min) / range) * (H - pad * 2);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                const pathD = `M ${pts.join(" L ")}`;
                const fillD = `${pathD} L ${(W - pad).toFixed(1)},${(H - pad).toFixed(1)} L ${pad},${(H - pad).toFixed(1)} Z`;
                const minIdx = chartPrices.indexOf(min);
                const maxIdx = chartPrices.indexOf(max);
                const [minX, minY] = pts[minIdx].split(",").map(Number);
                const [maxX, maxY] = pts[maxIdx].split(",").map(Number);
                return (
                  <div>
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
                      <defs>
                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                        </linearGradient>
                      </defs>
                      <path d={fillD} fill="url(#chartFill)" />
                      <path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      {/* Min marker */}
                      <circle cx={minX} cy={minY} r="4" fill={C.red} />
                      <text x={minX} y={minY + 16} textAnchor="middle" fontSize="10" fill={C.red} fontFamily="monospace">${min.toFixed(0)}</text>
                      {/* Max marker */}
                      <circle cx={maxX} cy={maxY} r="4" fill={C.green} />
                      <text x={maxX} y={maxY - 8} textAnchor="middle" fontSize="10" fill={C.green} fontFamily="monospace">${max.toFixed(0)}</text>
                      {/* Last point */}
                      <circle cx={parseFloat(pts[pts.length - 1].split(",")[0])} cy={parseFloat(pts[pts.length - 1].split(",")[1])} r="5" fill={color} />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{chartDates[0] || ""}</span>
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{chartDates[chartDates.length - 1] || ""}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

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
