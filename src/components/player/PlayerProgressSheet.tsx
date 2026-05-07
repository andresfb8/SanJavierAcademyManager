import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Trophy, 
  CalendarDays, 
  ChevronRight, 
  Star, 
  MessageSquare,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { formatDate, ensureDate } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlayerProgressSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
}

export function PlayerProgressSheet({ open, onOpenChange, studentId }: PlayerProgressSheetProps) {
  const { evaluations, matchReports } = useDataStore()

  const myEvaluations = evaluations
    .filter(e => e.playerId === studentId)
    .sort((a, b) => ensureDate(b.date).getTime() - ensureDate(a.date).getTime())

  const myMatchReports = matchReports
    .filter(m => m.playerIds.includes(studentId))
    .sort((a, b) => ensureDate(b.date).getTime() - ensureDate(a.date).getTime())

  const lastEval = myEvaluations[0]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-[2.5rem] p-0 overflow-hidden border-none bg-slate-50">
        <div className="p-6 pb-2">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="text-2xl font-black text-slate-800 tracking-tight">Mi Progreso</SheetTitle>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Seguimiento técnico y deportivo
            </p>
          </SheetHeader>
        </div>

        <div className="px-5 h-full overflow-y-auto pb-32">
          <Tabs defaultValue="evaluations" className="w-full">
            <TabsList className="grid grid-cols-2 bg-slate-200/50 p-1 rounded-2xl mb-6">
              <TabsTrigger value="evaluations" className="rounded-xl font-bold py-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                Evaluaciones
              </TabsTrigger>
              <TabsTrigger value="matches" className="rounded-xl font-bold py-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                Partidos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="evaluations" className="space-y-6 mt-0">
              {/* Overall Summary Card */}
              {lastEval && (
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <TrendingUp className="h-24 w-24" />
                    </div>
                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Star className="fill-white h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Media General</p>
                      <h4 className="text-2xl font-black">{lastEval.overallAverage.toFixed(1)} <span className="text-xs font-bold opacity-60">/ 10</span></h4>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-indigo-50 leading-relaxed italic relative z-10">
                    "{lastEval.finalComment}"
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Historial Técnico</h3>
                {myEvaluations.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                    <Award className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">Aún no tienes evaluaciones registradas.</p>
                  </div>
                ) : (
                  myEvaluations.map(evalu => (
                    <Card key={evalu.id} className="border-none shadow-sm rounded-3xl p-5 bg-white border border-slate-50 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-300">
                          <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800">Evaluación de Nivel</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <CalendarDays className="h-3 w-3 text-slate-300" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(ensureDate(evalu.date))}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-800">{evalu.overallAverage.toFixed(1)}</span>
                        <ChevronRight className="h-4 w-4 text-slate-200 inline-block ml-2" />
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="matches" className="space-y-4 mt-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Crónicas de Pista</h3>
              {myMatchReports.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                  <Zap className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">No hay informes de partido recientes.</p>
                </div>
              ) : (
                myMatchReports.map(report => (
                  <Card key={report.id} className="border-none shadow-sm rounded-3xl p-5 bg-white border border-slate-50 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Zap className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-800">{report.title}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(ensureDate(report.date))} · {report.coachName}</p>
                            </div>
                        </div>
                        <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[9px]">CRÓNICA</Badge>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-indigo-600">
                                <TrendingUp className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Análisis Táctico</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{report.tacticsComment}</p>
                        </div>
                        <div className="bg-amber-50/50 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-amber-600">
                                <MessageSquare className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Aspecto Mental</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{report.mentalComment}</p>
                        </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
