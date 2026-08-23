import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { getInvitablePlayers } from '@/lib/player-portal-status'
import { Copy, Check, Gamepad2, AlertCircle } from 'lucide-react'

interface PlayerCandidate {
  id: string
  name: string
  email: string
}

interface InviteResult {
  id: string
  name: string
  email: string
  activationUrl?: string
  emailed?: boolean
  error?: boolean
}

interface InvitePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Invitación masiva de jugadores: detecta jugadores activos, no menores, con
 * email propio, que todavía no tienen acceso al portal ni invitación
 * pendiente, y crea las invitaciones en bloque con rol 'jugador'.
 */
export function InvitePlayersDialog({ open, onOpenChange }: InvitePlayersDialogProps) {
  const { players, invitations, users } = useDataStore()
  const { user } = useAuthStore()

  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<InviteResult[] | null>(null)
  const [copiedId, setCopiedId] = useState('')

  const candidates = useMemo<PlayerCandidate[]>(() => {
    return getInvitablePlayers(players, users, invitations)
      .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [players, users, invitations])

  // Por defecto todos los candidatos están seleccionados
  const effectiveSelection = selectedIds ?? new Set(candidates.map((c) => c.id))

  function toggleCandidate(id: string) {
    const next = new Set(effectiveSelection)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function handleClose() {
    onOpenChange(false)
    setSelectedIds(null)
    setResults(null)
    setSubmitting(false)
    setCopiedId('')
  }

  async function handleSubmit() {
    const selected = candidates.filter((c) => effectiveSelection.has(c.id))
    if (selected.length === 0) return
    setSubmitting(true)

    const outcome: InviteResult[] = []
    for (const candidate of selected) {
      try {
        const { activationUrl } = await createInvitation({
          email: candidate.email,
          role: 'jugador',
          clubId: user?.clubId ?? 'club-001',
          createdBy: user?.id ?? 'unknown',
          linkedPlayerId: candidate.id,
        })

        let emailed = false
        try {
          await sendInvitationEmail({ name: candidate.name, email: candidate.email }, activationUrl, 'jugador')
          emailed = true
        } catch (emailErr) {
          console.error(`No se pudo enviar el correo a ${candidate.email}:`, emailErr)
        }

        outcome.push({ id: candidate.id, name: candidate.name, email: candidate.email, activationUrl, emailed })
      } catch (err) {
        console.error(`Error creando la invitación para ${candidate.email}:`, err)
        outcome.push({ id: candidate.id, name: candidate.name, email: candidate.email, error: true })
      }
    }

    setResults(outcome)
    setSubmitting(false)
  }

  function handleCopyLink(result: InviteResult) {
    if (!result.activationUrl) return
    navigator.clipboard.writeText(result.activationUrl).then(() => {
      setCopiedId(result.id)
      setTimeout(() => setCopiedId(''), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Invitar jugadores
          </DialogTitle>
          <DialogDescription>
            Jugadores activos, no menores de edad, con email propio, sin cuenta ni invitación pendiente.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {results.filter((r) => r.emailed).length} de {results.length} correos enviados
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {results.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  {!r.error && (
                    r.emailed ? (
                      <p className="text-[11px] font-medium text-emerald-600">Correo enviado</p>
                    ) : (
                      <p className="text-[11px] font-medium text-amber-600">Sin enviar — copia el enlace</p>
                    )
                  )}
                </div>
                {r.error ? (
                  <Badge variant="destructive" className="shrink-0">
                    <AlertCircle className="h-3 w-3 mr-1" /> Error
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleCopyLink(r)}>
                    {copiedId === r.id ? (
                      <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Copiado</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copiar enlace</>
                    )}
                  </Button>
                )}
              </div>
            ))}
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-8 text-center">
            <Gamepad2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No hay jugadores pendientes de invitar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos los jugadores activos ya tienen cuenta o invitación pendiente.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {candidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <Checkbox
                  checked={effectiveSelection.has(candidate.id)}
                  onCheckedChange={() => toggleCandidate(candidate.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{candidate.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || candidates.length === 0 || effectiveSelection.size === 0}
              >
                {submitting
                  ? 'Creando invitaciones...'
                  : `Invitar ${effectiveSelection.size} jugador${effectiveSelection.size !== 1 ? 'es' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
