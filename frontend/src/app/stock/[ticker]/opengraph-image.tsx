import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

export default async function Image({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();

  let price = 0;
  let changePct = 0;
  let name = ticker;
  let sector = "";

  try {
    const r = await fetch(`${API}/stock/quote/${ticker}`, {
      next: { revalidate: 60 },
    });
    const d = await r.json();
    price = d.price ?? 0;
    changePct = d.change_pct ?? 0;
    name = d.name ?? ticker;
    sector = d.sector ?? "";
  } catch {}

  const isUp = changePct >= 0;
  const green = "#00d97e";
  const red = "#ff4466";
  const color = isUp ? green : red;
  const arrow = isUp ? "▲" : "▼";
  const sign = isUp ? "+" : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#07070f",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(26,26,46,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(26,26,46,0.4) 1px,transparent 1px)",
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
            background: `radial-gradient(ellipse,${color}08 0%,transparent 65%)`,
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48, position: "relative" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 22,
              color: "#07070f",
            }}
          >
            9
          </div>
          <span style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 22 }}>구해조 AI</span>
          <span style={{ color: "#6b6b80", fontSize: 16, marginLeft: 8 }}>· 종목 분석</span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 80, position: "relative" }}>
          {/* Left */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 80,
                fontWeight: 900,
                color: "#e8e8f0",
                fontFamily: "monospace",
                letterSpacing: "-2px",
                lineHeight: 1,
              }}
            >
              {ticker}
            </div>
            {name && name !== ticker && (
              <div style={{ fontSize: 22, color: "#6b6b80", marginTop: 12, fontWeight: 500 }}>{name.slice(0, 30)}</div>
            )}
            {sector && (
              <div
                style={{
                  marginTop: 16,
                  display: "inline-flex",
                  padding: "6px 16px",
                  borderRadius: 20,
                  background: "rgba(59,130,246,0.15)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "#3b82f6",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {sector}
              </div>
            )}
          </div>

          {/* Right - Price */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: "#e8e8f0",
                fontFamily: "monospace",
              }}
            >
              ${price.toFixed(2)}
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color,
                fontFamily: "monospace",
                marginTop: 8,
              }}
            >
              {arrow} {sign}{changePct.toFixed(2)}%
            </div>
            <div
              style={{
                marginTop: 20,
                padding: "10px 20px",
                borderRadius: 10,
                background: `${color}15`,
                border: `1px solid ${color}40`,
                color,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {isUp ? "📈 상승 모멘텀" : "📉 하락 구간"}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 40,
            paddingTop: 24,
            borderTop: "1px solid #1a1a2e",
            position: "relative",
          }}
        >
          <span style={{ color: "#6b6b80", fontSize: 16 }}>9haejo.vercel.app/stock/{ticker}</span>
          <span style={{ color: "#6b6b80", fontSize: 16 }}>@goohaejo_bot · 매일 8시 AI 브리핑</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
