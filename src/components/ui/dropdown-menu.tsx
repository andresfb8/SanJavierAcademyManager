import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface DropdownMenuContextType {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
})

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>{children}</DropdownMenuContext.Provider>
}

function DropdownMenuTrigger({ children, asChild, className, ...props }: { children: React.ReactNode; asChild?: boolean; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: triggerRef,
      onClick: () => setOpen(!open),
    })
  }
  return <button ref={triggerRef} onClick={() => setOpen(!open)} className={className} {...props}>{children}</button>
}

function DropdownMenuContent({ children, className, align = "end" }: { children: React.ReactNode; className?: string; align?: "start" | "end" }) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })

  React.useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: align === "end" ? rect.right : rect.left,
      })
    }
  }, [open, align, triggerRef])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [open, setOpen, triggerRef])

  if (!open) return null
  return createPortal(
    <div
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className
      )}
      style={{
        position: "fixed",
        top: position.top,
        ...(align === "end" ? { right: window.innerWidth - position.left } : { left: position.left }),
      }}
    >
      {children}
    </div>,
    document.body
  )
}

function DropdownMenuItem({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }) {
  const { setOpen } = React.useContext(DropdownMenuContext)
  return (
    <div
      className={cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground", className)}
      onClick={() => { onClick?.(); setOpen(false) }}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
}

function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel }
