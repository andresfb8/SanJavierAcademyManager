import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  User,
  Calendar,
  Users,
  Target,
  Brain,
  HeartPulse,
  MessageSquare,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { MatchReport } from '@/types'

// ==========================================
// MatchReportDetailView - Vista detalle informe de partido
// ==========================================

interface MatchReportDetailViewProps {
  report: MatchReport
  onClose: () => void
}

function SectionCard({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  content: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  )
}

export function MatchReportDetailView({
  report,
  onClose,
}: MatchReportDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <Button variant="ghost" size="sm" onClick={onClose} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a informes
        </Button>
        <h2 className="text-lg sm:text-xl font-bold mb-1">{report.title}</h2>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Evaluador: {report.coachName}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(new Date(report.date))}
          </span>
        </div>
      </div>

      {/* Jugadores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Jugadores ({report.playerNames.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {report.playerNames.map((name, idx) => (
              <Badge key={idx} variant="secondary" className="text-sm py-1 px-2.5">
                {name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Secciones */}
      <SectionCard
        icon={Target}
        title="Tactica"
        content={report.tacticsComment}
      />

      <SectionCard
        icon={Brain}
        title="Toma de decisiones"
        content={report.decisionMakingComment}
      />

      <SectionCard
        icon={HeartPulse}
        title="Aspecto mental"
        content={report.mentalComment}
      />

      {/* Comentario general (opcional) */}
      {report.generalComment && (
        <SectionCard
          icon={MessageSquare}
          title="Comentario general"
          content={report.generalComment}
        />
      )}
    </div>
  )
}
