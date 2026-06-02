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
  let week52High: number | null = null;
  let week52Low: number | null = null;
  let week52Position: number | null = null;
  let rsi: number | null = null;
  let rsiSignal = "";
  let trend = "";

  try {
    const [qRes, techRes] = await Promise.allSettled([
      fetch(`${API}/stock/quote/${ticker}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) }),
      fetch(`${API}/stock/${ticker}/technicals`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(3000) }),
    ]);
    if (qRes.status === "fulfilled") {
      const d = await qRes.value.json();
      price = d.price ?? 0;
      changePct = d.change_pct ?? 0;
      name = d.name ?? ticker;
      sector = d.sector ?? "";
      week52High = d.week52_high ?? null;
      week52Low = d.week52_low ?? null;
      week52Position = d.week52_position ?? null;
    }
    if (techRes.status === "fulfilled") {
      const d = await techRes.value.json();
      if (!d.error) {
        rsi = d.rsi ?? null;
        rsiSignal = d.rsi_signal ?? "";
        trend = d.trend ?? "";
      }
    }
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

          {/* Right - Price & Indicators */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <div style={{ fontSize: 68, fontWeight: 900, color: "#e8e8f0", fontFamily: "monospace" }}>
              ${price.toFixed(2)}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "monospace" }}>
              {arrow} {sign}{changePct.toFixed(2)}%
            </div>
            {/* Indicator chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {rsi !== null && (
                <div style={{ padding: "6px 14px", borderRadius: 8, background: rsi > 70 ? "#ff446615" : rsi < 30 ? "#00d97e15" : "#ffffff10", border: `1px solid ${rsi > 70 ? "#ff4466" : rsi < 30 ? "#00d97e" : "#ffffff30"}`, color: rsi > 70 ? "#ff4466" : rsi < 30 ? "#00d97e" : "#a0a0b0", fontSize: 15, fontWeight: 700 }}>
                  RSI {rsi} · {rsiSignal}
                </div>
              )}
              {trend && (
                <div style={{ padding: "6px 14px", borderRadius: 8, background: "#3b82f615", border: "1px solid #3b82f640", color: "#3b82f6", fontSize: 15, fontWeight: 700 }}>
                  {trend}
                </div>
              )}
            </div>
            {/* 52-week bar */}
            {week52Position !== null && week52Low !== null && week52High !== null && (
              <div style={{ width: 280 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b6b80", marginBottom: 4 }}>
                  <span>52주 최저 ${week52Low.toFixed(0)}</span>
                  <span>${week52High.toFixed(0)} 최고</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#1a1a2e", position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${week52Position}%`, borderRadius: 4, background: week52Position > 75 ? green : week52Position > 40 ? "#3b82f6" : red }} />
                </div>
                <div style={{ fontSize: 12, color: "#6b6b80", marginTop: 4, textAlign: "right" }}>{week52Position.toFixed(0)}% 구간</div>
              </div>
            )}
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
