import type { Metadata } from "next";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const ticker = params.ticker.toUpperCase();
  let title = `${ticker} 분석 — 구해조`;
  let description = `${ticker} 실시간 주가 + Claude AI 분석`;

  try {
    const r = await fetch(`${API}/stock/quote/${ticker}`, { next: { revalidate: 60 } });
    const d = await r.json();
    if (!d.error) {
      const pct = d.change_pct ?? 0;
      const sign = pct >= 0 ? "+" : "";
      title = `${ticker} $${d.price?.toFixed(2)} (${sign}${pct.toFixed(2)}%) — 구해조`;
      description = `${d.name ?? ticker} AI 분석 | $${d.price?.toFixed(2)} ${sign}${pct.toFixed(2)}% | 구해조 무료 AI 브리핑`;
    }
  } catch {}

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "구해조",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
