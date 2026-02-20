import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: {
    value: number
    label: string
  }
  className?: string
  iconClassName?: string
  accentColor?: string
}

export function StatCard({ title, value, icon: Icon, trend, className, iconClassName, accentColor }: StatCardProps) {
  return (
    <Card className={cn('stat-card-accent hover-lift border-border/60 shadow-[var(--shadow-card)] relative', className)}>
      {/* Colored left accent bar */}
      {accentColor && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      )}
      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground tracking-tight leading-none">
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-1">
                {trend.value > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : trend.value < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(
                    'text-xs font-semibold',
                    trend.value > 0 && 'text-emerald-600',
                    trend.value < 0 && 'text-rose-600',
                    trend.value === 0 && 'text-muted-foreground'
                  )}
                >
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            iconClassName || 'bg-primary/10 text-primary'
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
