import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    return (
      <span
        className="inline-flex items-center cursor-pointer"
        role="checkbox"
        aria-checked={!!checked}
        onClick={(e) => {
          e.stopPropagation()
          onCheckedChange?.(!checked)
        }}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only"
          tabIndex={-1}
          {...props}
        />
        <div className={cn(
          "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex items-center justify-center",
          checked ? "bg-primary text-primary-foreground" : "",
          className
        )}>
          {checked && <Check className="h-3 w-3" />}
        </div>
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
