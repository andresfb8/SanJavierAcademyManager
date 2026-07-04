import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { GraduationCap, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { USER_ROLES } from '@/constants'
import type { Invitation } from '@/types'

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return new Date(value as string)
}

/**
 * Activación de cuentas invitadas desde Usuarios (colección 'invitations'):
 * staff, jugadores y tutores. Ruta pública /activar/:token.
 */
export default function ActivateInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { signupFromInvitation, isLoading: authLoading } = useAuthStore()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setError('Enlace de activación inválido.')
        setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'invitations', token))
        if (!snap.exists()) {
          setError('Enlace de activación inválido o expirado.')
          return
        }
        const data = snap.data()
        const inv: Invitation = {
          ...(data as Omit<Invitation, 'id' | 'createdAt' | 'expiresAt'>),
          id: snap.id,
          createdAt: toDate(data.createdAt),
          expiresAt: toDate(data.expiresAt),
        }
        if (inv.status === 'aceptada') {
          setError('Esta invitación ya fue utilizada. Inicia sesión con tu cuenta.')
          return
        }
        if (inv.status === 'expirada' || inv.expiresAt < new Date()) {
          setError('Esta invitación ha expirado. Solicita una nueva a tu academia.')
          return
        }
        setInvitation(inv)
      } catch (err) {
        console.error('Error loading invitation:', err)
        setError('No se pudo cargar la invitación. Inténtalo de nuevo.')
      } finally {
        setLoading(false)
      }
    }
    loadInvitation()
  }, [token])

  const roleLabel = invitation
    ? USER_ROLES.find((r) => r.value === invitation.role)?.label ?? invitation.role
    : ''

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invitation) return
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    try {
      await signupFromInvitation(invitation, password)
      setIsSuccess(true)
      toast.success('¡Cuenta activada con éxito!')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      console.error(err)
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-in-use') {
        toast.error('Ya existe una cuenta con este email. Inicia sesión.')
      } else {
        toast.error('Ocurrió un error inesperado al activar la cuenta')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center p-8 rounded-[2rem] border-none shadow-xl">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">¡Todo listo!</h2>
          <p className="text-slate-500 mb-6">Tu cuenta ha sido activada. Redirigiéndote a tu portal...</p>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mx-auto" />
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
        <div className="bg-emerald-600 p-8 text-center text-white">
          <div className="flex justify-center mb-4">
            <GraduationCap className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-black">Activar mi cuenta</CardTitle>
          <CardDescription className="text-emerald-100 mt-2">
            {invitation
              ? `Invitación como ${roleLabel}. Establece tu contraseña para empezar.`
              : 'Activación de cuenta'}
          </CardDescription>
        </div>

        <CardContent className="p-8">
          {error ? (
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-6">{error}</p>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/login')}>
                Volver al Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</Label>
                <Input
                  id="email"
                  value={invitation?.email || ''}
                  disabled
                  className="bg-slate-50 border-slate-100 rounded-xl h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass" className="text-xs font-bold uppercase tracking-wider text-slate-400">Nueva Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="pass"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-12 bg-slate-50 border-slate-100 rounded-xl h-12 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirmar Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-12 bg-slate-50 border-slate-100 rounded-xl h-12 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                disabled={authLoading}
              >
                {authLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Activar Cuenta
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
