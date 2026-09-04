import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface FilterChipSelectProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FilterChipSelect({ label, options, value, onChange, className }: FilterChipSelectProps) {
  return (
    <div className={cn('flex h-9 items-center gap-1.5 rounded-full border border-input bg-background pl-3 pr-2.5', className)}>
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full appearance-none bg-transparent border-0 p-0 pr-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-0"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 pointer-events-none" />
    </div>
  )
}
