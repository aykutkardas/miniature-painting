"use client";

import type React from "react";

import { useRef, useState } from "react";
import {
  Circle,
  Eraser,
  Grip,
  Hand,
  Minus,
  Pencil,
  Plus,
  Square,
  Type,
  X,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SketchPicker } from "react-color";
import { darken, lighten } from "color2k";

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

interface BottomBarProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export default function BottomBar({
  selectedColor,
  setSelectedColor,
  brushSize,
  setBrushSize,
  onUndo,
  onRedo,
}: BottomBarProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTool, setSelectedTool] = useState("pencil");

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>({
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    setPosition({
      x: dragRef.current.startPosX + dx,
      y: dragRef.current.startPosY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Generate shades of the selected color
  const darkerShade = darken(selectedColor, 0.2);
  const lighterShade = lighten(selectedColor, 0.2);

  return (
    <div
      className={cn(
        "absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-row backdrop-blur-md bg-white/80 dark:bg-gray-900/80 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-1.5 select-none"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === "pencil" ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setSelectedTool("pencil")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pencil</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === "eraser" ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setSelectedTool("eraser")}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={onUndo}
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={onRedo}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-4 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium whitespace-nowrap">Size:</span>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3" />
            <Slider
              value={[brushSize]}
              min={1}
              max={50}
              step={1}
              onValueChange={(value) => setBrushSize(value[0])}
              className="w-24"
            />
            <Plus className="h-3 w-3" />
          </div>
          <span className="text-xs w-7">{brushSize}px</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Color:</span>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <div
                  className="h-5 w-5 rounded-full border border-gray-300 cursor-pointer"
                  style={{ backgroundColor: selectedColor }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <SketchPicker
                  color={selectedColor}
                  onChange={(color) => setSelectedColor(color.hex)}
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1">
              <div
                className="h-4 w-4 rounded-full border border-gray-300 cursor-pointer"
                style={{ backgroundColor: darkerShade }}
                onClick={() => setSelectedColor(darkerShade)}
              />
              <div
                className="h-4 w-4 rounded-full border border-gray-300 cursor-pointer"
                style={{ backgroundColor: selectedColor }}
                onClick={() => setSelectedColor(selectedColor)}
              />
              <div
                className="h-4 w-4 rounded-full border border-gray-300 cursor-pointer"
                style={{ backgroundColor: lighterShade }}
                onClick={() => setSelectedColor(lighterShade)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
