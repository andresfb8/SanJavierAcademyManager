import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Plus, Calendar as CalendarIcon, MoreVertical } from 'lucide-react'
import { TrainingTemplate } from '@/types/methodology'
import { getTrainingTemplates } from '@/lib/planning-service'
import { useAuthStore } from '@/stores/authStore'
import { PlanningBuilder } from '@/components/planning/PlanningBuilder'
import { AssignPlanDialog } from '@/components/planning/AssignPlanDialog'

export default function PlanningPage() {
  const { user } = useAuthStore()
  const [templates, setTemplates] = useState<TrainingTemplate[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [assigningTemplate, setAssigningTemplate] = useState<TrainingTemplate | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await getTrainingTemplates()
      setTemplates(data)
    } catch (error) {
      console.error("Failed to load templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (showBuilder) {
    return (
      <div>
        <Header
          title="Creador de Plantillas"
          subtitle="Diseña una nueva planificación base"
          actions={
            <Button variant="outline" onClick={() => setShowBuilder(false)}>
              Volver
            </Button>
          }
        />
        <div className="p-6">
          <PlanningBuilder
            onBack={() => setShowBuilder(false)}
            onSaved={() => {
              setShowBuilder(false)
              loadTemplates()
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Planificación General"
        subtitle="Crea plantillas base y asígnalas a múltiples grupos"
        actions={
          <Button onClick={() => setShowBuilder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Plantilla
          </Button>
        }
      />

      <div className="p-6">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar plantilla por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Listado */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 animate-pulse">Cargando plantillas...</div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No hay plantillas</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
                Crea tu primera plantilla de entrenamiento para asignarla a los grupos de la academia.
              </p>
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Plantilla Base
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-0">
                  <div className="p-5 border-b border-border">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg line-clamp-1" title={template.name}>{template.name}</h3>
                      <button className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium">
                        {template.weeksCount} Seman{template.weeksCount > 1 ? 'as' : 'a'}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                        {template.daysPerWeek} días/sem
                      </span>
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3 pt-3 flex justify-between items-center rounded-b-lg">
                    <span className="text-xs text-muted-foreground">
                      {template.weeks?.length || 0} sesiones totales
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => setAssigningTemplate(template)}>
                      Aplicar a Grupos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AssignPlanDialog
        template={assigningTemplate}
        isOpen={!!assigningTemplate}
        onClose={() => setAssigningTemplate(null)}
      />
    </div>
  )
}
