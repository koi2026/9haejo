import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "브리핑 아카이브 | 구해조",
  description: "AI가 분석한 미국 증시 일일 브리핑 아카이브. 시장 요약, 섹터 분석, 주목 종목, 한국 영향, 내일 전망을 날짜별로 확인하세요.",
  openGraph: {
    title: "구해조 브리핑 아카이브 | 미국 증시 AI 분석",
    description: "AI가 분석한 미국 증시 일일 브리핑. 시장 요약, 섹터 분석, 주목 종목을 날짜별로 확인하세요.",
    url: "https://9haejo.vercel.app/briefings",
    siteName: "구해조",
    locale: "ko_KR",
    type: "article",
    images: [
      {
        url: "https://9haejo.vercel.app/og-briefing.png",
        width: 1200,
        height: 630,
        alt: "구해조 브리핑 아카이브",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "구해조 브리핑 아카이브 | 미국 증시 AI 분석",
    description: "AI가 분석한 미국 증시 일일 브리핑. 날짜별로 확인하세요.",
    images: ["https://9haejo.vercel.app/og-briefing.png"],
  },
};

export default function BriefingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
