"use client";

import { useEffect } from "react";
import type { Finish } from "@/lib/paint/paints";
import { useStudio } from "@/lib/studio-store";

const FINISH_KEYS: Record<string, Finish> = { "1": "matte", "2": "satin", "3": "gloss", "4": "metal" };

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function useShortcuts(onOpenHelp: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.isComposing) return;
      const state = useStudio.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) state.actions.redo();
          else state.actions.undo();
        } else if (key === "y") {
          event.preventDefault();
          state.actions.redo();
        } else if (key === "s") {
          event.preventDefault();
          state.actions.screenshot();
        }
        return;
      }

      if (event.code === "Space") {
        const onButton = (event.target as HTMLElement | null)?.closest("button, [role=slider]");
        if (onButton) return;
        event.preventDefault();
        if (!state.orbitHeld) useStudio.setState({ orbitHeld: true });
        return;
      }
      if (event.key === "Alt") {
        event.preventDefault();
        if (!state.pickerHeld) useStudio.setState({ pickerHeld: true });
        return;
      }
      if (event.repeat && !["[", "]"].includes(event.key)) return;

      switch (event.key) {
        case "b":
        case "B":
          state.setTool("brush");
          break;
        case "e":
        case "E":
          state.setTool("eraser");
          break;
        case "i":
        case "I":
          state.setTool("picker");
          break;
        case "[":
          state.setSize(state.size - (state.size > 20 ? 4 : 2));
          break;
        case "]":
          state.setSize(state.size + (state.size >= 20 ? 4 : 2));
          break;
        case "f":
        case "F":
          state.actions.resetView();
          break;
        case "?":
          onOpenHelp();
          break;
        default:
          if (FINISH_KEYS[event.key]) state.setFinish(FINISH_KEYS[event.key]);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") useStudio.setState({ orbitHeld: false });
      if (event.key === "Alt") useStudio.setState({ pickerHeld: false });
    };

    const release = () => useStudio.setState({ orbitHeld: false, pickerHeld: false });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [onOpenHelp]);
}
