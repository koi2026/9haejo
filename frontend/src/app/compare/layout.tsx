import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "종목 비교 — 구해조 AI",
    description: "두 종목을 나란히 비교하고 Claude AI 판정을 받아보세요. NVDA vs TSLA, AAPL vs MSFT 등.",
    openGraph: {
      title: "종목 비교 ⚖️ — 구해조 AI",
      description: "두 종목을 나란히 비교하고 Claude AI 판정을 받아보세요.",
      type: "website",
      url: "https://9haejo.vercel.app/compare",
    },
    twitter: {
      card: "summary_large_image",
      title: "종목 비교 ⚖️ — 구해조 AI",
      description: "두 종목을 나란히 비교하고 Claude AI 판정을 받아보세요.",
    },
  };
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
