import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface ClubIndicator {
  label: string
  value: string
  progressPct: number
  deltaText: string
  deltaTone: 'positive' | 'negative' | 'neutral'
}

interface ClubIndicatorsGridProps {
  indicators: ClubIndicator[]
  monthLabel: string
}

export function ClubIndicatorsGrid({ indicators, monthLabel }: ClubIndicatorsGridProps) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-foreground">Indicadores del club</CardTitle>
        <p className="text-xs text-muted-foreground">{monthLabel} · vs. mes anterior</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {indicators.map((indicator) => (
            <div key={indicator.label} className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {indicator.label}
              </p>
              <p className="font-num mt-1 text-2xl font-bold text-foreground">{indicator.value}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, indicator.progressPct))}%` }}
                />
              </div>
              <p
                className={cn(
                  'mt-1.5 text-xs font-medium',
                  indicator.deltaTone === 'positive' ? 'text-success' :
                    indicator.deltaTone === 'negative' ? 'text-destructive' :
                      'text-muted-foreground'
                )}
              >
                {indicator.deltaText}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
