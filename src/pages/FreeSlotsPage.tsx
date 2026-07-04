import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Clock, Users, RefreshCw, Sparkles } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { useAttendanceQuery } from '@/hooks/useQueries'
import { AttendanceEntry, AttendanceRecord } from '@/types'
import { BookRecoveryDialog } from '@/components/shared/BookRecoveryDialog'

interface RecoverySlot {
  groupId: string
  groupName: string
  coachId: string
  date: Date
}

export default function FreeSlotsPage() {
  const { groups } = useDataStore()
  const { data: attendance = [] } = useAttendanceQuery()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [bookingSlot, setBookingSlot] = useState<RecoverySlot | null>(null)

  // Calculate free slots based on absences and group capacity
  const freeSlots = useMemo(() => {
    const slots: any[] = []
    const today = new Date(selectedDate)
    const dayOfWeek = today.getDay()

    // Find groups that have a schedule for the selected date
    const dayGroups = groups.filter(g => g.isActive && g.schedule.some(s => s.dayOfWeek === dayOfWeek))

    dayGroups.forEach(group => {
      const schedule = group.schedule.find(s => s.dayOfWeek === dayOfWeek)
      if (!schedule) return

      // Find if there is an attendance record for this group on this date
      const record = attendance.find(a => 
        a.groupId === group.id && 
        new Date(a.date).toDateString() === today.toDateString()
      )

      let totalSpots = group.maxCapacity
      let takenSpots = group.currentEnrollment
      let absentees = 0

      if (record) {
        // If there's a record, the free spots are (maxCapacity - present - pending) 
        // which equals (maxCapacity - totalEnrolled) + (absent + justified)
        const present = record.records.filter((r: AttendanceEntry) => r.status === 'presente').length
        absentees = record.records.filter((r: AttendanceEntry) => r.status === 'ausente' || r.status === 'justificado').length
        takenSpots = present // Simplifying: only present people take spots
      }

      const availableSpots = (totalSpots - takenSpots) + absentees

      if (availableSpots > 0) {
        slots.push({
          id: `${group.id}-${selectedDate}`,
          groupId: group.id,
          groupName: group.name,
          coachId: group.coachId,
          level: group.level,
          courtName: group.courtName,
          coachName: group.coachName,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          availableSpots,
          absentees
        })
      }
    })

    return slots.sort((a: any, b: any) => a.time.localeCompare(b.time))
  }, [groups, attendance, selectedDate])

  // Registro de asistencia existente para el hueco en reserva (grupo + fecha seleccionada).
  const bookingRecord: AttendanceRecord | undefined = useMemo(() => {
    if (!bookingSlot) return undefined
    return attendance.find(
      (a) =>
        a.groupId === bookingSlot.groupId &&
        new Date(a.date).toDateString() === bookingSlot.date.toDateString()
    )
  }, [attendance, bookingSlot])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Huecos Libres"
        subtitle="Encuentra clases disponibles para recuperar o unirte hoy"
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <Badge className="bg-white/20 text-white border-white/30 mb-4 rounded-full backdrop-blur-sm">
              <Sparkles className="h-3 w-3 mr-1" /> Nuevo Sistema
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">
              Aprovecha las plazas libres
            </h2>
            <p className="text-blue-100 text-sm sm:text-base mb-6 leading-relaxed">
              Cuando un alumno avisa que no puede venir, su plaza queda libre. 
              Usa tus créditos de recuperación para unirte a estas clases o paga una clase suelta.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 px-4 flex items-center border border-white/20">
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="bg-transparent border-none text-white focus:ring-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]"
                />
              </div>
            </div>
          </div>
          
          {/* Decorative shapes */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 right-12 w-48 h-48 bg-indigo-500/30 rounded-full blur-2xl"></div>
        </div>

        {/* List of Slots */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 px-2">
            <Calendar className="h-5 w-5 text-primary" />
            Clases Disponibles el {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>

          {freeSlots.length === 0 ? (
            <div className="text-center py-16 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
              <div className="bg-white h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">Todo completo</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No hay huecos libres registrados para esta fecha todavía. Vuelve a comprobar más tarde.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {freeSlots.map((slot) => (
                <Card key={slot.id} className="border-none shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 bg-white flex flex-col">
                  <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-white font-bold uppercase tracking-wider text-[10px]">
                        {slot.level}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                        {slot.availableSpots} plazas libres
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-800">
                      {slot.groupName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5 pb-4 flex-1">
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-slate-600">
                        <Clock className="h-4 w-4 mr-3 text-slate-400" />
                        <span className="font-semibold text-slate-700">{slot.time}</span>
                      </div>
                      <div className="flex items-center text-sm text-slate-600">
                        <MapPin className="h-4 w-4 mr-3 text-slate-400" />
                        Pista {slot.courtName}
                      </div>
                      <div className="flex items-center text-sm text-slate-600">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 text-[10px] font-bold text-primary">
                          {slot.coachName.charAt(0)}
                        </div>
                        {slot.coachName}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-5 px-5">
                    <Button
                      className="w-full rounded-xl font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all group"
                      onClick={() => setBookingSlot({
                        groupId: slot.groupId,
                        groupName: slot.groupName,
                        coachId: slot.coachId,
                        date: new Date(selectedDate + 'T00:00:00'),
                      })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-300" />
                      Reservar recuperación
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <BookRecoveryDialog
        open={bookingSlot !== null}
        onOpenChange={(o) => { if (!o) setBookingSlot(null) }}
        slot={bookingSlot}
        existingRecord={bookingRecord}
      />
    </div>
  )
}
