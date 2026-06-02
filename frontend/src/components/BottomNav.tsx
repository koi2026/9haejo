"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const C = {
  bg: "#07070f", card: "#111120", border: "#1a1a2e",
  text: "#e8e8f0", muted: "#6b6b80", green: "#00d97e", blue: "#3b82f6",
  grad: "linear-gradient(135deg,#00d97e 0%,#3b82f6 100%)",
};

const TABS = [
  { href: "/", icon: "🏠", label: "홈" },
  { href: "/briefings", icon: "📋", label: "브리핑" },
  { href: "/portfolio", icon: "📊", label: "포트폴리오" },
  { href: "/watchlist", icon: "⭐", label: "관심" },
  { href: "https://t.me/goohaejo_bot", icon: "📱", label: "텔레그램", external: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => setShow(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!show) return null;

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
      background: "rgba(7,7,15,0.96)", backdropFilter: "blur(16px)",
      borderTop: `1px solid ${C.border}`,
      display: "flex", justifyContent: "space-around", alignItems: "center",
      height: 62, paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map(tab => {
        const isActive = !tab.external && (tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href));
        const el = (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 12px", borderRadius: 12, transition: "all 0.15s",
            background: isActive ? `${C.green}10` : "transparent",
            minWidth: 52,
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: isActive ? 800 : 600,
              color: isActive ? C.green : C.muted,
              letterSpacing: 0.3,
            }}>{tab.label}</span>
            {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.green, marginTop: -2 }} />}
          </div>
        );
        if (tab.external) {
          return (
            <a key={tab.href} href={tab.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              {el}
            </a>
          );
        }
        return (
          <Link key={tab.href} href={tab.href} style={{ textDecoration: "none" }}>
            {el}
          </Link>
        );
      })}
    </nav>
  );
}
