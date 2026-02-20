import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextType>({ open: false, setOpen: () => { } })

function Dialog({ children, open: controlledOpen, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
  const setOpen = onOpenChange || setUncontrolledOpen
  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>
}

function DialogTrigger({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(DialogContext)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, { onClick: () => setOpen(true) })
  }
  return <button onClick={() => setOpen(true)} {...props}>{children}</button>
}

function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = React.useContext(DialogContext)
  if (!open) return null

  // Separate DialogFooter children from the rest so the footer is always sticky
  const childrenArray = React.Children.toArray(children)
  const footerChildren = childrenArray.filter(
    (child) => React.isValidElement(child) && (child.type as any).displayName === 'DialogFooter'
  )
  const bodyChildren = childrenArray.filter(
    (child) => !React.isValidElement(child) || (child.type as any).displayName !== 'DialogFooter'
  )

  return createPortal(
    // On mobile: flex column anchored to bottom (bottom sheet)
    // On sm+: centered modal (original behavior)
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      {/* Panel */}
      <div
        className={cn(
          // Base
          "relative z-50 bg-background shadow-xl border flex flex-col",
          // Mobile: full width, rounded top corners, up to 90vh
          "w-full rounded-t-2xl max-h-[90svh]",
          // Desktop: centered card, rounded all corners, constrained width
          "sm:w-full sm:max-w-lg sm:rounded-2xl sm:max-h-[90svh] sm:mx-4",
          className
        )}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {/* Close button */}
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 z-10">
          <X className="h-4 w-4" />
        </button>
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {bodyChildren}
        </div>
        {/* Sticky footer */}
        {footerChildren.length > 0 && (
          <div className="border-t bg-background px-4 sm:px-6 py-3 flex-shrink-0 pb-[env(safe-area-inset-bottom,12px)]">
            {footerChildren}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}


function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
}
DialogFooter.displayName = 'DialogFooter'

function DialogClose({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(DialogContext)
  return <button onClick={() => setOpen(false)} {...props}>{children}</button>
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
