import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

export default async function Image() {
  let news: Array<{ title: string; sentiment: string }> = [];
  let bullishCount = 0, bearishCount = 0;

  try {
    const r = await fetch(`${API}/news/latest`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const items = (d.news || []).slice(0, 5);
    news = items.map((n: { title?: string; sentiment?: string }) => ({ title: n.title || "", sentiment: n.sentiment || "Neutral" }));
    bullishCount = (d.news || []).filter((n: { sentiment?: string }) => n.sentiment === "Bullish").length;
    bearishCount = (d.news || []).filter((n: { sentiment?: string }) => n.sentiment === "Bearish").length;
  } catch {}

  const green = "#00d97e";
  const red = "#ff4466";
  const gold = "#f59e0b";

  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: "#07070f",
          display: "flex", flexDirection: "column",
          padding: "52px 72px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Grid bg */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(26,26,46,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(26,26,46,0.5) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Glow */}
        <div style={{
          position: "absolute", top: "30%", left: "40%",
          transform: "translate(-50%,-50%)",
          width: 700, height: 500,
          background: `radial-gradient(ellipse,${gold}06 0%,transparent 65%)`,
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, position: "relative" }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: "linear-gradient(135deg,#00d97e,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#07070f" }}>9</div>
          <span style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 20 }}>구해조 AI</span>
          <span style={{ color: "#6b6b80", fontSize: 15, marginLeft: 6 }}>· 월가 뉴스 분석</span>
          <span style={{ marginLeft: "auto", color: "#6b6b80", fontSize: 14 }}>{today}</span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", gap: 48, flex: 1, position: "relative" }}>
          {/* Left: stats */}
          <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "20px 16px", borderRadius: 14, background: `${green}12`, border: `1px solid ${green}30`, textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: green, fontFamily: "monospace" }}>{bullishCount}</div>
              <div style={{ fontSize: 14, color: green, marginTop: 4, fontWeight: 700 }}>🟢 호재</div>
            </div>
            <div style={{ padding: "20px 16px", borderRadius: 14, background: `${red}12`, border: `1px solid ${red}30`, textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: red, fontFamily: "monospace" }}>{bearishCount}</div>
              <div style={{ fontSize: 14, color: red, marginTop: 4, fontWeight: 700 }}>🔴 악재</div>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "#0d0d1a", border: "1px solid #1a1a2e", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b6b80", fontFamily: "monospace", letterSpacing: 1 }}>AI POWERED</div>
              <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 4, fontWeight: 700 }}>Claude Haiku</div>
            </div>
          </div>

          {/* Right: headlines */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#6b6b80", fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>TOP HEADLINES</div>
            {news.slice(0, 4).map((n, i) => {
              const sentColor = n.sentiment === "Bullish" ? green : n.sentiment === "Bearish" ? red : "#6b6b80";
              const sentIcon = n.sentiment === "Bullish" ? "🟢" : n.sentiment === "Bearish" ? "🔴" : "🟡";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  background: "#0d0d1a", border: `1px solid ${sentColor}20`,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{sentIcon}</span>
                  <span style={{ fontSize: 14, color: "#c8c8d8", lineHeight: 1.4, overflow: "hidden" }}>
                    {n.title.slice(0, 90)}{n.title.length > 90 ? "..." : ""}
                  </span>
                </div>
              );
            })}
            {news.length === 0 && (
              <div style={{ color: "#6b6b80", fontSize: 16, padding: 20 }}>뉴스 로딩 중...</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 24, paddingTop: 16, borderTop: "1px solid #1a1a2e", position: "relative",
        }}>
          <span style={{ color: "#6b6b80", fontSize: 14 }}>9haejo.vercel.app/news</span>
          <span style={{ color: "#6b6b80", fontSize: 14 }}>@goohaejo_bot · /뉴스 명령어</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
