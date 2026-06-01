import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "구해조 - 미국 증시 AI 브리핑";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#07070f",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(0,217,126,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,126,0.04) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 800,
            height: 600,
            background:
              "radial-gradient(ellipse,rgba(0,217,126,0.12) 0%,transparent 65%)",
          }}
        />

        {/* Logo badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
            fontSize: 36,
            fontWeight: 900,
            color: "#07070f",
            marginBottom: 28,
          }}
        >
          9
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-3px",
            background: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 16,
          }}
        >
          구해조
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#e8e8f0",
            marginBottom: 12,
          }}
        >
          미국 증시 AI 브리핑
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 20,
            color: "#6b6b80",
            marginBottom: 40,
          }}
        >
          매일 오전 8시 · 텔레그램 · 한국어 분석
        </div>

        {/* Chips */}
        <div style={{ display: "flex", gap: 12 }}>
          {["S&P500", "NASDAQ", "환율", "섹터분석", "AI 요약"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(0,217,126,0.08)",
                border: "1px solid rgba(0,217,126,0.25)",
                color: "#00d97e",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 16,
            color: "#3b3b52",
            fontFamily: "monospace",
          }}
        >
          9haejo.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
