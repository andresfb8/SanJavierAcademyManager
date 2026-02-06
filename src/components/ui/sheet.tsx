import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface SheetContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextType>({ open: false, setOpen: () => {} })

function Sheet({ children, open: controlledOpen, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
  const setOpen = onOpenChange || setUncontrolledOpen
  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>
}

function SheetTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(SheetContext)
  return <button onClick={() => setOpen(true)} {...props}>{children}</button>
}

function SheetContent({ children, className, side = "left" }: { children: React.ReactNode; className?: string; side?: "left" | "right" }) {
  const { open, setOpen } = React.useContext(SheetContext)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={cn(
        "fixed inset-y-0 z-50 w-72 bg-background p-6 shadow-lg transition-transform",
        side === "left" ? "left-0" : "right-0",
        className
      )}>
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 mb-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle }
