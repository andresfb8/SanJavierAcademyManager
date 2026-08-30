import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'

export interface CollectionSegment {
  label: string
  amount: number
  pct: number
  colorClass: string
  dotClass: string
}

interface MonthlyCollectionsCardProps {
  monthLabel: string
  total: number
  segments: CollectionSegment[]
}

export function MonthlyCollectionsCard({ monthLabel, total, segments }: MonthlyCollectionsCardProps) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-foreground">Estado de cobros del mes</CardTitle>
        <p className="text-xs text-muted-foreground">{monthLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-num text-2xl font-bold text-foreground">{formatCurrency(total)}</p>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={segment.colorClass}
              style={{ width: `${Math.min(100, Math.max(0, segment.pct))}%` }}
            />
          ))}
        </div>
        <div className="space-y-2">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2 text-sm">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', segment.dotClass)} />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="flex-1" />
              <span className="text-muted-foreground">{segment.pct}%</span>
              <span className="font-num w-20 text-right font-semibold text-foreground">
                {formatCurrency(segment.amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
