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
}

export function StatCard({ title, value, icon: Icon, trend, className, iconClassName }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1.5">
                {trend.value > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : trend.value < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.value > 0 && 'text-green-600',
                    trend.value < 0 && 'text-red-600',
                    trend.value === 0 && 'text-muted-foreground'
                  )}
                >
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
                <span className="text-sm text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn('rounded-lg p-3', iconClassName || 'bg-primary/10 text-primary')}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
