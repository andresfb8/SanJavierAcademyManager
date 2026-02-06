import * as React from "react"
import { cn } from "@/lib/utils"

function Tooltip({ children, content, className }: { children: React.ReactNode; content: string; className?: string }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50",
        className
      )}>
        {content}
      </div>
    </div>
  )
}

export { Tooltip }
