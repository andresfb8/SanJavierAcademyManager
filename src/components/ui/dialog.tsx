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

  const childrenArray = React.Children.toArray(children)
  const footerChildren = childrenArray.filter(
    (child) => React.isValidElement(child) && (child.type as any).displayName === 'DialogFooter'
  )
  const bodyChildren = childrenArray.filter(
    (child) => !React.isValidElement(child) || (child.type as any).displayName !== 'DialogFooter'
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Backdrop — deeper blur + darker */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      {/* Panel */}
      <div
        className={cn(
          // Base: white card, border, shadow, flex column
          "relative z-50 bg-card text-card-foreground flex flex-col",
          "border border-border/60",
          "shadow-2xl",
          // Mobile: full width, slide up from bottom, rounded top
          "w-full rounded-t-2xl max-h-[90svh]",
          // Desktop: centered, rounded all corners, max width
          "sm:w-full sm:max-w-lg sm:rounded-2xl sm:max-h-[85svh] sm:mx-4",
          // Animate in
          "animate-fade-in",
          className
        )}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Close button — refined */}
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 sm:px-6 sm:pt-6 sm:pb-4">
          {bodyChildren}
        </div>

        {/* Sticky footer — same 16px inset as the close button (right-4 top-4) */}
        {footerChildren.length > 0 && (
          <div className="flex-shrink-0 border-t border-border/60 bg-muted/30 p-4 rounded-b-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footerChildren}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1 mb-5 pr-8", // pr-8 leaves room for close button
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-bold leading-tight tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground mt-1", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2", className)}
      {...props}
    />
  )
}
DialogFooter.displayName = 'DialogFooter'

function DialogClose({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(DialogContext)
  return <button onClick={() => setOpen(false)} {...props}>{children}</button>
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
