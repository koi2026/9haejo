"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const C = {
  bg: "#07070f", border: "#1a1a2e",
  text: "#e8e8f0", muted: "#6b6b80", green: "#00d97e",
};

const TABS = [
  { href: "/", icon: "🏠", label: "홈" },
  { href: "/briefings", icon: "📋", label: "브리핑" },
  { href: "/commands", icon: "⌨️", label: "커맨드" },
  { href: "/portfolio", icon: "📊", label: "포트폴리오" },
  { href: "/watchlist", icon: "⭐", label: "관심" },
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
      background: "rgba(7,7,15,0.97)", backdropFilter: "blur(20px)",
      borderTop: `1px solid ${C.border}`,
      display: "flex", justifyContent: "space-around", alignItems: "stretch",
      height: 58, paddingBottom: "env(safe-area-inset-bottom,0px)",
    }}>
      {TABS.map(tab => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} style={{ textDecoration: "none", flex: 1 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 2, position: "relative",
              borderTop: isActive ? `2px solid ${C.green}` : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 19, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: isActive ? 800 : 500,
                color: isActive ? C.green : C.muted, letterSpacing: 0.2,
              }}>{tab.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
