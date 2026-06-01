import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

export default async function Image({ searchParams }: { searchParams: { a?: string; b?: string } }) {
  const a = (searchParams.a || "NVDA").toUpperCase();
  const b = (searchParams.b || "TSLA").toUpperCase();

  let priceA = 0, priceB = 0, pctA = 0, pctB = 0, nameA = a, nameB = b;

  try {
    const [rA, rB] = await Promise.all([
      fetch(`${API}/stock/quote/${a}`, { next: { revalidate: 60 } }),
      fetch(`${API}/stock/quote/${b}`, { next: { revalidate: 60 } }),
    ]);
    const [dA, dB] = await Promise.all([rA.json(), rB.json()]);
    priceA = dA.price ?? 0;
    pctA = dA.change_pct ?? 0;
    nameA = dA.name ?? a;
    priceB = dB.price ?? 0;
    pctB = dB.change_pct ?? 0;
    nameB = dB.name ?? b;
  } catch {}

  const green = "#00d97e";
  const red = "#ff4466";
  const colorA = pctA >= 0 ? green : red;
  const colorB = pctB >= 0 ? green : red;
  const signA = pctA >= 0 ? "+" : "";
  const signB = pctB >= 0 ? "+" : "";
  const arrowA = pctA >= 0 ? "▲" : "▼";
  const arrowB = pctB >= 0 ? "▲" : "▼";

  const winnerColor = pctA > pctB ? colorA : colorB;
  const winner = pctA > pctB ? a : b;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#07070f",
          display: "flex",
          flexDirection: "column",
          padding: "52px 72px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(26,26,46,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(26,26,46,0.4) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Glow */}
        <div style={{
          position: "absolute", top: "40%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 900, height: 500,
          background: `radial-gradient(ellipse,${winnerColor}06 0%,transparent 65%)`,
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, position: "relative" }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: "linear-gradient(135deg,#00d97e,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#07070f" }}>9</div>
          <span style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 20 }}>구해조 AI</span>
          <span style={{ color: "#6b6b80", fontSize: 15, marginLeft: 6 }}>· 종목 비교</span>
        </div>

        {/* Main: two cards + VS */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, flex: 1, position: "relative" }}>
          {/* Card A */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            padding: "36px 40px", borderRadius: 20,
            background: `${colorA}08`, border: `2px solid ${colorA}30`,
          }}>
            <div style={{ fontSize: 64, fontWeight: 900, fontFamily: "monospace", color: "#e8e8f0", letterSpacing: -2 }}>{a}</div>
            {nameA !== a && (
              <div style={{ fontSize: 16, color: "#6b6b80", marginTop: 6 }}>{nameA.slice(0, 22)}</div>
            )}
            <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "monospace", color: "#e8e8f0", marginTop: 20 }}>
              ${priceA.toFixed(2)}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: colorA, marginTop: 8 }}>
              {arrowA} {signA}{pctA.toFixed(2)}%
            </div>
          </div>

          {/* VS badge */}
          <div style={{
            width: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0,
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#6b6b80" }}>VS</div>
            <div style={{ fontSize: 11, color: winnerColor, fontWeight: 700, textAlign: "center" }}>
              {winner} 우세
            </div>
          </div>

          {/* Card B */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            padding: "36px 40px", borderRadius: 20,
            background: `${colorB}08`, border: `2px solid ${colorB}30`,
          }}>
            <div style={{ fontSize: 64, fontWeight: 900, fontFamily: "monospace", color: "#e8e8f0", letterSpacing: -2 }}>{b}</div>
            {nameB !== b && (
              <div style={{ fontSize: 16, color: "#6b6b80", marginTop: 6 }}>{nameB.slice(0, 22)}</div>
            )}
            <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "monospace", color: "#e8e8f0", marginTop: 20 }}>
              ${priceB.toFixed(2)}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: colorB, marginTop: 8 }}>
              {arrowB} {signB}{pctB.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 32, paddingTop: 20, borderTop: "1px solid #1a1a2e", position: "relative",
        }}>
          <span style={{ color: "#6b6b80", fontSize: 15 }}>9haejo.vercel.app/compare?a={a}&b={b}</span>
          <span style={{ color: "#6b6b80", fontSize: 15 }}>AI 종목 비교 · @goohaejo_bot</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
