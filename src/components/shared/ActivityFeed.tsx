import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, ChevronDown, ExternalLink, User,
    CreditCard, Users, CalendarCheck, BookOpen, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity, ActivityType } from '@/types'

// ── Category groups ─────────────────────────────────────────────────────────
type Category = 'all' | 'pagos' | 'jugadores' | 'grupos' | 'asistencia' | 'otros'

const CATEGORY_TYPES: Record<Category, ActivityType[]> = {
    all: [],
    pagos: ['payment_received', 'payment_created', 'payment_cancelled'],
    jugadores: ['player_created', 'player_updated', 'player_deleted', 'player_cancelled'],
    grupos: ['group_created', 'group_updated', 'group_deleted', 'enrollment_created', 'enrollment_deleted', 'coach_created', 'coach_updated', 'coach_deleted'],
    asistencia: ['attendance_recorded', 'recovery_used'],
    otros: ['evaluation_created', 'evaluation_updated', 'evaluation_deleted', 'event_created', 'event_updated', 'event_deleted', 'lesson_created', 'lesson_updated', 'lesson_deleted', 'match_report_created', 'match_report_updated', 'match_report_deleted', 'invitation_sent'],
}

const CATEGORY_LABELS: Record<Category, string> = {
    all: 'Todo',
    pagos: 'Pagos',
    jugadores: 'Jugadores',
    grupos: 'Grupos',
    asistencia: 'Asistencia',
    otros: 'Otros',
}

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
    all: <Zap className="h-3.5 w-3.5" />,
    pagos: <CreditCard className="h-3.5 w-3.5" />,
    jugadores: <User className="h-3.5 w-3.5" />,
    grupos: <Users className="h-3.5 w-3.5" />,
    asistencia: <CalendarCheck className="h-3.5 w-3.5" />,
    otros: <BookOpen className="h-3.5 w-3.5" />,
}

// ── Activity visual config ────────────────────────────────────────────────
const ACTIVITY_CONFIG: Partial<Record<ActivityType, { icon: string; dot: string; nav?: string }>> = {
    payment_received: { icon: '💰', dot: 'bg-emerald-500' },
    payment_created: { icon: '🧾', dot: 'bg-blue-400' },
    payment_cancelled: { icon: '❌', dot: 'bg-rose-500' },
    player_created: { icon: '👤', dot: 'bg-cyan-500', nav: '/jugadores' },
    player_updated: { icon: '✏️', dot: 'bg-sky-400', nav: '/jugadores' },
    player_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    player_cancelled: { icon: '🚪', dot: 'bg-rose-400', nav: '/jugadores' },
    group_created: { icon: '👥', dot: 'bg-indigo-500', nav: '/grupos' },
    group_updated: { icon: '📝', dot: 'bg-indigo-400', nav: '/grupos' },
    group_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    enrollment_created: { icon: '➕', dot: 'bg-teal-500' },
    enrollment_deleted: { icon: '➖', dot: 'bg-orange-400' },
    coach_created: { icon: '🎾', dot: 'bg-sky-500', nav: '/personal' },
    coach_updated: { icon: '✏️', dot: 'bg-sky-400', nav: '/personal' },
    coach_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    attendance_recorded: { icon: '📋', dot: 'bg-violet-500' },
    recovery_used: { icon: '🔄', dot: 'bg-amber-500' },
    evaluation_created: { icon: '⭐', dot: 'bg-yellow-500' },
    evaluation_updated: { icon: '✏️', dot: 'bg-yellow-400' },
    evaluation_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    event_created: { icon: '🎉', dot: 'bg-pink-500', nav: '/eventos' },
    event_updated: { icon: '📝', dot: 'bg-pink-400', nav: '/eventos' },
    event_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    lesson_created: { icon: '🎓', dot: 'bg-amber-500' },
    lesson_updated: { icon: '✏️', dot: 'bg-amber-400' },
    lesson_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    match_report_created: { icon: '📊', dot: 'bg-indigo-500' },
    match_report_updated: { icon: '📊', dot: 'bg-indigo-400' },
    match_report_deleted: { icon: '🗑️', dot: 'bg-rose-500' },
    invitation_sent: { icon: '✉️', dot: 'bg-cyan-500' },
}

