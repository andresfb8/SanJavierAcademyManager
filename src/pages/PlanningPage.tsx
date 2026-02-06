import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Target, Brain, Dumbbell, Lightbulb } from 'lucide-react'

export default function PlanningPage() {
  return (
    <div>
      <Header
        title="Planificación Deportiva"
        subtitle="Módulo en desarrollo"
      />
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Próximamente</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              El módulo de planificación deportiva te permitirá definir y gestionar
              todos los objetivos de tus sesiones de entrenamiento.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="rounded-lg border p-4 text-center">
                <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="font-medium text-sm">Objetivos técnicos</p>
                <p className="text-xs text-muted-foreground mt-1">Golpes, posicionamiento, técnica</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Lightbulb className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <p className="font-medium text-sm">Objetivos tácticos</p>
                <p className="text-xs text-muted-foreground mt-1">Estrategia, juego en equipo</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Brain className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="font-medium text-sm">Objetivos mentales</p>
                <p className="text-xs text-muted-foreground mt-1">Concentración, confianza</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Dumbbell className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="font-medium text-sm">Objetivos físicos</p>
                <p className="text-xs text-muted-foreground mt-1">Resistencia, velocidad, fuerza</p>
              </div>
            </div>

            <div className="mt-8 rounded-lg bg-muted p-4 max-w-lg mx-auto">
              <h3 className="font-medium mb-2">Niveles de planificación previstos:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Planificación anual
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Planificación trimestral
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  Planificación mensual
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  Planificación semanal
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
