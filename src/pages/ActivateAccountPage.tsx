import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

/**
 * Ruta heredada. Los enlaces antiguos (`/activar-cuenta?token=&email=`) usaban
 * `player.invitationToken`, que no se puede resolver sin estar autenticado, así
 * que nunca llegaban a activar la cuenta. El alta se hace ahora siempre desde
 * `/activar/:token` (colección `invitations`).
 */
export default function ActivateAccountPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center p-8 rounded-[2rem] border-none shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Este enlace ya no es válido</h2>
        <p className="text-slate-500 mb-6">
          Los enlaces de activación antiguos han dejado de funcionar. Pide a la academia que te
          envíe una invitación nueva y podrás crear tu contraseña.
        </p>
        <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/login')}>
          Ir al inicio de sesión
        </Button>
      </Card>
    </div>
  )
}
