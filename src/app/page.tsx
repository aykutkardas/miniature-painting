import PaintingBoard from "./components/painting-board";
import { Github, Twitter, X } from "lucide-react";

export default function Home() {
  return (
    <div
      className="w-screen h-screen bg-neutral-900 relative"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      <PaintingBoard />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs">
        <a
          href="https://github.com/aykutkardas/miniature-painting"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/50 hover:text-white transition-colors"
        >
          <Github className="w-4 h-4" />
        </a>
        <a
          href="https://twitter.com/aykutkardas"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/50 hover:text-white transition-colors"
        >
          @aykutkardas
        </a>
      </div>
    </div>
  );
}
