"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const SHOWN_KEY = "9haejo_onboarding_v1_shown";

const STEPS = [
  {
    icon: "📊",
    title: "매일 아침 8시 AI 브리핑",
    desc: "Claude AI가 미국 증시를 분석해 핵심만 정리. 텔레그램으로 매일 아침 받아보세요.",
    color: "#00d97e",
    link: null,
  },
  {
    icon: "🔍",
    title: "종목 스크리너 & 실시간 시세",
    desc: "36개 인기 종목을 섹터·등락률로 필터링. 관심종목을 추가해 실시간으로 추적하세요.",
    color: "#3b82f6",
    link: "/screener",
  },
  {
    icon: "🔔",
    title: "목표가 도달 즉시 알림",
    desc: "웹에서 목표가를 설정하면 도달 시 텔레그램으로 즉시 알림. 매일 확인 안 해도 됩니다.",
    color: "#f59e0b",
    link: "/alerts",
  },
  {
    icon: "🤖",
    title: "AI 챗으로 궁금한 것 바로 질문",
    desc: "\"NVDA 지금 사도 될까요?\" 실시간 시세 기반으로 Claude AI가 즉시 답변합니다.",
    color: "#a78bfa",
    link: "/chat",
  },
];

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const shown = localStorage.getItem(SHOWN_KEY);
    if (!shown) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(SHOWN_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#111120", borderRadius: 24, padding: "32px 28px",
        width: "100%", maxWidth: 400,
        border: `1px solid ${current.color}40`,
        boxShadow: `0 0 60px ${current.color}18`,
        position: "relative",
        animation: "fadeIn 0.3s ease",
      }}>
        <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6, height: 6, borderRadius: 3,
              background: i === step ? current.color : "#1a1a2e",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
          background: `${current.color}15`, border: `1px solid ${current.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
        }}>{current.icon}</div>

        {/* Content */}
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "#e8e8f0", textAlign: "center", marginBottom: 12, lineHeight: 1.4 }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 14, color: "#6b6b80", textAlign: "center", lineHeight: 1.8, marginBottom: 28 }}>
          {current.desc}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          {isLast ? (
            <>
              <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer"
                onClick={dismiss}
                style={{
                  display: "block", textAlign: "center", padding: "14px", borderRadius: 14,
                  background: "linear-gradient(135deg,#00d97e,#3b82f6)", color: "#07070f",
                  fontWeight: 800, fontSize: 15, textDecoration: "none",
                }}>
                🤖 텔레그램 구독 시작하기
              </a>
              <button onClick={dismiss} style={{
                padding: "12px", borderRadius: 14,
                background: "transparent", border: "1px solid #1a1a2e",
                color: "#6b6b80", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>
                나중에 →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(s => s + 1)} style={{
                padding: "14px", borderRadius: 14,
                background: `linear-gradient(135deg, ${current.color}, ${current.color}aa)`,
                color: "#07070f", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer",
              }}>
                다음 →
              </button>
              {current.link ? (
                <Link href={current.link} onClick={dismiss} style={{
                  display: "block", textAlign: "center", padding: "12px", borderRadius: 14,
                  background: "transparent", border: "1px solid #1a1a2e",
                  color: "#6b6b80", fontWeight: 700, fontSize: 13, textDecoration: "none",
                }}>
                  지금 바로 써보기 →
                </Link>
              ) : (
                <button onClick={dismiss} style={{
                  padding: "12px", borderRadius: 14,
                  background: "transparent", border: "1px solid #1a1a2e",
                  color: "#6b6b80", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  건너뛰기
                </button>
              )}
            </>
          )}
        </div>

        {/* Close */}
        <button onClick={dismiss} style={{
          position: "absolute", top: 16, right: 16,
          background: "none", border: "none", color: "#3a3a50", fontSize: 20, cursor: "pointer",
        }}>✕</button>
      </div>
    </div>
  );
}
