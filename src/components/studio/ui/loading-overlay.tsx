"use client";

import { useProgress } from "@react-three/drei";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function LoadingCard({ label, progress }: { label: string; progress?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-64 flex-col gap-3 rounded-xl border bg-panel p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        {progress !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">{Math.round(progress)}%</span>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-300",
            progress === undefined && "w-1/3 animate-pulse"
          )}
          style={progress !== undefined ? { width: `${Math.max(6, progress)}%` } : undefined}
        />
      </div>
    </div>
  );
}

export function LoadingOverlay() {
  const status = useStudio((s) => s.modelStatus);
  const { progress, active } = useProgress();
  const visible = status === "loading";

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      {visible && (
        <LoadingCard
          label={active ? "Unboxing the miniature" : "Priming the surface"}
          progress={active ? progress : undefined}
        />
      )}
    </div>
  );
}
