"use client";

import { Github } from "lucide-react";

export default function FooterLinks() {
  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs"
      style={{ zIndex: 20 }}
    >
      <a
        href="https://github.com/aykutkardas/miniature-painting"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors"
        style={{ color: "rgba(65,155,249,0.5)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(65,155,249,1)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(65,155,249,0.5)")}
      >
        <Github className="w-4 h-4" />
      </a>
      <a
        href="https://twitter.com/aykutkardas"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors font-mono"
        style={{ color: "rgba(65,155,249,0.5)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(65,155,249,1)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(65,155,249,0.5)")}
      >
        @aykutkardas
      </a>
    </div>
  );
}
