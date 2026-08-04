import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export interface TrendPoint {
  label: string   // ej. "Mar 2026"
  value: number
}

interface MetricTrendChartProps {
  title: string
  points: TrendPoint[]
  valueFormatter?: (value: number) => string
}

export function MetricTrendChart({ title, points, valueFormatter }: MetricTrendChartProps) {
  const format = valueFormatter ?? ((v: number) => `${v}`)

  if (points.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No hay histórico suficiente para mostrar la tendencia de "{title}".
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">{title} — últimos {points.length} meses</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: any) => format(value)} />
          <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
