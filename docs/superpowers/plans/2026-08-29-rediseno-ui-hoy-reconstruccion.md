# Reconstrucción de "Hoy" (Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir `src/pages/DashboardPage.tsx` para que coincida exactamente con el mock de "Hoy" (`san javier.pen`, nodo `p2DVS`), eliminando todo el código muerto o no acorde al diseño (ramas de entrenador, KPIs configurables, gráficos antiguos, `IntelligenceCards`, `SmartAlertsPanel`) y sustituyéndolo por 4 componentes nuevos y enfocados.

**Architecture:** Cuatro componentes de presentación pura nuevos en `src/components/shared/dashboard/` (`ClubIndicatorsGrid`, `MonthlyCollectionsCard`, `TodayClassesCard`, `AttentionAlertsCard`), cada uno recibiendo datos ya calculados por props — ninguno lee `useDataStore` directamente. `DashboardPage.tsx` se reescribe por completo para calcular esos datos (reutilizando la mayor parte de la lógica de negocio ya existente) y orquestar los 4 componentes.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4 (tokens de la Fase 1: `--color-success`, `--color-warning`, `--color-destructive`, `--color-accent`), Zustand (`useDataStore`), sin gráficos (se elimina la dependencia de `recharts` en este archivo).

Reference spec: `docs/superpowers/specs/2026-08-29-rediseno-ui-hoy-reconstruccion-design.md`

---

## Task 1: Borrar componentes y helpers que quedan sin uso

**Files:**
- Delete: `src/components/shared/analytics/IntelligenceCards.tsx`
- Delete: `src/components/shared/dashboard/SmartAlertsPanel.tsx`
- Delete: `src/lib/dashboard-alerts.ts`
- Delete: `src/lib/dashboard-alerts.test.ts`

- [ ] **Step 1: Confirmar que estos 4 archivos no tienen más consumidores que los que se van a borrar en este plan**

Run:

```bash
grep -rn "IntelligenceCards" src --include="*.tsx" --include="*.ts"
grep -rn "SmartAlertsPanel" src --include="*.tsx" --include="*.ts"
grep -rn "dashboard-alerts" src --include="*.tsx" --include="*.ts"
```

Expected: los únicos resultados son los propios archivos que se van a borrar y
`src/pages/DashboardPage.tsx` (que se reescribe en la Task 6 de este plan, no
antes). Si aparece cualquier OTRO archivo, STOP y reporta — no borres nada
hasta confirmar que de verdad no tiene más usos.

- [ ] **Step 2: Confirmar que `coach-stats.ts` y `court-utilization.ts` (usados por `IntelligenceCards.tsx`) NO se borran, porque tienen otros consumidores**

Run:

```bash
grep -rln "computeCoachStats\|from '@/lib/coach-stats'" src --include="*.tsx" --include="*.ts"
grep -rln "computeCourtUtilization\|getUnderutilizedSlots\|from '@/lib/court-utilization'" src --include="*.tsx" --include="*.ts"
```

Expected: además de `IntelligenceCards.tsx`, aparecen `src/components/shared/analytics/CoachRankingTab.tsx` (para `coach-stats.ts`) y `src/components/shared/analytics/KPIsTab.tsx` (para `court-utilization.ts`). Estos dos archivos de `lib/` NO se tocan en este plan — solo se borra `IntelligenceCards.tsx` y `SmartAlertsPanel.tsx` (y el helper `dashboard-alerts.ts`, que sí es exclusivo de `SmartAlertsPanel`).

- [ ] **Step 3: Borrar los 4 archivos**

```bash
git rm src/components/shared/analytics/IntelligenceCards.tsx
git rm src/components/shared/dashboard/SmartAlertsPanel.tsx
git rm src/lib/dashboard-alerts.ts
git rm src/lib/dashboard-alerts.test.ts
```

- [ ] **Step 4: Verificar que el build y los tests siguen pasando (aparte del error esperado en `DashboardPage.tsx`)**

