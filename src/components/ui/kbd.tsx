import * as React from "react"

import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 bg-current/10 px-1 font-mono text-[11px] leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
