"use client";

import { HexColorInput, HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/studio-store";
import { swatchStyle } from "./swatch";

export function ColorPicker() {
  const color = useStudio((s) => s.color);
  const finish = useStudio((s) => s.finish);
  const setColor = useStudio((s) => s.setColor);
  const commitRecentColor = useStudio((s) => s.commitRecentColor);

  return (
    <Popover onOpenChange={(open) => !open && commitRecentColor()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Current paint ${color}. Open custom color picker`}
          className="size-11 shrink-0 rounded-full border-2 border-foreground/80 shadow-inner transition-transform outline-none hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/60"
          style={swatchStyle(color, finish)}
        />
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={12} className="w-60 border bg-card p-3">
        <div className="flex flex-col gap-3 [&_.react-colorful]:h-44 [&_.react-colorful]:w-full [&_.react-colorful__hue]:mt-3 [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-full [&_.react-colorful__pointer]:size-5 [&_.react-colorful__saturation]:rounded-lg [&_.react-colorful__saturation]:border-b-0">
          <HexColorPicker color={color} onChange={(value) => setColor(value)} />
          <label className="flex items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="font-mono text-sm text-muted-foreground">#</span>
            <span className="sr-only">Hex color</span>
            <HexColorInput
              color={color}
              onChange={(value) => setColor(value)}
              className="h-9 w-full bg-transparent font-mono text-sm uppercase outline-none"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
