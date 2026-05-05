import * as React from "react"
import { cn } from "@/lib/utils"

function Tooltip({ children, content, className }: { children: React.ReactNode; content: string; className?: string }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] leading-tight rounded-lg bg-slate-900 text-slate-50 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-[100] shadow-xl",
        className
      )}>
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  )
}

export { Tooltip }
