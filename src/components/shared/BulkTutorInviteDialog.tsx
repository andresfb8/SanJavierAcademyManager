import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { Copy, Check, Users, AlertCircle } from 'lucide-react'
import type { Player } from '@/types'

interface FamilyCandidate {
  email: string
  guardianName: string
  players: Player[]
}

interface BulkResult {
  email: string
  guardianName: string
  activationUrl?: string
  emailed?: boolean
  error?: boolean
}

interface BulkTutorInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Invitación masiva de tutores: detecta menores activos con email de tutor en su
 * ficha (guardian.email), agrupa hermanos por email común y crea las invitaciones
 * en bloque con rol 'tutor'.
 */
export function BulkTutorInviteDialog({ open, onOpenChange }: BulkTutorInviteDialogProps) {
  const { players, invitations, users } = useDataStore()
  const { user } = useAuthStore()

  const [selectedEmails, setSelectedEmails] = useState<Set<string> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [copiedEmail, setCopiedEmail] = useState('')

  const families = useMemo<FamilyCandidate[]>(() => {
    // Emails que ya tienen cuenta o invitación pendiente
    const takenEmails = new Set<string>()
    for (const u of users) {
      if (u.email) takenEmails.add(u.email.trim().toLowerCase())
    }
    for (const inv of invitations) {
      if (inv.status === 'pendiente') takenEmails.add(inv.email.trim().toLowerCase())
    }

    const byEmail = new Map<string, FamilyCandidate>()
    for (const p of players) {
      if (p.status !== 'activo' || !p.isMinor) continue
      const email = p.guardian?.email?.trim().toLowerCase()
      if (!email || takenEmails.has(email)) continue

      const existing = byEmail.get(email)
      if (existing) {
        existing.players.push(p)
      } else {
        byEmail.set(email, {
          email,
          guardianName: `${p.guardian?.firstName ?? ''} ${p.guardian?.lastName ?? ''}`.trim() || email,
          players: [p],
        })
      }
    }
    return [...byEmail.values()].sort((a, b) => a.guardianName.localeCompare(b.guardianName))
  }, [players, invitations, users])

  // Por defecto todas las familias seleccionadas
  const effectiveSelection = selectedEmails ?? new Set(families.map((f) => f.email))

  function toggleFamily(email: string) {
    const next = new Set(effectiveSelection)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setSelectedEmails(next)
  }

  function handleClose() {
    onOpenChange(false)
    setSelectedEmails(null)
    setResults(null)
    setSubmitting(false)
    setCopiedEmail('')
  }

  async function handleSubmit() {
    const selected = families.filter((f) => effectiveSelection.has(f.email))
    if (selected.length === 0) return
    setSubmitting(true)

    const outcome: BulkResult[] = []
    for (const family of selected) {
      try {
        const { activationUrl } = await createInvitation({
          email: family.email,
          role: 'tutor',
          clubId: user?.clubId ?? 'club-001',
          createdBy: user?.id ?? 'unknown',
          linkedPlayerIds: family.players.map((p) => p.id),
        })

        let emailed = false
        try {
          await sendInvitationEmail(
            { name: family.guardianName, email: family.email },
            activationUrl,
            'tutor'
          )
          emailed = true
        } catch (emailErr) {
          console.error(`No se pudo enviar el correo a ${family.email}:`, emailErr)
        }

        outcome.push({ email: family.email, guardianName: family.guardianName, activationUrl, emailed })
      } catch (err) {
        console.error(`Error creating tutor invitation for ${family.email}:`, err)
        outcome.push({ email: family.email, guardianName: family.guardianName, error: true })
      }
    }

    setResults(outcome)
    setSubmitting(false)
  }

  function handleCopyLink(result: BulkResult) {
    if (!result.activationUrl) return
    navigator.clipboard.writeText(result.activationUrl).then(() => {
      setCopiedEmail(result.email)
      setTimeout(() => setCopiedEmail(''), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Invitar tutores
          </DialogTitle>
          <DialogDescription>
            Menores activos con email de tutor en su ficha, sin cuenta ni invitación pendiente.
            Los hermanos con el mismo email se agrupan en una sola invitación.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {results.map((r) => (
              <div key={r.email} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.guardianName}</p>
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
                    {copiedEmail === r.email ? (
                      <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Copiado</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copiar enlace</>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : families.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No hay familias pendientes de invitar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos los menores con email de tutor ya tienen cuenta o invitación pendiente.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {families.map((family) => (
              <label
                key={family.email}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <Checkbox
                  checked={effectiveSelection.has(family.email)}
                  onCheckedChange={() => toggleFamily(family.email)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{family.guardianName}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {family.players.length} hijo{family.players.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{family.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {family.players.map((p) => `${p.firstName} ${p.lastName}`).join(' · ')}
                  </p>
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
                disabled={submitting || families.length === 0 || effectiveSelection.size === 0}
              >
                {submitting
                  ? 'Creando invitaciones...'
                  : `Invitar ${effectiveSelection.size} familia${effectiveSelection.size !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
