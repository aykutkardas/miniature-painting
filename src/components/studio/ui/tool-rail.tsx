"use client";

import { Brush, Eraser, Pipette } from "lucide-react";
import { useStudio, type Tool } from "@/lib/studio-store";
import { IconButton } from "./icon-button";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof Brush }[] = [
  { id: "brush", label: "Brush", key: "B", icon: Brush },
  { id: "eraser", label: "Strip to primer", key: "E", icon: Eraser },
  { id: "picker", label: "Pick paint from model", key: "I", icon: Pipette },
];

export function ToolRail() {
  const tool = useStudio((s) => s.tool);
  const pickerHeld = useStudio((s) => s.pickerHeld);
  const setTool = useStudio((s) => s.setTool);
  const activeTool = pickerHeld ? "picker" : tool;

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="pointer-events-auto absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-xl border bg-panel p-1 shadow-lg backdrop-blur-md md:left-4"
    >
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <IconButton
          key={id}
          label={label}
          shortcut={[key]}
          side="right"
          active={activeTool === id}
          onClick={() => setTool(id)}
        >
          <Icon />
        </IconButton>
      ))}
    </div>
  );
}
