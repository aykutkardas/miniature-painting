"use client";

import { useRef } from "react";
import {
  Camera,
  CircleHelp,
  Trash2,
  Focus,
  Github,
  Redo2,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_MODEL, useStudio } from "@/lib/studio-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconButton } from "./icon-button";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 rounded-xl border bg-panel p-1 shadow-lg backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

function Divider() {
  return <div aria-hidden className="mx-1 h-6 w-px bg-border" />;
}

export function TopBar({ onOpenHelp }: { onOpenHelp: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const model = useStudio((s) => s.model);
  const canUndo = useStudio((s) => s.canUndo);
  const canRedo = useStudio((s) => s.canRedo);
  const ready = useStudio((s) => s.modelStatus === "ready");
  const actions = useStudio((s) => s.actions);

  const onImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.glb$/i.test(file.name)) {
      toast.error("Unsupported file", { description: "Please choose a .glb model." });
      return;
    }
    const previous = useStudio.getState().model;
    if (previous.url !== DEFAULT_MODEL.url) URL.revokeObjectURL(previous.url);
    useStudio.setState({
      model: {
        url: URL.createObjectURL(file),
        name: file.name.replace(/\.glb$/i, ""),
        storageKey: `model:import:${file.name}:${file.size}`,
      },
      modelStatus: "loading",
    });
  };

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <Panel className="pr-1 pl-3">
          <div className="flex flex-col py-0.5 pr-2">
            <span className="text-sm leading-tight font-semibold tracking-tight">Miniature Studio</span>
            <span className="max-w-36 truncate text-xs leading-tight text-muted-foreground">
              {model.name}
            </span>
          </div>
          <Divider />
          <IconButton label="Open a .glb model" onClick={() => fileInput.current?.click()}>
            <Upload />
          </IconButton>
          {model.url !== DEFAULT_MODEL.url && (
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(model.url);
                useStudio.setState({ model: DEFAULT_MODEL, modelStatus: "loading" });
              }}
              className="h-8 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              Use default
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".glb,model/gltf-binary"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onImport}
          />
        </Panel>
      </div>

      <nav aria-label="Studio actions" className="pointer-events-auto flex flex-wrap justify-end gap-2">
        <Panel>
          <IconButton label="Undo" shortcut={[MOD, "Z"]} disabled={!canUndo} onClick={actions.undo}>
            <Undo2 />
          </IconButton>
          <IconButton label="Redo" shortcut={[MOD, "⇧", "Z"]} disabled={!canRedo} onClick={actions.redo}>
            <Redo2 />
          </IconButton>
        </Panel>
        <Panel>
          <IconButton label="Reset view" shortcut={["F"]} onClick={actions.resetView}>
            <Focus />
          </IconButton>
          <IconButton label="Save photo" shortcut={[MOD, "S"]} disabled={!ready} onClick={actions.screenshot}>
            <Camera />
          </IconButton>
          <IconButton label="Strip paint (back to primer)" disabled={!ready} onClick={actions.clearPaint}>
            <Trash2 />
          </IconButton>
          <Divider />
          <IconButton label="Shortcuts & help" shortcut={["?"]} onClick={onOpenHelp}>
            <CircleHelp />
          </IconButton>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/aykutkardas/miniature-painting"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Source on GitHub"
                className="hidden size-10 items-center justify-center rounded-lg text-foreground/80 transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:inline-flex [&_svg]:size-[18px]"
              >
                <Github />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">Source on GitHub</TooltipContent>
          </Tooltip>
        </Panel>
      </nav>
    </header>
  );
}
