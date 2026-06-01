import { Metadata } from "next";

export const metadata: Metadata = {
  title: "월가 AI 뉴스 — 구해조",
  description: "Claude AI가 분석한 실시간 미국 증시 뉴스. 호재/악재 감성 분류, 종목별 필터링으로 빠르게 시장 흐름 파악.",
  openGraph: {
    title: "📰 월가 AI 뉴스 — 구해조",
    description: "Claude AI가 분석한 실시간 미국 증시 뉴스. 호재/악재 감성 분류.",
    type: "website",
    url: "https://9haejo.vercel.app/news",
  },
  twitter: {
    card: "summary_large_image",
    title: "📰 월가 AI 뉴스 — 구해조",
    description: "Claude AI가 분석한 실시간 미국 증시 뉴스. 호재/악재 감성 분류.",
  },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
