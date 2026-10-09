"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type IconButtonProps = ComponentProps<"button"> & {
  label: string;
  shortcut?: string[];
  active?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, side = "bottom", className, children, ...props },
  ref
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground/80 transition-colors outline-none",
            "hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60",
            "disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[18px]",
            active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            className
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <span className="flex items-center gap-0.5">
            {shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