Run: `npm run build`
Expected: falla con errores en `src/pages/DashboardPage.tsx` del tipo `Cannot find module '@/components/shared/analytics/IntelligenceCards'` y `Cannot find module '@/components/shared/dashboard/SmartAlertsPanel'`. Esto es el error esperado y temporal — se resuelve en la Task 6 de este plan. Si aparece CUALQUIER OTRO error (en un archivo que no sea `DashboardPage.tsx`), detente e investiga antes de continuar.

Run: `npm test`
Expected: pasa igual que antes (146 tests) — `dashboard-alerts.test.ts` ya no existe, así que sus tests simplemente dejan de ejecutarse, no fallan.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: borrar IntelligenceCards, SmartAlertsPanel y dashboard-alerts sin uso"
```

Nota en el reporte: el build queda roto a propósito hasta la Task 6 — es el comportamiento esperado, no un defecto de esta tarea.

---

## Task 2: Crear `ClubIndicatorsGrid`

**Files:**
- Create: `src/components/shared/dashboard/ClubIndicatorsGrid.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
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
```

- [ ] **Step 2: Verificar que el archivo compila de forma aislada**

Run: `npx tsc --noEmit src/components/shared/dashboard/ClubIndicatorsGrid.tsx 2>&1 | grep -v "Cannot find module '@/"`
Expected: sin salida (los únicos errores esperados en este punto son los `Cannot find module '@/...'` de las importaciones con alias, que `tsc` no resuelve fuera del proyecto completo — por eso se filtran; el resto del archivo no debe tener errores de sintaxis ni de tipos propios).

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/dashboard/ClubIndicatorsGrid.tsx
git commit -m "feat: crear ClubIndicatorsGrid para el nuevo dashboard Hoy"
```

---

## Task 3: Crear `MonthlyCollectionsCard`

**Files:**
- Create: `src/components/shared/dashboard/MonthlyCollectionsCard.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
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
```

- [ ] **Step 2: Verificar que el archivo compila de forma aislada**

Run: `npx tsc --noEmit src/components/shared/dashboard/MonthlyCollectionsCard.tsx 2>&1 | grep -v "Cannot find module '@/"`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/dashboard/MonthlyCollectionsCard.tsx
git commit -m "feat: crear MonthlyCollectionsCard para el nuevo dashboard Hoy"
```

---

## Task 4: Crear `TodayClassesCard`

**Files:**
- Create: `src/components/shared/dashboard/TodayClassesCard.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface TodayClassRow {
  id: string
  time: string
  name: string
  meta: string
  attendanceLabel: string
}

interface TodayClassesCardProps {
  rows: TodayClassRow[]
}

