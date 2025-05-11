"use client";

import type React from "react";

import { useRef, useState, useEffect } from "react";
import {
  Hand,
  Minus,
  Plus,
  Undo,
  Redo,
  Brush,
  Trash,
  RotateCcw,
  Download,
  Camera,
  Upload,
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

interface ColorStorage {
  selectedColor: string;
  colorHistory: string[];
}

interface BottomBarProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  isSpacePressed: boolean;
  setIsSpacePressed: (isSpacePressed: boolean) => void;
  onResetCamera: () => void;
  onExportImage: () => void;
  onImportModel: () => void;
}

export default function BottomBar({
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
}: BottomBarProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [colorHistory, setColorHistory] = useState<string[]>([]);
  const [tempColor, setTempColor] = useState(selectedColor);

  // Load colors from localStorage on component mount
  useEffect(() => {
    const savedColors = localStorage.getItem(COLOR_STORAGE_KEY);
    if (savedColors) {
      try {
        const { selectedColor: savedColor, colorHistory: savedHistory } =
          JSON.parse(savedColors) as ColorStorage;
        setSelectedColor(savedColor);
        setColorHistory(savedHistory);
        setTempColor(savedColor);
      } catch (error) {
        console.error("Error loading saved colors:", error);
      }
    }
  }, []);

  // Update color history when selectedColor changes
  useEffect(() => {
    setColorHistory((prev) => {
      // Remove the color if it already exists in history
      const filtered = prev.filter((color) => color !== selectedColor);
      // Add new color to the beginning
      const updated = [selectedColor, ...filtered];
      // Keep only last 10 colors
      return updated.slice(0, 10);
    });
  }, [selectedColor]);

  // Save colors to localStorage whenever they change
  useEffect(() => {
    const colorStorage: ColorStorage = {
      selectedColor,
      colorHistory,
    };
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(colorStorage));
  }, [selectedColor, colorHistory]);

  // Update tempColor when selectedColor changes
  useEffect(() => {
    setTempColor(selectedColor);
  }, [selectedColor]);

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

  return (
    <div
      className={cn(
        "absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-row backdrop-blur-md bg-gradient-to-b from-white/80 to-white/20  rounded-xl shadow-lg p-1.5 select-none"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex items-center gap-1 ">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setIsSpacePressed(false);
                setSelectedColor("#ffffff");
                setBrushSize(8);
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(COLOR_STORAGE_KEY);
                window.location.reload();
              }}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset Model</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1 border-l border-gray-500/20">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onResetCamera}
              disabled={!isSpacePressed}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset Camera</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onExportImage}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Take Photo</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-1 border-l border-gray-500/20">
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
          <TooltipContent>Undo (⌘Z)</TooltipContent>
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
          <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-cente px-2 gap-1 border-l border-gray-500/20">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isSpacePressed ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsSpacePressed(true)}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View Mode (Space)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={!isSpacePressed ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsSpacePressed(false)}
              >
                <Brush className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Paint Mode (Space)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-4 ml-2 pl-2 border-l border-gray-500/20">
        <div className="flex items-center gap-2">
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

        <div className="flex items-center gap-1 bg-white/20 w-fit rounded-full p-1">
          <Popover>
            <PopoverTrigger asChild>
              <div
                className="h-5 w-5 rounded-full cursor-pointer"
                style={{ backgroundColor: selectedColor }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <SketchPicker
                disableAlpha
                color={tempColor}
                onChange={(color) => setTempColor(color.hex)}
                onChangeComplete={(color) => {
                  setSelectedColor(color.hex);
                }}
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-4 w-4 rounded-full",
                  colorHistory[index + 1] && "cursor-pointer"
                )}
                style={{
                  backgroundColor: colorHistory[index + 1] || "#00000033",
                }}
                onClick={() =>
                  colorHistory[index + 1] &&
                  setSelectedColor(colorHistory[index + 1])
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
