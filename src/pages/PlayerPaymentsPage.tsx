import { Header } from '@/components/layout/Header'
import { PlayerPaymentsList } from '@/components/player/PlayerPaymentsList'
import { usePlayerData } from '@/hooks/usePlayerData'

export default function PlayerPaymentsPage() {
  const { studentId } = usePlayerData()

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 lg:pb-6">
      <Header title="Mis Pagos y Facturas" />
      <div className="max-w-4xl mx-auto px-5 py-6 lg:py-8 space-y-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 min-h-[60vh]">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800 mb-1">Historial de Pagos</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Consulta tus recibos y descarga tus facturas
            </p>
          </div>
          
          {studentId ? (
            <PlayerPaymentsList playerId={studentId} />
          ) : (
            <div className="text-center text-slate-500 py-10">
              No se encontró información del alumno.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
