"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Hand,
  Minus,
  Plus,
  Undo,
  Redo,
  Brush,
  Trash2,
  RotateCcw,
  Camera,
  FolderOpen,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus as PlusIcon,
  Trash,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SketchPicker } from "react-color";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STORAGE_KEY } from "./painting-board";

export const COLOR_STORAGE_KEY = "paint-color-history";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

interface ColorStorage {
  selectedColor: string;
  colorHistory: string[];
}

interface SidebarProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  isSpacePressed: boolean;
  setIsSpacePressed: (v: boolean) => void;
  onResetCamera: () => void;
  onExportImage: () => void;
  onImportModel: () => void;
  layers: Layer[];
  activeLayerId: string;
  onLayersChange: (layers: Layer[]) => void;
  onActiveLayerChange: (id: string) => void;
}

// ─── Section header ───────────────────────────────────────────────────────────
function Section({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-white/40 hover:text-white/60 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-150",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="mx-3 my-1 border-t border-white/[0.07]" />;
}

// ─── Icon button with tooltip ─────────────────────────────────────────────────
function IconBtn({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  danger,
  size = "md",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center rounded-md transition-colors",
            size === "md" ? "h-8 w-8" : "h-6 w-6",
            active
              ? "bg-[#419bf9]/20 text-[#419bf9]"
              : danger
              ? "text-white/40 hover:bg-red-500/15 hover:text-red-400"
              : "text-white/40 hover:bg-white/[0.07] hover:text-white/80",
            disabled && "pointer-events-none opacity-30"
          )}
        >
          <Icon className={size === "md" ? "h-4 w-4" : "h-3 w-3"} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({
  selectedColor,
  setSelectedColor,
  brushSize,
  setBrushSize,
  onUndo,
  onRedo,
  isSpacePressed,
  setIsSpacePressed,
  onResetCamera,
  onExportImage,
  onImportModel,
  layers,
  activeLayerId,
  onLayersChange,
  onActiveLayerChange,
}: SidebarProps) {
  const [colorHistory, setColorHistory] = useState<string[]>([]);
  const [tempColor, setTempColor] = useState(selectedColor);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Load color history on mount
  useEffect(() => {
    const saved = localStorage.getItem(COLOR_STORAGE_KEY);
    if (saved) {
      try {
        const { colorHistory: h } = JSON.parse(saved) as ColorStorage;
        setColorHistory(h);
      } catch {/* ignore */}
    }
  }, []);

  useEffect(() => { setTempColor(selectedColor); }, [selectedColor]);

  useEffect(() => {
    setColorHistory((prev) => {
      const filtered = prev.filter((c) => c !== selectedColor);
      return [selectedColor, ...filtered].slice(0, 10);
    });
  }, [selectedColor]);

  useEffect(() => {
    const s: ColorStorage = { selectedColor, colorHistory };
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(s));
  }, [selectedColor, colorHistory]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

  // ── Layer helpers ────────────────────────────────────────────────────────────
  const addLayer = () => {
    const id = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      color: selectedColor,
    };
    const updated = [newLayer, ...layers];
    onLayersChange(updated);
    onActiveLayerChange(id);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const updated = layers.filter((l) => l.id !== id);
    onLayersChange(updated);
    if (activeLayerId === id) onActiveLayerChange(updated[0].id);
  };

  const toggleVisibility = (id: string) => {
    onLayersChange(
      layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const toggleLock = (id: string) => {
    onLayersChange(
      layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
  };

  const renameLayer = (id: string, name: string) => {
    onLayersChange(layers.map((l) => (l.id === id ? { ...l, name } : l)));
    setRenamingId(null);
  };

  return (
    <TooltipProvider>
      <aside
        className="fixed right-0 top-0 h-screen w-[220px] flex flex-col select-none overflow-y-auto overflow-x-hidden"
        style={{
          background: "#131720",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          zIndex: 50,
        }}
      >
        {/* ── App title ─────────────────────────────────────────────────────── */}
        <div className="px-3 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <div
            className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: "#419bf9" }}
          >
            <Brush className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-white/80 tracking-wide truncate">
            Miniature Studio
          </span>
        </div>

        {/* ── Tools ─────────────────────────────────────────────────────────── */}
        <Section label="Tools">
          <div className="px-2 flex flex-col gap-1">
            {/* Mode */}
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] text-white/30 w-10">Mode</span>
              <div className="flex gap-1">
                <IconBtn
                  icon={Brush}
                  label="Paint Mode (Space)"
                  active={!isSpacePressed}
                  onClick={() => setIsSpacePressed(false)}
                />
                <IconBtn
                  icon={Hand}
                  label="View Mode (Space)"
                  active={isSpacePressed}
                  onClick={() => setIsSpacePressed(true)}
                />
              </div>
            </div>

            {/* Brush size */}
            <div className="flex flex-col gap-1 px-1 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Brush Size</span>
                <span className="text-[10px] font-mono text-white/50">{brushSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-3 w-3 text-white/25 flex-shrink-0" />
                <Slider
                  value={[brushSize]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={(v) => setBrushSize(v[0])}
                  className="flex-1"
                />
                <Plus className="h-3 w-3 text-white/25 flex-shrink-0" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Color ─────────────────────────────────────────────────────────── */}
        <Section label="Color">
          <div className="px-3 flex flex-col gap-2">
            {/* Active swatch + picker */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="h-8 w-8 rounded-md border border-white/10 flex-shrink-0 shadow-inner"
                    style={{ backgroundColor: selectedColor }}
                  />
                </PopoverTrigger>
                <PopoverContent
                  side="left"
                  align="start"
                  className="w-auto p-2 border-0"
                  style={{ background: "#1a2133" }}
                >
                  <SketchPicker
                    disableAlpha
                    color={tempColor}
                    onChange={(c) => setTempColor(c.hex)}
                    onChangeComplete={(c) => setSelectedColor(c.hex)}
                    styles={{
                      default: {
                        picker: { background: "#1a2133", boxShadow: "none" },
                      },
                    }}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/30">Active</span>
                <span className="text-[11px] font-mono text-white/60 uppercase">
                  {selectedColor}
                </span>
              </div>
            </div>

            {/* History swatches */}
            <div>
              <span className="text-[10px] text-white/25 block mb-1">Recent</span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <button
                    key={i}
                    className={cn(
                      "h-5 w-5 rounded border transition-all",
                      colorHistory[i]
                        ? "border-white/10 hover:scale-110 hover:border-white/30 cursor-pointer"
                        : "border-white/5 cursor-default"
                    )}
                    style={{
                      backgroundColor: colorHistory[i] || "rgba(255,255,255,0.04)",
                    }}
                    onClick={() => colorHistory[i] && setSelectedColor(colorHistory[i])}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Layers ────────────────────────────────────────────────────────── */}
        <Section label="Layers">
          <div className="px-2">
            {/* Add layer button */}
            <button
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors mb-1"
              onClick={addLayer}
            >
              <PlusIcon className="h-3 w-3" />
              Add Layer
            </button>

            <div className="flex flex-col gap-0.5">
              {layers.map((layer) => {
                const isActive = layer.id === activeLayerId;
                return (
                  <div
                    key={layer.id}
                    className={cn(
                      "group flex items-center gap-1 rounded px-1.5 py-1 cursor-pointer transition-colors",
                      isActive
                        ? "bg-[#419bf9]/15 text-white/90"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                    )}
                    onClick={() => onActiveLayerChange(layer.id)}
                  >
                    <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-30 flex-shrink-0" />

                    {/* Color dot */}
                    <div
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0 border border-white/10"
                      style={{ backgroundColor: layer.color }}
                    />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      {renamingId === layer.id ? (
                        <input
                          ref={renameRef}
                          defaultValue={layer.name}
                          className="w-full bg-transparent text-[11px] outline-none border-b border-[#419bf9]/60 text-white/90"
                          onBlur={(e) => renameLayer(layer.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              renameLayer(layer.id, e.currentTarget.value);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-[11px] truncate block"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(layer.id);
                          }}
                        >
                          {layer.name}
                        </span>
                      )}
                    </div>

                    {/* Layer controls — shown on hover or when active */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                      >
                        {layer.visible
                          ? <Eye className="h-3 w-3" />
                          : <EyeOff className="h-3 w-3 text-white/20" />
                        }
                      </button>
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); toggleLock(layer.id); }}
                      >
                        {layer.locked
                          ? <Lock className="h-3 w-3 text-yellow-400/70" />
                          : <Unlock className="h-3 w-3" />
                        }
                      </button>
                      {layers.length > 1 && (
                        <button
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-500/15 text-white/20 hover:text-red-400 transition-colors"
                          onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                        >
                          <Trash className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <Section label="Actions">
          <div className="px-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 flex-wrap">
              <IconBtn icon={Undo} label="Undo (⌘Z)" onClick={onUndo} />
              <IconBtn icon={Redo} label="Redo (⌘⇧Z)" onClick={onRedo} />
              <IconBtn
                icon={RotateCcw}
                label="Reset Camera"
                onClick={onResetCamera}
                disabled={!isSpacePressed}
              />
              <IconBtn icon={Camera} label="Export Image (⌘S)" onClick={onExportImage} />
              <IconBtn icon={FolderOpen} label="Import Model" onClick={onImportModel} />
            </div>

            <Divider />

            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(COLOR_STORAGE_KEY);
                window.location.reload();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset All
            </button>
          </div>
        </Section>

        {/* ── Spacer to push bottom content down ────────────────────────────── */}
        <div className="flex-1" />

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-2"
          style={{ fontSize: 10 }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-white/20 font-mono truncate">
            {isSpacePressed ? "VIEW MODE" : "PAINT MODE"}
          </span>
        </div>
      </aside>
    </TooltipProvider>
  );
}
