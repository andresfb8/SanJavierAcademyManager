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
    <Card className={cn('hover-lift border-border/40 shadow-sm relative overflow-hidden bg-white/60 backdrop-blur-sm', className)}>
      {/* Subtle background glow */}
      <div 
        className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-5 blur-2xl"
        style={{ backgroundColor: accentColor || 'var(--color-primary)' }}
      />
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest font-jakarta">
              {title}
            </p>
            <p className="text-3xl font-extrabold text-foreground tracking-tighter leading-none font-jakarta">
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-1.5 pt-1">
                <div className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  trend.value > 0 ? 'bg-emerald-50 text-emerald-600' : 
                  trend.value < 0 ? 'bg-rose-50 text-rose-600' : 
                  'bg-slate-50 text-slate-500'
                )}>
                  {trend.value > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trend.value < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner',
            iconClassName || 'bg-primary/5 text-primary'
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
