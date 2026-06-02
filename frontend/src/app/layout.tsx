import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#00d97e",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://9haejo.vercel.app"),
  title: "구해조 | 미국 증시 AI 브리핑 - 매일 8시 텔레그램",
  description: "Claude AI가 분석한 미국 증시 브리핑을 매일 오전 8시 텔레그램으로 받아보세요. S&P500, 나스닥, 환율, 섹터별 분석을 한국어로.",
  keywords: ["미국 증시", "주식 브리핑", "텔레그램 봇", "AI 주식분석", "나스닥", "S&P500", "한국 투자자"],
  authors: [{ name: "9haejo" }],
  openGraph: {
    title: "구해조 | 미국 증시 AI 브리핑",
    description: "매일 오전 8시, 월가 AI 브리핑을 텔레그램으로. S&P500, 나스닥, 환율, 빅테크 한국어 분석.",
    url: "https://9haejo.vercel.app",
    siteName: "구해조",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "https://9haejo.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "구해조 - 미국 증시 AI 브리핑",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "구해조 | 미국 증시 AI 브리핑",
    description: "매일 오전 8시, 월가 AI 브리핑을 텔레그램으로.",
    images: ["https://9haejo.vercel.app/og-image.png"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "구해조",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<BottomNav /></body>
    </html>
  );
}
