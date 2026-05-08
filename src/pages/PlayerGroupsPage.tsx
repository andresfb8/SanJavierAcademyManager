import { Header } from '@/components/layout/Header'
import { usePlayerData } from '@/hooks/usePlayerData'
import { ProximaClaseCard, MisGruposCard } from '@/components/player/PlayerDashboardCards'
import { CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function PlayerGroupsPage() {
  const { myGroups, nextClass } = usePlayerData()

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 lg:pb-6">
      <Header title="Mis Clases" />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        
        {myGroups.length === 0 ? (
          <Card className="border-none shadow-sm rounded-[2.5rem] p-10 text-center bg-white border border-slate-50">
            <CalendarDays className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin grupos asignados</h3>
            <p className="text-xs text-slate-300 mt-1 font-bold">Actualmente no estás inscrito en ningún grupo.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-800">Próxima Clase</h2>
              <ProximaClaseCard nextClass={nextClass} />
            </div>
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-800">Mis Grupos</h2>
              <MisGruposCard groups={myGroups} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
