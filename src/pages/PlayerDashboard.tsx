import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  XCircle, 
  Trophy,
  ChevronRight,
  CreditCard,
  MessageCircle,
  Ticket
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useAttendanceQuery } from '@/hooks/useQueries'
import type { AttendanceNotice } from '@/types'
import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PlayerPaymentsList } from '@/components/player/PlayerPaymentsList'
import { RefreshCw } from 'lucide-react'
import { VoucherCard } from '@/components/vouchers/VoucherCard'

export default function PlayerDashboard() {
  const { user } = useAuthStore()
  const { groups, enrollments, coaches, attendanceNotices, addAttendanceNotice, deleteAttendanceNotice, vouchers } = useDataStore()
  const [showPayments, setShowPayments] = useState(false)
  const [showVouchers, setShowVouchers] = useState(false)
  
  const studentId = user?.linkedPlayerId
  
  // Find player details
  const myEnrollments = enrollments.filter(e => e.playerId === studentId && e.isActive)
  const myGroups = groups.filter(g => myEnrollments.some(e => e.groupId === g.id))
  
  const now = new Date()
  const today = now.getDay() || 7 // 1-7 (Lunes-Domingo)
  
  // Find next class within 7 days
  const nextClassData = useMemo(() => {
    let nextClassObj = null
    let minDiffMs = Infinity

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + i)
      const targetDay = targetDate.getDay() || 7
      
      for (const group of myGroups) {
        const slots = group.schedule.filter(s => s.dayOfWeek === targetDay)
        for (const slot of slots) {
          const [hours, minutes] = slot.startTime.split(':').map(Number)
          const classTime = new Date(targetDate)
          classTime.setHours(hours, minutes, 0, 0)
          
          const diffMs = classTime.getTime() - new Date().getTime()
          // Only consider classes in the future
          if (diffMs > 0 && diffMs < minDiffMs) {
            minDiffMs = diffMs
            nextClassObj = {
              group,
              slot,
              classDate: classTime,
              diffHours: diffMs / (1000 * 60 * 60)
            }
          }
        }
      }
    }
    return nextClassObj
  }, [myGroups])

  // Get attendance status for the calculated next class date
  const nextClassDateStr = nextClassData ? nextClassData.classDate.toISOString().split('T')[0] : ''
  const currentNotice = attendanceNotices.find(n => 
    n.playerId === studentId && 
    n.groupId === nextClassData?.group.id && 
    n.date.toISOString().split('T')[0] === nextClassDateStr
  )

  const handleAttendanceNotice = (type: 'present' | 'absent') => {
    if (!studentId || !nextClassData) return
    
    // Si la plaza ya fue ocupada y queremos volver a decir "Sí, voy", habría que verificar (Pendiente Fase 4 / validación).
    // Por ahora permitimos cambiar si estamos a tiempo.

    if (currentNotice) {
      deleteAttendanceNotice(currentNotice.id)
      // Si hizo clic en el mismo que ya estaba marcado, solo lo borramos (desmarcar)
      if (currentNotice.type === type) {
        return
      }
    }

    const newNotice: Omit<AttendanceNotice, 'id' | 'createdAt'> = {
      playerId: studentId,
      playerName: user?.displayName || 'Alumno',
      groupId: nextClassData.group.id,
      date: new Date(nextClassDateStr),
      type,
    }
    
    addAttendanceNotice(newNotice)
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <Header title="Mi Portal" />
      
      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Hola, {user?.displayName?.split(' ')[0]}</h1>
            <p className="text-sm font-medium text-slate-400">{formatDate(now)}</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Trophy className="h-6 w-6" />
          </div>
        </div>

        {/* Next Class Widget */}
        {nextClassData ? (
          <Card className="border-none shadow-xl shadow-emerald-900/5 rounded-[2rem] overflow-hidden bg-white">
            <div className="bg-emerald-600 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-white/20 text-white border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Próxima Clase
                </Badge>
                <div className="flex items-center gap-1 text-emerald-100 text-xs font-bold">
                  <Clock className="h-3 w-3" />
                  {formatDate(nextClassData.classDate)} · {nextClassData.slot.startTime}
                </div>
              </div>
              <h2 className="text-xl font-black mb-1">{nextClassData.group.name}</h2>
              <div className="flex items-center gap-4 text-emerald-100 text-xs">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {nextClassData.group.courtName}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {nextClassData.group.coachName}
                </div>
              </div>
            </div>
            
            <CardContent className="p-6 space-y-4">
              {nextClassData.diffHours <= 48 ? (
                <>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">¿Asistirás a clase?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline"
                      className={cn(
                        "h-14 rounded-2xl border-2 font-bold transition-all",
                        currentNotice?.type === 'present' 
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                          : "border-slate-100 text-slate-600 hover:bg-slate-50"
                      )}
                      onClick={() => handleAttendanceNotice('present')}
                    >
                      <CheckCircle2 className={cn("h-5 w-5 mr-2", currentNotice?.type === 'present' ? "text-emerald-500" : "text-slate-300")} />
                      Sí, voy
                    </Button>
                    <Button 
                      variant="outline"
                      className={cn(
                        "h-14 rounded-2xl border-2 font-bold transition-all",
                        currentNotice?.type === 'absent' 
                          ? "bg-amber-50 border-amber-500 text-amber-700" 
                          : "border-slate-100 text-slate-600 hover:bg-slate-50"
                      )}
                      onClick={() => handleAttendanceNotice('absent')}
                    >
                      <XCircle className={cn("h-5 w-5 mr-2", currentNotice?.type === 'absent' ? "text-amber-500" : "text-slate-300")} />
                      No puedo
                    </Button>
                  </div>
                  
                  {currentNotice?.type === 'absent' && (
                    <div className="bg-amber-50 rounded-xl p-3 flex gap-3 items-start animate-in fade-in zoom-in-95 duration-300 mt-4">
                      <MessageCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                          Hemos avisado a tu entrenador para liberar la plaza.
                        </p>
                        {nextClassData.diffHours >= 24 && (
                          <p className="text-[10px] text-amber-600 font-bold">
                            ¡Has cancelado con +24h! Recibirás un crédito de recuperación.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    Faltan {Math.floor(nextClassData.diffHours / 24)} días para tu clase.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    La confirmación se abrirá 48 horas antes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-sm rounded-[2rem] p-8 text-center bg-white">
            <CalendarDays className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">No tienes clases para hoy</p>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                <RefreshCw className="h-4 w-4" />
              </div>
              <span className="text-2xl font-black text-slate-800">2</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Recuperaciones</p>
          </Card>
          <Card 
            className="border-none shadow-sm rounded-3xl bg-white p-5 cursor-pointer active:scale-95 transition-all"
            onClick={() => setShowPayments(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600 bg-amber-50">Gestionar</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pagos</p>
          </Card>
        </div>

        <Card 
          className="border-none shadow-sm rounded-3xl bg-white p-5 cursor-pointer active:scale-95 transition-all flex items-center justify-between"
          onClick={() => setShowVouchers(true)}
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mis Bonos</p>
              <p className="text-sm font-bold text-slate-700">Ver clases restantes</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </Card>

        {/* Weekly Schedule */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Mi Agenda Semanal</h3>
          <div className="space-y-3">
            {myGroups.map(group => (
              <div key={group.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">{group.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {group.schedule.map(s => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][s.dayOfWeek]).join(', ')} · {group.coachName}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Nav Space */}
      <div className="h-10" />

      {/* Payments Sheet */}
      <Sheet open={showPayments} onOpenChange={setShowPayments}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] p-0 overflow-hidden border-none bg-slate-50">
          <div className="p-6 pb-2">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-black text-slate-800 mb-1">Mis Pagos y Facturas</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Historial completo</p>
          </div>
          <div className="px-5 pb-20 h-full overflow-y-auto">
            {studentId && <PlayerPaymentsList playerId={studentId} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Vouchers Sheet */}
      <Sheet open={showVouchers} onOpenChange={setShowVouchers}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] p-0 overflow-hidden border-none bg-slate-50">
          <div className="p-6 pb-2">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-black text-slate-800 mb-1">Mis Bonos</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Clases disponibles y consumidas</p>
          </div>
          <div className="px-5 pb-20 h-full overflow-y-auto space-y-4">
            {studentId && (() => {
              const myVouchers = vouchers.filter(v => v.playerId === studentId)
              if (myVouchers.length === 0) {
                return (
                  <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Ticket className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No tienes bonos activos.</p>
                    <p className="text-xs text-slate-400 mt-1">Contacta con la academia para comprar uno.</p>
                  </div>
                )
              }
              return (
                <div className="space-y-3">
                  {myVouchers.map(voucher => (
                    <VoucherCard key={voucher.id} voucher={voucher} />
                  ))}
                </div>
              )
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

