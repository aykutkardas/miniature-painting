"use client";

import { useCallback, useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StudioCanvas } from "./scene/studio-canvas";
import { CanvasHint } from "./ui/canvas-hint";
import { HelpDialog } from "./ui/help-dialog";
import { LoadingOverlay } from "./ui/loading-overlay";
import { PaintPanel } from "./ui/paint-panel";
import { ToolRail } from "./ui/tool-rail";
import { TopBar } from "./ui/top-bar";
import { useShortcuts } from "./use-shortcuts";

export function Studio() {
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useShortcuts(openHelp);

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={150}>
      <div className="absolute inset-0">
        <StudioCanvas />
      </div>
      <LoadingOverlay />
      <TopBar onOpenHelp={openHelp} />
      <ToolRail />
      <PaintPanel />
      <CanvasHint />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!bg-card !border-border !text-foreground !rounded-xl",
            description: "!text-muted-foreground",
            actionButton: "!bg-primary !text-primary-foreground",
          },
        }}
      />
    </TooltipProvider>
  );
}
