"use client";

import type { CSSProperties } from "react";
import type { Finish } from "@/lib/paint/paints";
import { cn } from "@/lib/utils";

/** Paint-pot style background: metals get a sheen, gloss gets a highlight. */
export function swatchStyle(color: string, finish: Finish): CSSProperties {
  if (finish === "metal") {
    return {
      backgroundColor: color,
      backgroundImage:
        "linear-gradient(135deg, rgb(255 255 255 / 0.55) 0%, rgb(255 255 255 / 0) 38%, rgb(0 0 0 / 0.35) 70%, rgb(255 255 255 / 0.25) 100%)",
    };
  }
  if (finish === "gloss") {
    return {
      backgroundColor: color,
      backgroundImage:
        "radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.55) 0 12%, rgb(255 255 255 / 0) 30%)",
    };
  }
  return { backgroundColor: color };
}

export function Swatch({
  color,
  finish,
  label,
  selected,
  onSelect,
  className,
}: {
  color: string;
  finish: Finish;
  label: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      className={cn(
        "relative aspect-square w-full rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] transition-transform outline-none",
        "hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/70",
        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
        className
      )}
      style={swatchStyle(color, finish)}
    />
  );
}
