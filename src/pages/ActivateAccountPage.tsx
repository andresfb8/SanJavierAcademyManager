import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { GraduationCap, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signupPlayer, isLoading: authLoading } = useAuthStore()
  const { players, updatePlayer } = useDataStore()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  
  const player = players.find(p => 
    p.email?.toLowerCase() === email?.toLowerCase() && 
    p.invitationToken === token
  )

  useEffect(() => {
    // Esperamos un poco a que carguen los players para no dar error falso
    if (players.length > 0) {
      if (!token || !email || !player) {
        setError('Enlace de activación inválido o expirado.')
      } else {
        setError(null)
      }
    }
  }, [token, email, player, players.length])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }

    if (!player || !email) return

    try {
      await signupPlayer(email, password, player.id)
      
      // Actualizar estado del jugador a activo y vincular uid
      // El uid se vinculará automáticamente en el dashboard al detectar el login, 
      // pero aquí marcamos la invitación como procesada.
      updatePlayer(player.id, { 
        invitationStatus: 'active',
        invitationToken: undefined // Limpiamos el token por seguridad
      })
      
      setIsSuccess(true)
      toast.success("¡Cuenta activada con éxito!")
      
      // Redirigir al dashboard después de un momento
      setTimeout(() => navigate('/'), 2000)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Ocurrió un error inesperado")
    }
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
          <CardTitle className="text-2xl font-black">Activar mi Portal</CardTitle>
          <CardDescription className="text-emerald-100 mt-2">
            Bienvenido, {player?.firstName || 'Alumno'}. Establece tu contraseña para empezar.
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
                  value={email || ''} 
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
