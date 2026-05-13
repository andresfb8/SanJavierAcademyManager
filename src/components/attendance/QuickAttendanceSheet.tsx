/**
 * src/components/attendance/QuickAttendanceSheet.tsx
 *
 * Pantalla completa de pase de lista para coaches.
 * Features:
 *  - Todos "Presente" por defecto en sesión nueva
 *  - Auto-save con debounce de 500ms tras cada cambio
 *  - Búsqueda en tiempo real por nombre
 *  - Botones P/A/J con área táctil ≥ 48px
 *  - Contador + barra de progreso en cabecera sticky
 *  - Botón Guardar siempre visible en la cabecera
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  X,
  ArrowLeft,
  Save,
  Users,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { useAttendanceQuery } from '@/hooks/useQueries'
import type { AttendanceEntry, AttendanceStatus, Group } from '@/types'

// ── Helper ──────────────────────────────────────────────────────────────────

function toISODate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickAttendanceSheetProps {
  group: Group
  date: string // 'YYYY-MM-DD'
  onBack: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function QuickAttendanceSheet({ group, date, onBack }: QuickAttendanceSheetProps) {
  const { user } = useAuthStore()
  const { players, enrollments, addAttendanceRecord, updateAttendanceRecord, attendanceNotices } = useDataStore()
  const { data: attendance = [] } = useAttendanceQuery()

  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Jugadores inscritos ────────────────────────────────────────────────────
  const enrolledPlayers = useMemo(() => {
    const activeEnrollments = enrollments.filter(
      (e) => e.groupId === group.id && e.isActive
    )
    return activeEnrollments
      .map((e) => {
        const p = players.find((pl) => pl.id === e.playerId)
        return p ? { id: p.id, name: `${p.firstName} ${p.lastName}`, player: p } : null
      })
      .filter(Boolean) as { id: string; name: string; player: typeof players[0] }[]
  }, [enrollments, players, group.id])

  // ── Registro existente ────────────────────────────────────────────────────
  const existingRecord = useMemo(
    () => attendance.find((a) => a.groupId === group.id && toISODate(a.date) === date) ?? null,
    [attendance, group.id, date]
  )

  // ── Inicializar entries ───────────────────────────────────────────────────
  useEffect(() => {
    if (existingRecord) {
      setEntries(existingRecord.records)
    } else {
      // Por defecto: todos Presentes
      setEntries(
        enrolledPlayers.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          status: 'presente' as AttendanceStatus,
          isRecovery: false,
        }))
      )
    }
    setSavedAt(null)
  }, [group.id, date]) // solo cuando cambia grupo/fecha

  // ── Auto-save con debounce ────────────────────────────────────────────────
  const persistEntries = useCallback(
    async (entriesToSave: AttendanceEntry[]) => {
      if (entriesToSave.length === 0) return
      setIsSaving(true)
      try {
        if (existingRecord) {
          await updateAttendanceRecord(existingRecord.id, { records: entriesToSave })
        } else {
          await addAttendanceRecord({
            groupId: group.id,
            groupName: group.name,
            date: new Date(date + 'T00:00:00'),
            records: entriesToSave,
            coachId: group.coachId,
          })
        }
        setSavedAt(new Date())
      } catch (err) {
        console.error('[QuickAttendanceSheet] Save error:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [existingRecord, group, date, addAttendanceRecord, updateAttendanceRecord]
  )

  const handleStatusChange = (playerId: string, status: AttendanceStatus) => {
    const newEntries = entries.map((e) =>
      e.playerId === playerId ? { ...e, status } : e
    )
    setEntries(newEntries)

    // Debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      persistEntries(newEntries)
    }, 500)
  }

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // ── Counters ──────────────────────────────────────────────────────────────
  const presentCount = entries.filter((e) => e.status === 'presente').length
  const absentCount = entries.filter((e) => e.status === 'ausente').length
  const totalCount = entries.length
  const progress = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return entries.filter((e) =>
      e.playerName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    )
  }, [entries, searchQuery])

  const dateLabel = formatDate(new Date(date + 'T00:00:00'))
  const timeLabel = group.schedule[0]?.startTime ?? ''

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        {/* Title row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-slate-800 truncate">{group.name}</h2>
            <p className="text-xs text-slate-400 font-medium">
              {dateLabel}{timeLabel && ` · ${timeLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-500">
              <Users className="h-3.5 w-3.5 inline mr-1" />
              {presentCount}/{totalCount}
            </span>
            <Button
              size="sm"
              onClick={() => persistEntries(entries)}
              disabled={isSaving}
              className="rounded-xl"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isSaving ? 'Guardando…' : savedAt ? 'Guardado ✓' : 'Guardar'}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 mx-4 mb-2 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              progress >= 80 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-red-400'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[11px]">
            <CheckCircle className="h-3 w-3 mr-1" />
            {presentCount} Presentes
          </Badge>
          <Badge className="bg-red-100 text-red-700 border-none text-[11px]">
            <XCircle className="h-3 w-3 mr-1" />
            {absentCount} Ausentes
          </Badge>
          {savedAt && (
            <span className="text-[10px] text-slate-400 ml-auto">
              Auto-guardado {savedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative px-4 pb-3">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar alumno…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 rounded-xl text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Player List ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">
              {searchQuery ? 'Sin resultados para tu búsqueda' : 'Sin jugadores inscritos'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredEntries.map((entry) => {
              const player = players.find((p) => p.id === entry.playerId)
              const notice = attendanceNotices.find(
                (n) =>
                  n.playerId === entry.playerId &&
                  n.groupId === group.id &&
                  toISODate(n.date) === date
              )

              return (
                <div
                  key={`${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}
                  className={cn(
                    'px-4 py-3 transition-colors',
                    entry.status === 'presente'
                      ? 'bg-white'
                      : entry.status === 'ausente'
                      ? 'bg-red-50/40'
                      : 'bg-amber-50/40'
                  )}
                >
                  {/* Fila superior: avatar + nombre + badges + teléfono */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black',
                        entry.status === 'presente'
                          ? 'bg-emerald-100 text-emerald-700'
                          : entry.status === 'ausente'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {entry.playerName.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-800 leading-tight">
                          {entry.playerName}
                        </span>
                        {entry.isRecovery && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 border-none shrink-0">Rec.</Badge>
                        )}
                        {notice && (
                          <Badge
                            variant={notice.type === 'absent' ? 'destructive' : 'secondary'}
                            className="text-[9px] px-1.5 py-0 shrink-0 animate-pulse"
                          >
                            {notice.type === 'absent' ? '⚠ No viene' : '✓ Viene'}
                          </Badge>
                        )}
                      </div>
                      {player?.medicalNotes && (
                        <p className="text-[10px] text-red-500 font-medium truncate flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {player.medicalNotes}
                        </p>
                      )}
                    </div>

                    {player?.phone && (
                      <a
                        href={`https://wa.me/${player.phone.replace(/\s+/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg hover:bg-green-50 text-slate-300 hover:text-green-600 transition-colors shrink-0"
                        title="WhatsApp"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {/* Fila inferior: botones P/A/J a ancho completo */}
                  <div className="flex gap-2 pl-13">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(entry.playerId, 'presente')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all active:scale-95',
                        entry.status === 'presente'
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                      )}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Presente
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(entry.playerId, 'ausente')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all active:scale-95',
                        entry.status === 'ausente'
                          ? 'bg-red-500 text-white shadow-sm shadow-red-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600'
                      )}
                    >
                      <XCircle className="h-4 w-4" />
                      Ausente
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(entry.playerId, 'justificado')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all active:scale-95',
                        entry.status === 'justificado'
                          ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                      )}
                    >
                      <AlertCircle className="h-4 w-4" />
                      Just.
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom padding for mobile nav */}
        <div className="h-24" />
      </div>
    </div>
  )
}
