import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "구해조 — AI 미국 증시 브리핑",
    short_name: "구해조",
    description: "매일 오전 8시 Claude AI가 분석한 미국 증시 브리핑. 실시간 시세, 관심종목, AI 종목 분석.",
    start_url: "/",
    display: "standalone",
    background_color: "#07070f",
    theme_color: "#00d97e",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["finance", "news"],
    shortcuts: [
      {
        name: "관심종목",
        short_name: "관심",
        description: "내 관심종목 실시간 확인",
        url: "/watchlist",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "브리핑 아카이브",
        short_name: "브리핑",
        description: "날짜별 AI 브리핑 모아보기",
        url: "/briefings",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "포트폴리오",
        short_name: "포트폴리오",
        description: "내 보유 종목 수익률 확인",
        url: "/portfolio",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
