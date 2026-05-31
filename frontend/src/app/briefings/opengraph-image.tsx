import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "구해조 브리핑 아카이브";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#07070f",
          padding: "60px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Gradient accent bar */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: 6,
          background: "linear-gradient(90deg, #00d97e 0%, #3b82f6 100%)",
          display: "flex",
        }} />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 900, color: "#07070f",
          }}>9</div>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#e8e8f0" }}>구해조</span>
          <span style={{ fontSize: 18, color: "#6b6b80", marginLeft: 8 }}>/ 브리핑 아카이브</span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 58, fontWeight: 900, color: "#e8e8f0", lineHeight: 1.15, marginBottom: 24, display: "flex" }}>
          미국 증시 AI 브리핑
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 26, color: "#6b6b80", marginBottom: 48, display: "flex" }}>
          시장 요약 · 섹터 분석 · 주목 종목 · 한국 영향 · 내일 전망
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: 12 }}>
          {["S&P500", "나스닥", "환율", "빅테크", "AI 분석"].map(tag => (
            <div key={tag} style={{
              padding: "8px 20px", borderRadius: 20,
              background: "#1a1a2e", color: "#00d97e",
              fontSize: 18, fontWeight: 600, display: "flex",
            }}>{tag}</div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{
          position: "absolute", bottom: 48, right: 80,
          fontSize: 20, color: "#6b6b80", display: "flex",
        }}>
          9haejo.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