// ── Helpers ────────────────────────────────────────────────────────────────
function toDate(v: Date | string): Date {
    return v instanceof Date ? v : new Date(v)
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'Hace un momento'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours}h`
    return `Hace ${Math.floor(hours / 24)}d`
}

function dayLabel(date: Date): string {
    const now = new Date()
    const diff = Math.floor((now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000)
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    if (diff < 7) return 'Esta semana'
    return 'Anterior'
}

const DAY_ORDER = ['Hoy', 'Ayer', 'Esta semana', 'Anterior']

const LAST_VISIT_KEY = 'activity-feed-last-visit'

// ── Component ─────────────────────────────────────────────────────────────
interface ActivityFeedProps {
    activities: Activity[]
    canReadPayments?: boolean
    limit?: number
}

const DEFAULT_PAGE_SIZE = 8

export function ActivityFeed({ activities, canReadPayments = true, limit }: ActivityFeedProps) {
    const navigate = useNavigate()
    const [category, setCategory] = useState<Category>('all')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [newCount, setNewCount] = useState(0)
    const lastVisitRef = useRef<Date | null>(null)

    const pageSize = limit || DEFAULT_PAGE_SIZE

    // Track "new since last visit" badge
    useEffect(() => {
        const stored = localStorage.getItem(LAST_VISIT_KEY)
        const lastVisit = stored ? new Date(stored) : null
        lastVisitRef.current = lastVisit

        if (lastVisit) {
            const count = activities.filter((a) => toDate(a.createdAt) > lastVisit).length
            setNewCount(count)
        }
        // Update last visit on unmount
        return () => {
            localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
        }
    }, [activities])

    // Reset page on filter change
    useEffect(() => { setPage(1) }, [category, search])

    const visible = useMemo(() => {
        return activities.filter((a) => {
            if (!canReadPayments && a.type.startsWith('payment')) return false
            if (category !== 'all' && !CATEGORY_TYPES[category].includes(a.type)) return false
            if (search) {
                const q = search.toLowerCase()
                const actor = (a.userName ?? a.userId ?? '').toLowerCase()
                if (!a.description.toLowerCase().includes(q) && !actor.includes(q)) return false
            }
            return true
        })
    }, [activities, category, search, canReadPayments])

    const paged = visible.slice(0, page * pageSize)
    const hasMore = paged.length < visible.length

    // Group by day label
    const grouped = useMemo(() => {
        const map: Record<string, Activity[]> = {}
        for (const a of paged) {
            const label = dayLabel(toDate(a.createdAt))
            if (!map[label]) map[label] = []
            map[label].push(a)
        }
        return DAY_ORDER.filter((d) => map[d]).map((d) => ({ label: d, items: map[d] }))
    }, [paged])

    const handleActivityClick = (a: Activity) => {
        const cfg = ACTIVITY_CONFIG[a.type]
        if (cfg?.nav && a.relatedEntityId) {
            navigate(`${cfg.nav}/${a.relatedEntityId}`)
        } else if (cfg?.nav) {
            navigate(cfg.nav)
        } else {
            setExpandedId(expandedId === a.id ? null : a.id)
        }
    }

    const markNewSeen = () => {
        setNewCount(0)
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
    }

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">⚡ Actividad reciente</span>
                    {newCount > 0 && (
                        <button
                            onClick={markNewSeen}
                            className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
                        >
                            {newCount > 99 ? '99+' : newCount}
                        </button>
                    )}
                </div>
                <button
                    onClick={() => navigate('/registro-actividad')}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                    Ver todo <ExternalLink className="h-3 w-3" />
                </button>
            </div>

            {/* ── Search ── */}
            <div className="px-5 pb-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Buscar actividad..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                    />
                </div>
            </div>

            {/* ── Category filters ── */}
            <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
                {(Object.keys(CATEGORY_LABELS) as Category[])
                    .filter((c) => c !== 'pagos' || canReadPayments)
                    .map((c) => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={cn(
                                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                                category === c
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                            )}
                        >
                            {CATEGORY_ICONS[c]}
                            {CATEGORY_LABELS[c]}
                        </button>
                    ))}
            </div>

            {/* ── Feed ── */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
                {grouped.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        {search || category !== 'all' ? 'Sin resultados para este filtro' : 'Sin actividad reciente'}
                    </p>
                ) : (
                    grouped.map(({ label, items }) => (
                        <div key={label}>
                            {/* Day separator */}
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {label}
                                </span>
                                <div className="flex-1 h-px bg-border/60" />
                            </div>

                            <div className="space-y-2">
                                {items.map((a) => {
                                    const cfg = ACTIVITY_CONFIG[a.type] ?? { icon: '📌', dot: 'bg-slate-400' }
                                    const actor = a.userName ?? a.userId
                                    const isExpanded = expandedId === a.id
                                    const isNavigable = !!cfg.nav
                                    const date = toDate(a.createdAt)

                                    return (
                                        <div
                                            key={a.id}
                                            onClick={() => handleActivityClick(a)}
                                            className={cn(
                                                'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                                                (isNavigable || !isExpanded)
                                                    ? 'cursor-pointer hover:bg-muted/60'
                                                    : 'cursor-default',
                                                isExpanded && 'bg-muted/40'
                                            )}
                                        >
                                            {/* Dot + icon */}
                                            <div className="relative shrink-0 mt-0.5">
                                                <span className="text-base leading-none">{cfg.icon}</span>
                                                <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background', cfg.dot)} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-foreground leading-snug">{a.description}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground">{timeAgo(date)}</span>
                                                    {actor && (
                                                        <>
                                                            <span className="text-muted-foreground/40">·</span>
                                                            <span className="text-xs text-muted-foreground/80 truncate">{actor}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {/* Expanded detail */}
                                                {isExpanded && (
                                                    <div className="mt-2 rounded-lg bg-background border border-border/60 px-3 py-2 text-xs text-muted-foreground space-y-1">
                                                        <p><span className="font-medium text-foreground">Fecha exacta:</span>{' '}
                                                            {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                                                            a las {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        {actor && <p><span className="font-medium text-foreground">Realizado por:</span> {actor}</p>}
                                                        {a.relatedEntityId && <p><span className="font-medium text-foreground">ID referencia:</span> {a.relatedEntityId}</p>}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Navigate arrow or expand chevron */}
                                            {isNavigable ? (
                                                <ExternalLink className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                            ) : (
                                                <ChevronDown className={cn(
                                                    'h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground/40 transition-transform',
                                                    isExpanded && 'rotate-180'
                                                )} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))
                )}

                {/* Load more */}
                {hasMore && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setPage((p) => p + 1) }}
                    >
                        Ver más ({visible.length - paged.length} restantes)
                    </Button>
                )}
            </div>
        </div>
    )
}
