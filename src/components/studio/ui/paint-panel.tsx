"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Slider } from "@/components/ui/slider";
import { FINISHES, PAINT_POTS, type Finish } from "@/lib/paint/paints";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { Swatch } from "./swatch";

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function BrushSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  format = (v: number) => `${v}%`,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span id={`slider-${label}`} className="flex items-center gap-1.5">
          {label}
          {hint && <span className="font-mono text-[11px] text-muted-foreground">{hint}</span>}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <Slider
        aria-labelledby={`slider-${label}`}
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary"
      />
    </div>
  );
}

function BrushPreview() {
  const color = useStudio((s) => s.color);
  const tool = useStudio((s) => s.tool);
  const size = useStudio((s) => s.size);
  const softness = useStudio((s) => s.softness);
  const opacity = useStudio((s) => s.opacity);
  const diameter = 8 + (size / 100) * 36;
  const hardStop = 100 - softness * 0.95;

  return (
    <div aria-hidden className="flex size-12 items-center justify-center rounded-lg border bg-background">
      <div
        className="rounded-full"
        style={{
          width: diameter,
          height: diameter,
          opacity: tool === "eraser" ? 1 : opacity / 100,
          background: `radial-gradient(circle, ${tool === "eraser" ? "#7e8285" : color} ${hardStop}%, transparent 100%)`,
        }}
      />
    </div>
  );
}

export function PaintPanel() {
  const [expanded, setExpanded] = useState(false);
  const color = useStudio((s) => s.color);
  const finish = useStudio((s) => s.finish);
  const size = useStudio((s) => s.size);
  const softness = useStudio((s) => s.softness);
  const opacity = useStudio((s) => s.opacity);
  const recentColors = useStudio((s) => s.recentColors);
  const { setColor, setFinish, setSize, setSoftness, setOpacity, commitRecentColor } = useStudio.getState();

  const currentPot = PAINT_POTS.find((p) => p.color === color);

  return (
    <aside
      aria-label="Paint and brush"
      className={cn(
        "pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex flex-col rounded-2xl border bg-panel shadow-2xl backdrop-blur-md",
        "md:inset-x-auto md:top-24 md:right-4 md:bottom-auto md:w-72"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <ColorPicker />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{currentPot?.name ?? "Custom mix"}</span>
          <span className="font-mono text-xs text-muted-foreground uppercase">
            {color} · {FINISHES[finish].label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="paint-panel-body"
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 md:hidden"
        >
          <ChevronUp className={cn("size-4 transition-transform", !expanded && "rotate-180")} />
          <span className="sr-only">{expanded ? "Collapse brush settings" : "Expand brush settings"}</span>
        </button>
      </div>

      <div
        id="paint-panel-body"
        className={cn(
          "flex-col gap-5 overflow-y-auto border-t px-3 pt-3 pb-4 max-md:max-h-[50dvh] md:flex",
          expanded ? "flex" : "hidden"
        )}
      >
        <Section title="Paints">
          <div className="grid grid-cols-8 gap-2">
            {PAINT_POTS.map((pot) => (
              <Swatch
                key={pot.name}
                color={pot.color}
                finish={pot.finish}
                label={`${pot.name} (${FINISHES[pot.finish].label})`}
                selected={color === pot.color}
                onSelect={() => {
                  setColor(pot.color, pot.finish);
                  commitRecentColor();
                }}
              />
            ))}
          </div>
        </Section>

        {recentColors.length > 0 && (
          <Section title="Recent">
            <div className="grid grid-cols-8 gap-2">
              {recentColors.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  finish="matte"
                  label={`Recent color ${c}`}
                  selected={color === c && !currentPot}
                  onSelect={() => setColor(c)}
                />
              ))}
            </div>
          </Section>
        )}

        <Section title="Finish">
          <ToggleGroup.Root
            type="single"
            value={finish}
            onValueChange={(value) => value && setFinish(value as Finish)}
            aria-label="Paint finish"
            className="grid grid-cols-4 gap-1 rounded-lg bg-background p-1"
          >
            {(Object.keys(FINISHES) as Finish[]).map((key, index) => (
              <ToggleGroup.Item
                key={key}
                value={key}
                aria-label={`${FINISHES[key].label} finish (${index + 1})`}
                className="h-8 rounded-md text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 data-[state=on]:bg-accent data-[state=on]:text-foreground"
              >
                {FINISHES[key].label}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </Section>

        <Section title="Brush" aside={<BrushPreview />}>
          <div className="flex flex-col gap-4">
            <BrushSlider label="Size" hint="[ ]" value={size} min={1} max={100} onChange={setSize} format={(v) => String(v)} />
            <BrushSlider label="Softness" value={softness} onChange={setSoftness} />
            <BrushSlider label="Opacity" value={opacity} min={5} onChange={setOpacity} />
          </div>
        </Section>
      </div>
    </aside>
  );
}
