import { NextResponse } from "next/server";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";
const BASE_URL = "https://9haejo.vercel.app";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET() {
  try {
    const r = await fetch(`${API}/summary/history`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    const dates: string[] = data.dates || [];

    const items = await Promise.all(
      dates.slice(0, 20).map(async (date) => {
        try {
          const br = await fetch(`${API}/summary/history/${date}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
          const bd = await br.json();
          const tweets: string[] = bd.tweets || [];
          const content = tweets.join("\n\n");
          const preview = tweets[0]?.slice(0, 200) || "";
          return { date, content, preview };
        } catch {
          return { date, content: "", preview: "" };
        }
      })
    );

    const pubDate = (dateStr: string) => {
      // date is YYYY-MM-DD, published at 08:00 KST = 23:00 UTC prev day
      const d = new Date(dateStr + "T23:00:00Z");
      return d.toUTCString();
    };

    const itemsXml = items
      .map(({ date, content, preview }) => {
        const title = `${date} 미국 증시 AI 브리핑`;
        const link = `${BASE_URL}/briefings?date=${date}`;
        const desc = escapeXml(preview || `${date} 구해조 AI 브리핑`);
        const contentEscaped = escapeXml(content);
        return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${desc}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${pubDate(date)}</pubDate>
      <author>ai@9haejo.vercel.app (구해조 AI)</author>
      <category>Finance</category>
      <category>Stock Market</category>
    </item>`.trim();
      })
      .join("\n    ");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>구해조 AI 브리핑 — 매일 미국 증시 분석</title>
    <link>${BASE_URL}</link>
    <description>Claude AI가 분석하는 매일 오전 8시 미국 증시 핵심 브리핑 서비스</description>
    <language>ko</language>
    <managingEditor>ai@9haejo.vercel.app (구해조 AI)</managingEditor>
    <webMaster>ai@9haejo.vercel.app</webMaster>
    <image>
      <url>${BASE_URL}/icon-192.png</url>
      <title>구해조</title>
      <link>${BASE_URL}</link>
    </image>
    <atom:link href="${BASE_URL}/api/rss" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "RSS 생성 실패" }, { status: 500 });
  }
}
