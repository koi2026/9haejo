"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NavSearch from "@/components/NavSearch";

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

function BriefingCard({ text, index }: { text: string; index: number }) {
  const labels = ["시장 요약", "섹터 분석", "주목 종목", "한국 영향", "내일 전망"];
  const colors = [C.green, "#a78bfa", "#f59e0b", C.blue, "#ec4899"];
  return (
    <div style={{
      padding: "20px", borderRadius: 14, background: C.card,
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${colors[index] || C.green}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors[index] || C.green, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
        {labels[index] || `Part ${index + 1}`}
      </div>
      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

interface SearchResult {
  date: string;
  matches: number;
  preview: string;
}

function BriefingsContent() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [briefings, setBriefings] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [dateInputError, setDateInputError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  const loadBriefing = useCallback(async (date: string) => {
    if (briefings[date]) { setSelected(date); return; }
    setBriefingLoading(true);
    try {
      const r = await fetch(`${API}/summary/history/${date}`);
      const d = await r.json();
      if (d.tweets) {
        setBriefings(prev => ({ ...prev, [date]: d.tweets }));
        setSelected(date);
      }
    } catch {} finally {
      setBriefingLoading(false);
    }
  }, [briefings]);

  useEffect(() => {
    const dateParam = searchParams.get("date");
    fetch(`${API}/summary/history`)
      .then(r => r.json())
      .then(d => {
        if (d.dates?.length) {
          setDates(d.dates);
          const target = dateParam && d.dates.includes(dateParam) ? dateParam : d.dates[0];
          loadBriefing(target);
          setSelected(target);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  const selectDate = (date: string) => {
    loadBriefing(date);
    router.push(`/briefings?date=${date}`, { scroll: false });
  };

  const copyShareLink = () => {
    const url = `https://9haejo.vercel.app/briefings?date=${selected}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchMode(false); setSearchResults([]); return; }
    setSearchMode(true);
    setSearching(true);
    try {
      const r = await fetch(`${API}/summary/search?q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      setSearchResults(d.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) doSearch(searchQuery);
      else if (!searchQuery.trim()) { setSearchMode(false); setSearchResults([]); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const handleDateInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDateInputError("YYYY-MM-DD 형식으로 입력하세요");
      return;
    }
    setDateInputError("");
    setBriefingLoading(true);
    try {
      const r = await fetch(`${API}/summary/history/${d}`);
      const data = await r.json();
      if (data.tweets?.length) {
        setBriefings(prev => ({ ...prev, [d]: data.tweets }));
        if (!dates.includes(d)) setDates(prev => [d, ...prev].sort((a, b) => b.localeCompare(a)));
        setSelected(d);
        router.push(`/briefings?date=${d}`, { scroll: false });
        setDateInput("");
      } else {
        setDateInputError(`${d} 브리핑이 없습니다`);
      }
    } catch {
      setDateInputError("불러오기 실패");
    } finally {
      setBriefingLoading(false);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ background: `${C.green}40`, color: C.green, borderRadius: 2, padding: "0 2px" }}>{p}</mark>
        : p
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>BRIEFING ARCHIVE</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: C.text, marginBottom: 8 }}>브리핑 아카이브</h1>
        <p style={{ color: C.muted, fontSize: 15, marginBottom: 20 }}>매일 오전 8시 발송된 AI 브리핑을 날짜별로 확인하세요</p>
        {/* Search + Date Input Row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Keyword search */}
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.muted, pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              placeholder="키워드 검색... (NVDA, 금리, 반도체)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "12px 16px 12px 44px", borderRadius: 12,
                background: C.card, border: `1px solid ${searchMode ? C.green : C.border}`,
                color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchMode(false); setSearchResults([]); }}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>
                ×
              </button>
            )}
          </div>

          {/* Date direct input */}
          <form onSubmit={handleDateInput} style={{ display: "flex", gap: 6, alignItems: "flex-start", flex: "0 0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => { setDateInput(e.target.value); setDateInputError(""); }}
                  max={new Date().toISOString().split("T")[0]}
                  style={{
                    padding: "12px 12px", borderRadius: 12, background: C.card,
                    border: `1px solid ${dateInputError ? C.red : C.border}`,
                    color: C.text, fontSize: 13, outline: "none",
                    colorScheme: "dark",
                  }}
                />
                <button type="submit"
                  style={{ padding: "12px 16px", borderRadius: 12, background: `${C.blue}20`, border: `1px solid ${C.blue}40`, color: C.blue, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                  날짜로 이동
                </button>
              </div>
              {dateInputError && <span style={{ fontSize: 11, color: C.red, paddingLeft: 4 }}>{dateInputError}</span>}
            </div>
          </form>
        </div>
      </div>

      {/* Search Results Mode */}
      {searchMode && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontFamily: "monospace" }}>
            {searching ? "검색 중..." : `검색 결과: "${searchQuery}" — ${searchResults.length}개 브리핑`}
          </div>
          {searching ? (
            <div style={{ display: "flex", gap: 8 }}>
              {[0,1,2].map(i => <div key={i} style={{ height: 80, flex: 1, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, animation: "pulse 1.5s ease-in-out infinite" }} />)}
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ color: C.muted, padding: 40, textAlign: "center", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div>"{searchQuery}"에 대한 결과가 없습니다</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>다른 키워드로 검색해보세요 (예: AAPL, 기술주, 연준)</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {searchResults.map((r) => (
                <button key={r.date} onClick={() => { setSearchQuery(""); setSearchMode(false); selectDate(r.date); }}
                  style={{ padding: "16px 20px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.green)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: C.green }}>{r.date}</span>
                    <span style={{ fontSize: 11, color: C.muted, background: `${C.green}18`, padding: "2px 8px", borderRadius: 10 }}>매칭 {r.matches}건</span>
                  </div>
                  <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                    {highlightText(r.preview.slice(0, 120) + (r.preview.length > 120 ? "..." : ""), searchQuery)}
                  </p>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
            <button onClick={() => { setSearchQuery(""); setSearchMode(false); setSearchResults([]); }}
              style={{ fontSize: 13, color: C.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              전체 아카이브 보기
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: C.muted, textAlign: "center", padding: 60 }}>로딩 중...</div>
      ) : dates.length === 0 ? (
        <div style={{ color: C.muted, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
          <div>아직 저장된 브리핑이 없습니다.</div>
          <div style={{ marginTop: 8, fontSize: 13 }}>매일 오전 8시 이후에 확인해주세요.</div>
        </div>
      ) : searchMode ? null : (
        <>
          {/* Quick-access pill tabs for recent 7 days */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {dates.slice(0, 7).map((date, i) => {
              const isActive = selected === date;
              const label = i === 0 ? "최신" : date.slice(5);
              return (
                <button key={date} onClick={() => selectDate(date)} style={{
                  padding: "8px 16px", borderRadius: 20,
                  border: `1px solid ${isActive ? C.green : C.border}`,
                  background: isActive ? `${C.green}18` : C.card,
                  color: isActive ? C.green : C.muted,
                  fontSize: 13, fontFamily: "monospace", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {i === 0 && <span style={{ marginRight: 4 }}>★</span>}
                  {label}
                </button>
              );
            })}
            {dates.length > 7 && (
              <span style={{ fontSize: 12, color: C.muted, padding: "8px 4px", alignSelf: "center" }}>
                + {dates.length - 7}개 더
              </span>
            )}
          </div>

        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24 }}>
          {/* Date list - full archive */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>전체 아카이브</div>
            <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, paddingRight: 4 }}>
            {dates.map((date, i) => (
              <button key={date} onClick={() => selectDate(date)} style={{
                padding: "9px 12px", borderRadius: 10, border: `1px solid ${selected === date ? C.green : C.border}`,
                background: selected === date ? `${C.green}12` : "transparent",
                color: selected === date ? C.green : C.muted,
                fontSize: 12, fontFamily: "monospace", cursor: "pointer", fontWeight: 600,
                textAlign: "left", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>{date}</span>
                {i === 0 && <span style={{ fontSize: 9, background: `${C.green}25`, color: C.green, padding: "1px 5px", borderRadius: 3 }}>NEW</span>}
                {selected === date && i !== 0 && <span style={{ fontSize: 9 }}>◀</span>}
              </button>
            ))}
            </div>
          </div>

          {/* Briefing content */}
          <div>
            {briefingLoading ? (
              <div style={{ display: "grid", gap: 14 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ padding: 20, borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
                    <div style={{ height: 10, width: "30%", borderRadius: 4, background: C.border, marginBottom: 12 }} />
                    <div style={{ height: 8, width: "90%", borderRadius: 4, background: C.border, marginBottom: 8 }} />
                    <div style={{ height: 8, width: "70%", borderRadius: 4, background: C.border }} />
                  </div>
                ))}
              </div>
            ) : selected && briefings[selected] ? (
              <>
                <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selected} 브리핑</span>
                  <button onClick={copyShareLink} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: copied ? `${C.green}25` : `${C.blue}15`, color: copied ? C.green : C.blue, border: `1px solid ${copied ? C.green : C.blue}30`, cursor: "pointer" }}>
                    {copied ? "✓ 복사됨!" : "🔗 링크 복사"}
                  </button>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${selected} 미국 증시 AI 브리핑 👇`)}&url=${encodeURIComponent(`https://9haejo.vercel.app/briefings?date=${selected}`)}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: "#1da1f215", color: "#1da1f2", border: "1px solid #1da1f230", textDecoration: "none" }}>
                    X 공유
                  </a>
                  <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30`, textDecoration: "none" }}>
                    텔레그램 구독 →
                  </a>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  {briefings[selected].map((t, i) => <BriefingCard key={i} text={t} index={i} />)}
                </div>
              </>
            ) : (
              <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>
                왼쪽에서 날짜를 선택하세요
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

export default function BriefingsPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 12, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, color: C.muted }}>브리핑 아카이브</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <NavSearch />
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 18px", borderRadius: 10, background: C.grad, color: "#07070f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              텔레그램 구독
            </a>
          </div>
        </div>
      </nav>

      <Suspense fallback={<div style={{ color: C.muted, textAlign: "center", padding: 60 }}>로딩 중...</div>}>
        <BriefingsContent />
      </Suspense>
    </div>
  );
}