export function TodayClassesCard({ rows }: TodayClassesCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
        <CardTitle className="text-sm font-bold text-foreground">Clases de hoy</CardTitle>
        <button
          onClick={() => navigate('/agenda')}
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver agenda
        </button>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-200" />
            <p className="text-sm font-medium text-slate-400">Libre hoy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-4 rounded-2xl bg-slate-50/30 p-3">
                <div className="w-12 shrink-0 text-center">
                  <span className="text-xs font-black text-slate-500">{row.time}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-slate-700">{row.name}</h4>
                  <p className="truncate text-[11px] font-medium text-slate-400">{row.meta}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{row.attendanceLabel}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar que el archivo compila de forma aislada**

Run: `npx tsc --noEmit src/components/shared/dashboard/TodayClassesCard.tsx 2>&1 | grep -v "Cannot find module '@/"`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/dashboard/TodayClassesCard.tsx
git commit -m "feat: crear TodayClassesCard para el nuevo dashboard Hoy"
```

---

## Task 5: Crear `AttentionAlertsCard`

**Files:**
- Create: `src/components/shared/dashboard/AttentionAlertsCard.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
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
```

- [ ] **Step 2: Verificar que el archivo compila de forma aislada**

Run: `npx tsc --noEmit src/components/shared/dashboard/AttentionAlertsCard.tsx 2>&1 | grep -v "Cannot find module '@/"`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/dashboard/AttentionAlertsCard.tsx
git commit -m "feat: crear AttentionAlertsCard para el nuevo dashboard Hoy"
```

---

## Task 6: Reescribir `DashboardPage.tsx`

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (reemplazo completo)

Este archivo pasa de ~1524 líneas a ~420. Se eliminan: las ramas `isCoach`
completas (sección "Coach-First Interface", los 6 `StatCard` de entrenador,
`currentCoachId`, `coachHoursThisMonth`, `coachAssignedPlayers`,
`coachTotalGroups`, `coachTotalPrivateLessons`, `coachIncompleteGroups`,
`activeClass`), la fila de KPIs configurable antigua y su diálogo
(`kpiConfig`, `defaultKpiConfig`, `KPI_STORAGE_KEY`, `showKpiDialog`,
`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`,
`Checkbox`, `Label`), los 4 gráficos de recharts y todo lo que solo los
alimentaba (`attendanceData`, `levelData`, `financialData`,
`chartCollapsed`/`toggleChartCollapsed`, el import de `recharts`,
`CHART_COLORS`, `tooltipStyle`), y los imports que ya estaban muertos antes
de esta tarea (`StatusBadge`, `formatDate`, `Badge`, `useEvaluationsQuery`,
`useMatchReportsQuery`, `useInvoicesQuery`, `useClassReviewsQuery`). Se
mantiene intacto: el topbar, la fila de 4 KPIs, `visibleActivities` +
`ActivityFeed`, y toda la lógica de cálculo de pagos/rotación/ocupación que
alimenta tanto los KPIs existentes como los indicadores nuevos.

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import { ClubIndicatorsGrid, type ClubIndicator } from '@/components/shared/dashboard/ClubIndicatorsGrid'
import { MonthlyCollectionsCard, type CollectionSegment } from '@/components/shared/dashboard/MonthlyCollectionsCard'
import { TodayClassesCard, type TodayClassRow } from '@/components/shared/dashboard/TodayClassesCard'
import { AttentionAlertsCard, type AttentionAlert } from '@/components/shared/dashboard/AttentionAlertsCard'
import {
  Users,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Search,
  Plus,
} from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'director' || user?.role === 'coordinador'
  const canReadPayments = hasPermission(user?.role as UserRole, 'payments', 'read')
  const {
    players,
    groups,
    enrollments,
    activities,
    payments: allBasePayments,
    eventPayments,
    privateLessonPayments,
    attendance,
    events,
    evaluations,
  } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // ── KPI calculations ──────────────────────────────────────────────
  const activePlayers = players.filter((p) => p.status === 'activo').length
  const activeGroups = groups.filter((g) => isGroupCurrentlyActive(g, now)).length

  const allPayments = useMemo(
    () => normalizeAllPayments(allBasePayments, eventPayments, privateLessonPayments ?? [], events),
    [allBasePayments, eventPayments, privateLessonPayments, events]
  )

  const currentMonthAllPayments = allPayments.filter(
    (p) => p.billingMonth === currentMonth && p.billingYear === currentYear
  )

  const currentRevenue = currentMonthAllPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const currentPending = currentMonthAllPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const totalCurrentMonth = currentMonthAllPayments
    .filter((p) => p.status !== 'cancelado')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const collectionRate = totalCurrentMonth > 0 ? Math.round((currentRevenue / totalCurrentMonth) * 100) : 0

  const monthStart = new Date(currentYear, currentMonth - 1, 1)
  const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59)
  const altasEsteMes = players.filter(
    (p) => p.registrationDate >= monthStart && p.registrationDate <= monthEnd
  ).length
  const { bajasEsteMes } = useMemo(() => {
    const nextMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)

    const playersActiveInMonth = players.filter(p => {
      const pEnrols = enrollments.filter(e => e.playerId === p.id)
      return pEnrols.some(e => {
        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
        return eStart <= monthEnd && (!eEnd || eEnd >= monthStart)
      })
    })

    const trueBajas = playersActiveInMonth.filter(p => {
      const pEnrols = enrollments.filter(e => e.playerId === p.id)

      const isActiveAtEnd = pEnrols.some(e => {
        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
        return eStart <= monthEnd && (!eEnd || eEnd > monthEnd)
      })

      if (isActiveAtEnd) return false

      const hasNextMonthEnrollment = pEnrols.some(e => {
        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        return eStart > monthEnd && eStart <= nextMonthEnd
      })

      return !hasNextMonthEnrollment
    }).length

    return { bajasEsteMes: trueBajas }
  }, [players, enrollments, currentMonth, currentYear, monthStart, monthEnd])

  const rotationDivisor = activePlayers + bajasEsteMes
  const rotationIndex = rotationDivisor > 0
    ? Math.round(((altasEsteMes + bajasEsteMes) / rotationDivisor) * 100)
    : 0
  const churnRate = rotationDivisor > 0
    ? Math.round((bajasEsteMes / rotationDivisor) * 100)
    : 0

  const today = now.getDay()
  const todayGroups = groups.filter(
    (g) => isGroupCurrentlyActive(g, now) && g.schedule.some((s) => s.dayOfWeek === today)
  )

  const classesInProgress = useMemo(() => {
    return todayGroups.filter((g) => {
      const slot = g.schedule.find((s) => s.dayOfWeek === today)
      if (!slot) return false
      const [startH, startM] = slot.startTime.split(':').map(Number)
      const [endH, endM] = slot.endTime.split(':').map(Number)
      const start = new Date(now)
      start.setHours(startH, startM, 0, 0)
      const end = new Date(now)
      end.setHours(endH, endM, 0, 0)
      return now >= start && now <= end
    }).length
  }, [todayGroups, today])

  const netPlayerChange = altasEsteMes - bajasEsteMes

  const weekAttendanceStats = useMemo(() => {
    const rangeRate = (start: Date, end: Date) => {
      let present = 0
      let total = 0
      for (const record of attendance) {
        const recordDate = new Date(record.date)
        if (recordDate < start || recordDate > end) continue
        for (const entry of record.records) {
          total++
          if (entry.status === 'presente') present++
        }
      }
      return total > 0 ? Math.round((present / total) * 100) : 0
    }

    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(weekStart.getDate() - 7)
    const prevWeekEnd = new Date(weekEnd)
    prevWeekEnd.setDate(weekEnd.getDate() - 7)

    const current = rangeRate(weekStart, weekEnd)
    const previous = rangeRate(prevWeekStart, prevWeekEnd)
    return { current, diff: current - previous }
  }, [attendance, now])

  const pendingPlayersCount = useMemo(() => {
    return new Set(
      currentMonthAllPayments.filter((p) => p.status === 'pendiente').map((p) => p.playerId)
    ).size
  }, [currentMonthAllPayments])

  // ── Occupancy calculation ─────────────────────────────────────────
  const occupancyStats = useMemo(() => {
    const classGroups = groups.filter(g => isGroupCurrentlyActive(g, now))
    const totalCapacity = classGroups.reduce((sum, g) => sum + (g.maxCapacity || 0), 0)
    const totalOccupied = classGroups.reduce((sum, g) => sum + (g.currentEnrollment || 0), 0)
    const rate = totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0
    return { totalCapacity, totalOccupied, rate }
  }, [groups, now])

  // ── Evolucion de 12 meses (solo se usa aqui para el valor del MES ANTERIOR:
  // indice [10]. El indice [11] es el mes en curso, calculado tambien arriba
  // con una formula mas simple — se aceptan ambas formulas conviviendo, ya
  // convivian asi antes de esta tarea) ──────────────────────────────────
  const evolutionData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(currentYear, currentMonth - 1 - (11 - i), 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()

      const monthPayments = allPayments.filter(p => p.billingMonth === m && p.billingYear === y)
      const revenue = monthPayments.filter(p => p.status === 'pagado').reduce((sum, p) => sum + Number(p.amount || 0), 0)

      const mEnd = new Date(y, m, 0, 23, 59, 59)
      const totalBilled = monthPayments.filter(p => p.status !== 'cancelado').reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const monthCollectionRate = totalBilled > 0 ? Math.round((revenue / totalBilled) * 100) : 0

      const mStart = new Date(y, m - 1, 1)
      const nextMonthEnd = new Date(y, m + 1, 0, 23, 59, 59)

      const altas = players.filter(p => {
        const regDate = p.registrationDate instanceof Date ? p.registrationDate : new Date(p.registrationDate)
        return regDate >= mStart && regDate <= mEnd
      }).length

      const playersActiveInMonth = players.filter(p => {
        const pEnrols = enrollments.filter(e => e.playerId === p.id)
        return pEnrols.some(e => {
          const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
          const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
          return eStart <= mEnd && (!eEnd || eEnd >= mStart)
        })
      })

      const bajas = playersActiveInMonth.filter(p => {
        const pEnrols = enrollments.filter(e => e.playerId === p.id)

        const isActiveAtEnd = pEnrols.some(e => {
          const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
          const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
          return eStart <= mEnd && (!eEnd || eEnd > mEnd)
        })

        if (isActiveAtEnd) return false

        const hasNextMonthEnrollment = pEnrols.some(e => {
          const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
          return eStart > mEnd && eStart <= nextMonthEnd
        })

        return !hasNextMonthEnrollment
      }).length

      const activeAtEnd = playersActiveInMonth.length - bajas
      const monthRotationDivisor = activeAtEnd + bajas

      const isStartMonth = m === 2 && y === 2026

      const monthRotationIndex = (monthRotationDivisor > 0 && !isStartMonth) ? Math.round(((altas + bajas) / monthRotationDivisor) * 100) : 0
      const monthChurnRate = monthRotationDivisor > 0 ? Math.round((bajas / monthRotationDivisor) * 100) : 0

      const groupsInMonth = groups.filter(g => {
        const gStart = g.startDate instanceof Date ? g.startDate : new Date(g.startDate)
        const gEnd = g.endDate ? (g.endDate instanceof Date ? g.endDate : new Date(g.endDate)) : null
        return g.isActive && gStart <= mEnd && (!gEnd || gEnd >= mStart)
      })

      const monthCapacity = groupsInMonth.reduce((sum, g) => sum + (g.maxCapacity || 0), 0)

      const occupiedInMonth = enrollments.filter(e => {
        if (!groupsInMonth.some(g => g.id === e.groupId)) return false

        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null

        return e.isActive && eStart <= mEnd && (!eEnd || eEnd >= mStart)
      }).length

      const monthOccupancyRate = monthCapacity > 0 ? Math.min(100, Math.round((occupiedInMonth / monthCapacity) * 100)) : 0

      return {
        ratioCobro: monthCollectionRate,
        rotacion: monthRotationIndex,
        abandono: monthChurnRate,
        ocupacion: monthOccupancyRate,
      }
    })
  }, [allPayments, players, groups, enrollments, currentMonth, currentYear])

  // ── Indicadores del club ────────────────────────────────────────────
  const prevMonthEvolution = evolutionData[10]
  const alumnosPorGrupo = activeGroups > 0 ? occupancyStats.totalOccupied / activeGroups : 0
  const plazasPorGrupo = activeGroups > 0 ? Math.round(occupancyStats.totalCapacity / activeGroups) : 0

  const clubIndicators: ClubIndicator[] = [
    {
      label: '% Ocupación de clases',
      value: `${occupancyStats.rate}%`,
      progressPct: occupancyStats.rate,
      deltaText: `${occupancyStats.rate - prevMonthEvolution.ocupacion >= 0 ? '+' : ''}${occupancyStats.rate - prevMonthEvolution.ocupacion} pts`,
      deltaTone: occupancyStats.rate - prevMonthEvolution.ocupacion >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Índice de rotación',
      value: `${rotationIndex}%`,
      progressPct: rotationIndex,
      deltaText: `${rotationIndex - prevMonthEvolution.rotacion >= 0 ? '+' : ''}${rotationIndex - prevMonthEvolution.rotacion} pts`,
      deltaTone: rotationIndex - prevMonthEvolution.rotacion <= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Tasa de abandono',
      value: `${churnRate}%`,
      progressPct: churnRate,
      deltaText: `${churnRate - prevMonthEvolution.abandono >= 0 ? '+' : ''}${churnRate - prevMonthEvolution.abandono} pts`,
      deltaTone: churnRate - prevMonthEvolution.abandono <= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Ratio de cobro',
      value: `${collectionRate}%`,
      progressPct: collectionRate,
      deltaText: `${collectionRate - prevMonthEvolution.ratioCobro >= 0 ? '+' : ''}${collectionRate - prevMonthEvolution.ratioCobro} pts`,
      deltaTone: collectionRate - prevMonthEvolution.ratioCobro >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Alumnos por grupo',
      value: alumnosPorGrupo.toFixed(1),
      progressPct: plazasPorGrupo > 0 ? Math.min(100, Math.round((alumnosPorGrupo / plazasPorGrupo) * 100)) : 0,
      deltaText: `de ${plazasPorGrupo} plazas`,
      deltaTone: 'neutral',
    },
  ]

  // ── Cobros del mes ──────────────────────────────────────────────────
  const currentMonthPending = currentMonthAllPayments.filter((p) => p.status === 'pendiente')
  const currentOverdueThisMonth = currentMonthPending
    .filter((p) => p.dueDate != null && new Date(p.dueDate) < now)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const currentPendingNotOverdue = currentPending - currentOverdueThisMonth

  const pctOfMonth = (amount: number) => (totalCurrentMonth > 0 ? Math.round((amount / totalCurrentMonth) * 100) : 0)

  const collectionSegments: CollectionSegment[] = [
    { label: 'Cobrado', amount: currentRevenue, pct: pctOfMonth(currentRevenue), colorClass: 'bg-success', dotClass: 'bg-success' },
    { label: 'Pendiente', amount: currentPendingNotOverdue, pct: pctOfMonth(currentPendingNotOverdue), colorClass: 'bg-warning', dotClass: 'bg-warning' },
    { label: 'Vencido', amount: currentOverdueThisMonth, pct: pctOfMonth(currentOverdueThisMonth), colorClass: 'bg-destructive', dotClass: 'bg-destructive' },
  ]

  const monthLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // ── Clases de hoy ────────────────────────────────────────────────────
  const todayClassRows: TodayClassRow[] = useMemo(() => {
    return todayGroups
      .slice()
      .sort((a, b) => {
        const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
        const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
        return aTime.localeCompare(bTime)
      })
      .map((group) => {
        const slot = group.schedule.find((s) => s.dayOfWeek === today)!
        const record = attendance.find(
          (a) => a.groupId === group.id && new Date(a.date).toDateString() === now.toDateString()
        )
        const attendanceLabel = record
          ? `${record.records.filter((r) => r.status === 'presente').length}/${record.records.length}`
          : '—'
        return {
          id: group.id,
          time: slot.startTime,
          name: group.name,
          meta: `${group.coachName} · ${group.courtName}`,
          attendanceLabel,
        }
      })
  }, [todayGroups, today, attendance, now])

  // ── Atención requerida ──────────────────────────────────────────────
  const allOverduePayments = useMemo(
    () => allPayments.filter((p) => p.status === 'pendiente' && p.dueDate != null && new Date(p.dueDate) < now),
    [allPayments, now]
  )
  const overdueAmount = allOverduePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const oldestOverdueDays = allOverduePayments.length > 0
    ? Math.floor((now.getTime() - Math.min(...allOverduePayments.map((p) => new Date(p.dueDate!).getTime()))) / 86400000)
    : 0

  const playersWithoutEvaluation = useMemo(
    () => players.filter((p) => p.status === 'activo' && !evaluations.some((e) => e.playerId === p.id)),
    [players, evaluations]
  )

  const waitlistPlayers = useMemo(() => players.filter((p) => p.status === 'lista_espera'), [players])
  const waitlistWithSpace = useMemo(
    () => waitlistPlayers.filter((p) =>
      groups.some((g) => isGroupCurrentlyActive(g, now) && g.level === p.level && g.currentEnrollment < g.maxCapacity)
    ),
    [waitlistPlayers, groups, now]
  )

  const attentionAlerts: AttentionAlert[] = useMemo(() => {
    const items: AttentionAlert[] = []
    if (allOverduePayments.length > 0) {
      items.push({
        id: 'overdue',
        title: `${allOverduePayments.length} pagos vencidos`,
        sub: `Suman ${formatCurrency(overdueAmount)} · desde hace ${oldestOverdueDays} días`,
        onNavigate: () => navigate('/pagos'),
      })
    }
    if (playersWithoutEvaluation.length > 0) {
      items.push({
        id: 'no-evaluation',
        title: `${playersWithoutEvaluation.length} jugadores sin evaluación`,
        sub: 'Nunca se les ha registrado ninguna',
        onNavigate: () => navigate('/personas/jugadores'),
      })
    }
    if (waitlistPlayers.length > 0) {
      items.push({
        id: 'waitlist',
        title: `${waitlistPlayers.length} en lista de espera`,
        sub: `${waitlistWithSpace.length} encajan en grupos con hueco`,
        onNavigate: () => navigate('/personas/lista-espera'),
      })
    }
    return items
  }, [allOverduePayments.length, overdueAmount, oldestOverdueDays, playersWithoutEvaluation.length, waitlistPlayers.length, waitlistWithSpace.length, navigate])

  const visibleActivities = useMemo(() => {
    if (canReadPayments) return activities
    return activities.filter((a) => a.type !== 'payment_received')
  }, [activities, canReadPayments])

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">HOY</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar jugador, grupo, pago…"
                className="h-10 w-64 rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/agenda')}
              title="Ir a la agenda"
              className="rounded-xl text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="h-5 w-5" />
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/jugadores')}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo jugador
            </Button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Jugadores activos"
            value={activePlayers}
            icon={Users}
            description={`${netPlayerChange >= 0 ? '+' : ''}${netPlayerChange} este mes`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          <StatCard
            title="Clases hoy"
            value={todayGroups.length}
            icon={CalendarDays}
            description={`${classesInProgress} en curso`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          <StatCard
            title="Asistencia media"
            value={`${weekAttendanceStats.current}%`}
            icon={CheckCircle2}
            description={`${weekAttendanceStats.diff >= 0 ? '+' : ''}${weekAttendanceStats.diff} pts vs. semana`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          {isAdmin && (
            <StatCard
              title="Pendiente de cobro"
              value={formatCurrency(currentPending)}
              icon={AlertCircle}
              description={`${pendingPlayersCount} jugadores`}
              iconClassName="bg-accent text-primary"
              accentColor="#2A5FD9"
            />
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-2 lg:px-8">
          <div className="space-y-5">
            <ClubIndicatorsGrid indicators={clubIndicators} monthLabel={monthLabel} />
            <MonthlyCollectionsCard monthLabel={monthLabel} total={totalCurrentMonth} segments={collectionSegments} />
          </div>
          <div className="space-y-5">
            <TodayClassesCard rows={todayClassRows} />
            <AttentionAlertsCard alerts={attentionAlerts} />
          </div>
        </div>
      )}

      <div className="p-5 lg:p-6">
        <Card className="border-border/60 shadow-[var(--shadow-card)] flex flex-col min-h-[460px]">
          <ActivityFeed activities={visibleActivities} canReadPayments={canReadPayments} />
        </Card>
      </div>
    </div>
  )
}
```

Nota: `clubTransactions` (los ingresos/gastos manuales, antes desestructurado
como `transactions`) ya NO se incluye en la desestructuración de
`useDataStore` de arriba — solo alimentaba `currentManualIncome`, que a su
vez solo alimentaba el KPI "Ingresos este mes" de la fila de KPIs
configurable ya eliminada. No hace falta volver a añadirlo.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: éxito, sin errores de TypeScript ni módulos no encontrados. Presta
atención especial a warnings de "declared but never read" — con `noUnusedLocals`
desactivado en este proyecto (confirmado en la Fase 1) no bloquean el build,
pero si aparecen, elimina esa variable del archivo antes de continuar (por
ejemplo `transactions`, ver nota del Step 1).

- [ ] **Step 3: Verificar tests**

Run: `npm test`
Expected: 146 tests pasan (ninguno de los tests existentes ejercita
`DashboardPage.tsx` directamente, así que este cambio no debería afectar el
recuento).

- [ ] **Step 4: Comprobar visualmente en el navegador**

1. `npm run dev`
2. Entra como `director` (ver `CLAUDE.md`) y comprueba `/` ("Hoy"):
   - Topbar, 4 KPIs, y las 4 tarjetas nuevas (Indicadores del club, Estado de
     cobros del mes, Clases de hoy, Requiere tu atención) se ven sin
     solapamientos ni recortes, en dos columnas en escritorio.
   - "Indicadores del club" muestra 5 celdas (no 6) con barra de progreso y
     delta en verde/rojo según corresponda.
   - "Estado de cobros del mes" muestra una barra apilada de 3 colores que
     suma visualmente el ancho del total, y 3 filas con importe y %.
   - "Clases de hoy" muestra hora, nombre, "entrenador · pista" y la
     asistencia (o "—" si aún no se ha pasado lista).
   - "Requiere tu atención" muestra hasta 3 alertas (o el estado "Todo al
     día" si ninguna aplica); cada alerta lleva a la página correcta al
     hacer clic.
   - El feed de actividad sigue funcionando debajo, sin gráficos ni botón de
     "Configurar KPIs" en el topbar.
3. Sin errores en la consola del navegador más allá del ya conocido y no
   relacionado `matchReports` (o ninguno, si ya se aplicó el fix de Firestore
   rules de la sesión anterior).

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: reconstruir Hoy/Dashboard segun el mock, eliminando codigo muerto"
```

---

## Self-review notes

- **Cobertura del spec:** las 4 secciones nuevas (Indicadores, Cobros,
  Clases de hoy, Atención) tienen su propio componente + su propio cálculo en
  `DashboardPage.tsx`; el grid de Indicadores tiene 5 celdas, no 6
  ("Conversión lista de espera" queda fuera, tal y como se decidió); la
  alerta de evaluaciones usa la métrica simple acordada
  ("jugadores activos sin evaluación") en vez del concepto de trimestres.
- **Placeholders:** ninguno — todas las fórmulas están escritas en código,
  no descritas en prosa.
- **Consistencia de tipos:** `ClubIndicator`, `CollectionSegment`,
  `TodayClassRow`, `AttentionAlert` se definen una vez (Tasks 2-5, exportados
  desde cada componente) y se importan con ese mismo nombre en
  `DashboardPage.tsx` (Task 6) — mismos campos, mismo orden de uso.
- **Riesgo aceptado explícitamente** (ya en el spec): el delta de
  Ocupación/Rotación/Abandono/Ratio de cobro compara un valor "actual"
  calculado con la fórmula simple ya existente contra un valor "mes anterior"
  calculado con la fórmula más elaborada de `evolutionData` — inconsistencia
  heredada, no introducida ni resuelta aquí.
