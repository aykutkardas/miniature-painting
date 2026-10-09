"use client";

import { X } from "lucide-react";
import { useStudio } from "@/lib/studio-store";

export function CanvasHint() {
  const dismissed = useStudio((s) => s.hintDismissed);
  const ready = useStudio((s) => s.modelStatus === "ready");
  const dismiss = useStudio((s) => s.dismissHint);
  if (dismissed || !ready) return null;

  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-panel py-1.5 pr-1.5 pl-4 text-xs text-muted-foreground shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="text-pretty">
          {touch ? (
            <>
              <span className="text-foreground">Drag on the model</span> to paint · drag around it to orbit · pinch to zoom
            </>
          ) : (
            <>
              <span className="text-foreground">Drag on the model</span> to paint · drag the background to orbit · hold{" "}
              <span className="text-foreground">Space</span> to orbit anywhere
            </>
          )}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <X className="size-3.5" />
          <span className="sr-only">Dismiss tip</span>
        </button>
      </div>
    </div>
  );
}
