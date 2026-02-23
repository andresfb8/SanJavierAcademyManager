import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CreditCard, ClipboardCheck, CalendarDays, X } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

// ==========================================
// NotificationBell - Campanita de avisos
// ==========================================
// Muestra notificaciones reales calculadas desde el store:
// 1. Pagos pendientes del mes actual
// 2. Grupos sin asistencia registrada hoy
// 3. Eventos próximos (hoy o mañana)

interface Notification {
  id: string
  type: 'payment' | 'attendance' | 'event'
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  href?: string
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isTomorrow(date: Date, today: Date): boolean {
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return isSameDay(date, tomorrow)
}

const DISMISSALS_KEY = 'notification-dismissals'
const DISMISSAL_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 horas

interface DismissalRecord {
  [notificationId: string]: number // timestamp
}

function loadDismissals(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSALS_KEY)
    if (!stored) return new Set()

    const records: DismissalRecord = JSON.parse(stored)
    const now = Date.now()
    const validIds: string[] = []

    // Filtrar solo los que no han expirado (< 24h)
    for (const [id, timestamp] of Object.entries(records)) {
      if (now - timestamp < DISMISSAL_EXPIRY_MS) {
        validIds.push(id)
      }
    }

    return new Set(validIds)
  } catch {
    return new Set()
  }
}

function saveDismissal(id: string) {
  try {
    const stored = localStorage.getItem(DISMISSALS_KEY)
    const records: DismissalRecord = stored ? JSON.parse(stored) : {}
    records[id] = Date.now()
    localStorage.setItem(DISMISSALS_KEY, JSON.stringify(records))
  } catch (error) {
    console.error('[NotificationBell] Failed to save dismissal:', error)
  }
}

function saveDismissals(ids: string[]) {
  try {
    const stored = localStorage.getItem(DISMISSALS_KEY)
    const records: DismissalRecord = stored ? JSON.parse(stored) : {}
    const now = Date.now()
    for (const id of ids) {
      records[id] = now
    }
    localStorage.setItem(DISMISSALS_KEY, JSON.stringify(records))
  } catch (error) {
    console.error('[NotificationBell] Failed to save dismissals:', error)
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissals())
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { payments, groups, attendance, events } = useDataStore()

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const notifications = useMemo(() => {
    const items: Notification[] = []
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const todayDow = now.getDay()

    // --- 1. Pagos pendientes del mes actual ---
    const pendingPayments = payments.filter(
      (p) =>
        p.status === 'pendiente' &&
        p.billingMonth === currentMonth &&
        p.billingYear === currentYear
    )
    if (pendingPayments.length > 0) {
      const totalAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0)
      items.push({
        id: 'pending-payments',
        type: 'payment',
        title: `${pendingPayments.length} pago${pendingPayments.length !== 1 ? 's' : ''} pendiente${pendingPayments.length !== 1 ? 's' : ''}`,
        description: `${formatCurrency(totalAmount)} por cobrar este mes`,
        icon: CreditCard,
        color: 'text-amber-600 bg-amber-100',
        href: '/pagos',
      })
    }

    // --- 2. Grupos sin asistencia registrada hoy ---
    const activeGroups = groups.filter((g) => g.isActive)
    const groupsWithClassToday = activeGroups.filter((g) =>
      g.schedule.some((s) => s.dayOfWeek === todayDow)
    )

    if (groupsWithClassToday.length > 0) {
      const groupsWithAttendanceToday = new Set(
        attendance
          .filter((a) => {
            const aDate = a.date instanceof Date ? a.date : new Date(a.date)
            return isSameDay(aDate, now)
          })
          .map((a) => a.groupId)
      )

      const groupsWithoutAttendance = groupsWithClassToday.filter(
        (g) => !groupsWithAttendanceToday.has(g.id)
      )

      if (groupsWithoutAttendance.length > 0) {
        items.push({
          id: 'missing-attendance',
          type: 'attendance',
          title: `${groupsWithoutAttendance.length} grupo${groupsWithoutAttendance.length !== 1 ? 's' : ''} sin asistencia`,
          description: groupsWithoutAttendance.length <= 3
            ? groupsWithoutAttendance.map((g) => g.name).join(', ')
            : `${groupsWithoutAttendance.slice(0, 2).map((g) => g.name).join(', ')} y ${groupsWithoutAttendance.length - 2} más`,
          icon: ClipboardCheck,
          color: 'text-red-600 bg-red-100',
          href: '/asistencia',
        })
      }
    }

    // --- 3. Eventos próximos (hoy o mañana) ---
    const upcomingEvents = events.filter((e) => {
      if (!e.isActive) return false
      const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
      return isSameDay(eventDate, now) || isTomorrow(eventDate, now)
    })

    for (const event of upcomingEvents) {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
      const isToday = isSameDay(eventDate, now)
      items.push({
        id: `event-${event.id}`,
        type: 'event',
        title: event.name,
        description: `${isToday ? 'Hoy' : 'Mañana'} ${event.startTime}–${event.endTime} · ${event.attendeePlayerIds.length} asistente${event.attendeePlayerIds.length !== 1 ? 's' : ''}`,
        icon: CalendarDays,
        color: 'text-teal-600 bg-teal-100',
        href: `/eventos/${event.id}`,
      })
    }

    return items
  }, [payments, groups, attendance, events])

  const visibleNotifications = notifications.filter((n) => !dismissed.has(n.id))
  const count = visibleNotifications.length

  function handleDismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDismissed((prev) => new Set(prev).add(id))
    saveDismissal(id)
  }

  function handleClick(notification: Notification) {
    if (notification.href) {
      navigate(notification.href)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border bg-background shadow-xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Notificaciones</h3>
            {visibleNotifications.length > 0 && (
              <button
                onClick={() => {
                  const allIds = notifications.map((n) => n.id)
                  setDismissed(new Set(allIds))
                  saveDismissals(allIds)
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay notificaciones
                </p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors',
                    notification.href
                      ? 'cursor-pointer hover:bg-muted/50'
                      : ''
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5',
                      notification.color
                    )}
                  >
                    <notification.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {notification.description}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDismiss(notification.id, e)}
                    className="shrink-0 rounded p-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
