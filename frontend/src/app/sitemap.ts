import { MetadataRoute } from "next";

const BASE = "https://9haejo.vercel.app";
const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const static_pages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/briefings`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  // Popular stock pages
  const popularTickers = [
    "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "AMD",
    "AVGO", "NFLX", "INTC", "ORCL", "CRM", "ADBE", "PYPL", "SHOP",
    "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BABA", "JD", "PDD",
  ];

  const stock_pages: MetadataRoute.Sitemap = popularTickers.map(t => ({
    url: `${BASE}/stock/${t}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));

  // Briefing history pages
  let briefing_pages: MetadataRoute.Sitemap = [];
  try {
    const r = await fetch(`${API}/summary/history`, { next: { revalidate: 3600 } });
    const d = await r.json();
    const dates: string[] = (d.dates || []).slice(0, 60);
    briefing_pages = dates.map(date => ({
      url: `${BASE}/briefings?date=${date}`,
      lastModified: new Date(date),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    }));
  } catch {
    // ignore
  }

  return [...static_pages, ...stock_pages, ...briefing_pages];
}
