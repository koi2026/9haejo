"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import NavSearch from "@/components/NavSearch";

const API = "https://outstanding-upliftment-production-5b02.up.railway.app";

const C = {
  bg: "#07070f", surface: "#0d0d1a", card: "#111120", border: "#1a1a2e",
  green: "#00d97e", red: "#ff4466", blue: "#3b82f6",
  text: "#e8e8f0", muted: "#6b6b80",
  grad: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
  amber: "#f59e0b", purple: "#a78bfa",
};

interface Message {
  role: "user" | "ai";
  content: string;
  ts: number;
  loading?: boolean;
}

const QUICK_QUESTIONS = [
  "NVDA 지금 매수 타이밍인가요?",
  "오늘 증시 분위기 어때요?",
  "AI 반도체 섹터 전망은?",
  "달러 강세 언제까지 계속될까요?",
  "TSLA vs NVDA 어느 종목이 더 좋아요?",
  "초보자가 처음 살 종목 추천해줘",
  "연준 금리 인상이 주식에 미치는 영향?",
  "VIX 지수가 높으면 어떻게 해야 하나요?",
];

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: C.green,
          animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      gap: 10, alignItems: "flex-start",
      marginBottom: 14,
      animation: "fadeSlideUp 0.25s ease",
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: isUser ? C.blue + "30" : C.grad,
        border: `1px solid ${isUser ? C.blue + "40" : "transparent"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isUser ? 14 : 16,
      }}>
        {isUser ? "👤" : "🤖"}
      </div>
      {/* Bubble */}
      <div style={{
        maxWidth: "76%",
        padding: "12px 16px",
        borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
        background: isUser ? `${C.blue}20` : C.card,
        border: `1px solid ${isUser ? C.blue + "30" : C.border}`,
        fontSize: 14, color: C.text, lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {msg.loading ? <TypingDots /> : msg.content}
      </div>
    </div>
  );
}

const STORAGE_KEY = "9haejo_chat_history_v1";
const INITIAL_MSG: Message = {
  role: "ai",
  content: "안녕하세요! 저는 구해조 AI 어시스턴트입니다. 🤖\n\n미국 주식, 시장 동향, 투자 전략에 대해 무엇이든 물어보세요.\n실시간 시세 데이터를 참고해 답변드립니다.",
  ts: 0,
};

function loadHistory(): Message[] {
  if (typeof window === "undefined") return [INITIAL_MSG];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Message[];
      if (parsed.length > 0) return parsed;
    }
  } catch {}
  return [INITIAL_MSG];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    setMessages(loadHistory());
    setHistoryLoaded(true);
  }, []);

  // Save history to localStorage whenever messages change
  useEffect(() => {
    if (!historyLoaded) return;
    try {
      // Keep last 50 messages
      const toSave = messages.filter(m => !m.loading).slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [messages, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, ts: Date.now() };
    const loadingMsg: Message = { role: "ai", content: "", ts: Date.now() + 1, loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      const r = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const d = await r.json();
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.loading);
        return [...withoutLoading, { role: "ai", content: d.reply || "응답을 가져올 수 없습니다.", ts: Date.now() }];
      });
    } catch {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.loading);
        return [...withoutLoading, { role: "ai", content: "⚠️ 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", ts: Date.now() }];
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    const fresh: Message = { role: "ai", content: "대화가 초기화되었습니다. 새로운 질문을 입력해주세요! 🤖", ts: Date.now() };
    setMessages([fresh]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea:focus { outline: none; border-color: #00d97e !important; box-shadow: 0 0 0 3px #00d97e15; }
        textarea { resize: none; }
        .quick-q:hover { background: #1a1a2e !important; color: #e8e8f0 !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.97)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#07070f" }}>9</div>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>구해조</span>
            </Link>
            <span style={{ fontSize: 11, color: C.muted }}>/</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>🤖 AI 챗</span>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${C.green}20`, color: C.green, fontWeight: 700 }}>BETA</span>
              {messages.filter(m => !m.loading && m.role === "user").length > 0 && (
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${C.muted}20`, color: C.muted, fontWeight: 700 }}>
                  {messages.filter(m => !m.loading && m.role === "user").length}개 대화
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={clearChat} style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🗑 초기화
            </button>
            <NavSearch />
          </div>
        </div>
      </nav>

      {/* 챗 헤더 */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 20px", flexShrink: 0, background: C.surface }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
            <span style={{ fontSize: 12, color: C.green, fontFamily: "monospace" }}>Claude AI · 실시간 시세 연동</span>
          </div>
          {/* 빠른 질문 */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_QUESTIONS.slice(0, 4).map((q, i) => (
              <button key={i} className="quick-q" onClick={() => sendMessage(q)}
                style={{
                  padding: "5px 12px", borderRadius: 16,
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.muted, fontSize: 11, cursor: "pointer",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}>
                {q.length > 20 ? q.slice(0, 20) + "…" : q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", paddingBottom: 140 }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(7,7,15,0.97)", backdropFilter: "blur(20px)",
        borderTop: `1px solid ${C.border}`,
        padding: "12px 20px", paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {/* 추가 빠른 질문 (모바일) */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {QUICK_QUESTIONS.slice(4).map((q, i) => (
              <button key={i} className="quick-q" onClick={() => sendMessage(q)}
                style={{
                  padding: "4px 12px", borderRadius: 14, flexShrink: 0,
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.muted, fontSize: 11, cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                {q.length > 16 ? q.slice(0, 16) + "…" : q}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="NVDA 지금 사도 될까요? (Shift+Enter로 줄바꿈)"
              rows={Math.min(4, Math.max(1, input.split("\n").length))}
              disabled={isLoading}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 14,
                background: C.surface, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 14, lineHeight: 1.5,
                fontFamily: "inherit",
                transition: "border-color 0.15s",
                opacity: isLoading ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: isLoading || !input.trim() ? `${C.green}30` : C.grad,
                border: "none", cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, transition: "all 0.15s",
              }}>
              {isLoading ? "⏳" : "↑"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: "center" }}>
            AI 답변은 참고용입니다. 투자 결정은 본인 판단으로 하세요. ·{" "}
            <a href="https://t.me/goohaejo_bot" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: "none" }}>
              텔레그램에서 더 많은 기능 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
