import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface AttentionAlert {
  id: string
  title: string
  sub: string
  onNavigate: () => void
}

interface AttentionAlertsCardProps {
  alerts: AttentionAlert[]
}

export function AttentionAlertsCard({ alerts }: AttentionAlertsCardProps) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-foreground">Requiere tu atención</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Todo al día, sin alertas activas.</p>
        ) : (
          alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={alert.onNavigate}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition-colors hover:bg-secondary/60"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{alert.title}</span>
                <span className="block text-xs text-muted-foreground">{alert.sub}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}
