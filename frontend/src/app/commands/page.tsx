"use client";
import Link from "next/link";
import NavSearch from "@/components/NavSearch";

const C = {
  bg: "#07070f", surface: "#0d0d1a", card: "#111120", border: "#1a1a2e",
  green: "#00d97e", red: "#ff4466", blue: "#3b82f6",
  text: "#e8e8f0", muted: "#6b6b80",
  grad: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
  amber: "#f59e0b", purple: "#a78bfa", pink: "#ec4899", cyan: "#06b6d4",
};

const COMMANDS = [
  {
    category: "📊 시황 · 브리핑",
    color: C.green,
    items: [
      { cmd: "/브리핑", desc: "AI 미국 증시 브리핑 (즉시)", example: "" },
      { cmd: "/시황", desc: "지수·환율·공포탐욕 현황", example: "" },
      { cmd: "/뉴스", desc: "월가 뉴스 한국어 요약", example: "" },
      { cmd: "/뉴스 NVDA", desc: "종목별 뉴스 요약", example: "NVDA, TSLA, AAPL..." },
    ],
  },
  {
    category: "🌐 매크로",
    color: C.amber,
    items: [
      { cmd: "/매크로", desc: "VIX·DXY·금리·오일·금", example: "" },
      { cmd: "/환율", desc: "USD/KRW·JPY AI 전망", example: "" },
      { cmd: "/sector 반도체", desc: "섹터 ETF 분석", example: "반도체, 기술, 금융, 바이오..." },
    ],
  },
  {
    category: "🔍 종목 분석",
    color: C.blue,
    items: [
      { cmd: "NVDA", desc: "티커·종목명 입력 → AI 즉시 분석", example: "엔비디아, 테슬라..." },
      { cmd: "/종목전망 NVDA", desc: "주간 전망 AI 분석", example: "" },
      { cmd: "/compare NVDA TSLA", desc: "종목 비교 분석", example: "" },
    ],
  },
  {
    category: "📈 스크리너",
    color: C.purple,
    items: [
      { cmd: "/상승 반도체", desc: "섹터별 상승 종목 랭킹", example: "반도체, tech, 바이오..." },
      { cmd: "/하락 tech", desc: "섹터별 하락 종목 랭킹", example: "" },
      { cmd: "/랭킹 crypto", desc: "암호화폐·빅테크·코스피", example: "crypto, 빅테크, 코스피" },
    ],
  },
  {
    category: "🔔 내 계정",
    color: C.pink,
    items: [
      { cmd: "/구독", desc: "매일 8시 브리핑 구독", example: "" },
      { cmd: "/구독취소", desc: "구독 해제", example: "" },
      { cmd: "/watchlist add NVDA", desc: "관심종목 추가·조회", example: "add, remove, show" },
      { cmd: "/알림 NVDA 200", desc: "가격 알림 등록", example: "도달 시 알림 전송" },
      { cmd: "/포트폴리오", desc: "관심종목 AI 진단", example: "" },
      { cmd: "/내통계", desc: "내 구독·알림 현황", example: "" },
    ],
  },
  {
    category: "📅 일정",
    color: C.cyan,
    items: [
      { cmd: "/실적", desc: "주요 실적 발표 일정", example: "" },
      { cmd: "/지난브리핑", desc: "어제 브리핑 다시보기", example: "" },
    ],
  },
];

export default function CommandsPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 80 }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 11, color: C.muted }}>/</span>
            <span style={{ fontSize: 13, color: C.muted }}>커맨드</span>
          </div>
          <NavSearch />
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 11, color: C.green, fontFamily: "monospace", letterSpacing: 3, marginBottom: 8 }}>COMMANDS</p>
          <h1 style={{ fontSize: "clamp(28px,6vw,42px)", fontWeight: 900, color: C.text, marginBottom: 12 }}>전체 커맨드</h1>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>@goohaejo_bot 에서 바로 사용하세요</p>
          <a
            href="https://t.me/goohaejo_bot"
            target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 14, textDecoration: "none", boxShadow: `0 8px 24px ${C.green}30` }}
          >
            📱 텔레그램에서 바로 시작하기 →
          </a>
        </div>

        {/* Tip box */}
        <div style={{ padding: "14px 20px", borderRadius: 14, background: `${C.blue}10`, border: `1px solid ${C.blue}30`, marginBottom: 32, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            <strong style={{ color: C.text }}>종목명·티커를 그냥 입력</strong>하면 AI가 즉시 분석합니다.<br />
            예: <code style={{ background: C.card, padding: "1px 6px", borderRadius: 4, color: C.green, fontFamily: "monospace" }}>엔비디아</code> → NVDA 분석 / <code style={{ background: C.card, padding: "1px 6px", borderRadius: 4, color: C.green, fontFamily: "monospace" }}>커맨드알려줘</code> → 이 목록
          </div>
        </div>

        {/* Command grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))", gap: 16 }}>
          {COMMANDS.map(section => (
            <div key={section.category} style={{ borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: section.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{section.category}</span>
              </div>
              <div style={{ padding: "8px 0" }}>
                {section.items.map((item, i) => (
                  <a
                    key={i}
                    href={`https://t.me/goohaejo_bot?start=${encodeURIComponent(item.cmd.split(" ")[0])}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", textDecoration: "none", gap: 12, transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${section.color}08`)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: section.color, fontFamily: "monospace", marginBottom: 2 }}>{item.cmd}</div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                    {item.example && (
                      <div style={{ fontSize: 10, color: `${section.color}80`, whiteSpace: "nowrap", flexShrink: 0, background: `${section.color}12`, padding: "2px 8px", borderRadius: 6 }}>
                        {item.example}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: "center", marginTop: 48, padding: "32px 24px", borderRadius: 20, background: `linear-gradient(135deg, ${C.green}08, ${C.blue}08)`, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🤖</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 8 }}>지금 바로 시작하세요</h2>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>매일 오전 8시, AI 브리핑을 텔레그램으로 받아보세요</p>
          <a
            href="https://t.me/goohaejo_bot"
            target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-block", padding: "14px 36px", borderRadius: 12, background: C.grad, color: "#07070f", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: `0 8px 24px ${C.green}30` }}
          >
            @goohaejo_bot 열기
          </a>
        </div>
      </div>
    </div>
  );
}
