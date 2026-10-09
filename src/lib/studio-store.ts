import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PAINT_POTS, type Finish } from "./paint/paints";

export type Tool = "brush" | "eraser" | "picker";

export type ModelSource = {
  url: string;
  name: string;
  storageKey: string;
};

export const DEFAULT_MODEL: ModelSource = {
  url: "/models/miniature.glb",
  name: "Wanderer",
  storageKey: "model:default:v2",
};

type StudioActions = {
  undo: () => void;
  redo: () => void;
  clearPaint: () => void;
  resetView: () => void;
  screenshot: () => void;
};

const noop = () => {};

type StudioState = {
  tool: Tool;
  color: string;
  finish: Finish;
  size: number;
  softness: number;
  opacity: number;
  recentColors: string[];
  hintDismissed: boolean;

  model: ModelSource;
  modelStatus: "loading" | "ready" | "error";
  footprintRadius: number;
  canUndo: boolean;
  canRedo: boolean;
  orbitHeld: boolean;
  pickerHeld: boolean;

  actions: StudioActions;

  setTool: (tool: Tool) => void;
  setColor: (color: string, finish?: Finish) => void;
  setFinish: (finish: Finish) => void;
  setSize: (size: number) => void;
  setSoftness: (softness: number) => void;
  setOpacity: (opacity: number) => void;
  commitRecentColor: () => void;
  dismissHint: () => void;
  registerActions: (actions: Partial<StudioActions>) => void;
};

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      tool: "brush",
      color: PAINT_POTS[4].color,
      finish: PAINT_POTS[4].finish,
      size: 55,
      softness: 25,
      opacity: 100,
      recentColors: [],
      hintDismissed: false,

      model: DEFAULT_MODEL,
      modelStatus: "loading",
      footprintRadius: 0.35,
      canUndo: false,
      canRedo: false,
      orbitHeld: false,
      pickerHeld: false,

      actions: {
        undo: noop,
        redo: noop,
        clearPaint: noop,
        resetView: noop,
        screenshot: noop,
      },

      setTool: (tool) => set({ tool }),
      setColor: (color, finish) =>
        set((state) => ({
          color,
          finish: finish ?? state.finish,
          tool: "brush",
        })),
      setFinish: (finish) => set({ finish }),
      setSize: (size) => set({ size: Math.round(Math.min(100, Math.max(1, size))) }),
      setSoftness: (softness) => set({ softness }),
      setOpacity: (opacity) => set({ opacity }),
      commitRecentColor: () => {
        const { color, recentColors } = get();
        if (recentColors[0] === color) return;
        set({ recentColors: [color, ...recentColors.filter((c) => c !== color)].slice(0, 8) });
      },
      dismissHint: () => set({ hintDismissed: true }),
      registerActions: (actions) => set((state) => ({ actions: { ...state.actions, ...actions } })),
    }),
    {
      name: "miniature-studio:prefs",
      version: 1,
      partialize: (state) => ({
        color: state.color,
        finish: state.finish,
        size: state.size,
        softness: state.softness,
        opacity: state.opacity,
        recentColors: state.recentColors,
        hintDismissed: state.hintDismissed,
      }),
    }
  )
);
