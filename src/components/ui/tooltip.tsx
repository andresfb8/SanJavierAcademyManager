import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  children: React.ReactNode
  content: string
  className?: string
  side?: 'top' | 'right'
}

function Tooltip({ children, content, className, side = 'top' }: TooltipProps) {
  const positionClasses = side === 'right'
    ? 'left-full top-1/2 -translate-y-1/2 ml-2'
    : 'bottom-full left-1/2 -translate-x-1/2 mb-2'

  const arrowClasses = side === 'right'
    ? 'absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900'
    : 'absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900'

  return (
    <div className="relative group inline-flex">
      {children}
      <div className={cn(
        "absolute px-3 py-2 text-[10px] leading-tight rounded-lg bg-slate-900 text-slate-50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity w-48 text-center pointer-events-none z-[100] shadow-xl",
        positionClasses,
        className
      )}>
        {content}
        <div className={arrowClasses} />
      </div>
    </div>
  )
}

export { Tooltip }
