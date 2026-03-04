import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ChangePasswordDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const { changePassword } = useAuthStore()
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (newPassword !== confirmPassword) {
            toast({
                type: 'error',
                message: 'Las contraseñas nuevas no coinciden.',
            })
            return
        }

        if (newPassword.length < 6) {
            toast({
                type: 'error',
                message: 'La contraseña debe tener al menos 6 caracteres.',
            })
            return
        }

        setIsSubmitting(true)
        try {
            await changePassword(currentPassword, newPassword)
            toast({
                type: 'success',
                message: 'Contraseña actualizada correctamente.',
            })
            onOpenChange(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code
            if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
                toast({
                    type: 'error',
                    message: 'La contraseña actual es incorrecta.',
                })
            } else {
                toast({
                    type: 'error',
                    message: 'Error al cambiar la contraseña. Revisa tu conexión.',
                })
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-primary" />
                            Cambiar contraseña
                        </DialogTitle>
                        <DialogDescription>
                            Introduce tu contraseña actual para verificar tu identidad y establece una nueva contraseña.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Contraseña actual</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nueva contraseña</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>
                                Por seguridad, es posible que tengas que volver a iniciar sesión después de cambiar la contraseña en otros dispositivos.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}>
                            {isSubmitting ? (
                                <>
                                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Guardando...
                                </>
                            ) : (
                                'Cambiar contraseña'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
