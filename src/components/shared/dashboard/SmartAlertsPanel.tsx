import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, UsersRound, ChevronRight, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { pendingPaymentAlerts, highAbsenceGroupAlerts } from '@/lib/dashboard-alerts'

const MAX_ALERTS_PER_TYPE = 5

export function SmartAlertsPanel() {
  const navigate = useNavigate()
  const { payments, eventPayments, privateLessonPayments, events, attendance, groups } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const allPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments ?? [], events),
    [payments, eventPayments, privateLessonPayments, events]
  )

  const currentMonthPayments = useMemo(
    () => allPayments.filter(p => p.billingMonth === currentMonth && p.billingYear === currentYear),
    [allPayments, currentMonth, currentYear]
  )

  const paymentAlerts = useMemo(
    () => pendingPaymentAlerts(currentMonthPayments, 2).slice(0, MAX_ALERTS_PER_TYPE),
    [currentMonthPayments]
  )

  const absenceAlerts = useMemo(
    () => highAbsenceGroupAlerts(attendance, groups, currentMonth, currentYear).slice(0, MAX_ALERTS_PER_TYPE),
    [attendance, groups, currentMonth, currentYear]
  )

  const hasAlerts = paymentAlerts.length > 0 || absenceAlerts.length > 0

  return (
    <Card className="border-amber-200 bg-amber-50/30 shadow-sm h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-amber-900">Alertas inteligentes</h2>
        </div>

        {!hasAlerts && (
          <p className="text-xs text-amber-700/70 py-2">No hay alertas activas este mes.</p>
        )}

        {paymentAlerts.map(alert => (
          <div key={alert.playerId} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-white/60 p-3">
            <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900">
                {alert.playerName} tiene {alert.pendingCount} recibos pendientes
              </p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">
                {formatCurrency(alert.pendingAmount)} pendientes de cobro
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 h-6 px-1.5 text-[11px] text-amber-700 hover:bg-amber-100 -ml-1.5"
                onClick={() => navigate('/pagos')}
              >
                Ver detalles
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>
        ))}

        {absenceAlerts.map(alert => (
          <div key={alert.groupId} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-white/60 p-3">
            <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
              <UsersRound className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900">
                Ausencia alta en '{alert.groupName}'
              </p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">
                {Math.round(alert.absenceRate * 100)}% de ausencia este mes
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 h-6 px-1.5 text-[11px] text-amber-700 hover:bg-amber-100 -ml-1.5"
                onClick={() => navigate(`/asistencia?groupId=${alert.groupId}`)}
              >
                Ver detalles
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
