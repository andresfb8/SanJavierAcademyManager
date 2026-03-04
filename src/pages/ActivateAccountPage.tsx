import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useDataStore } from '@/stores/dataStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import type { Invitation } from '@/types'

const roleLabels: Record<string, string> = {
  director: 'Director',
  coordinador: 'Coordinador',
  entrenador: 'Entrenador',
  jugador: 'Jugador',
  tutor: 'Padre/Madre/Tutor',
}

export default function ActivateAccountPage() {
  const { token } = useParams<{ token: string }>()
  const { updateInvitation, updateCoach } = useDataStore()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [invitation, setInvitation] = useState<Invitation | null>(null)

  // Load invitation from Firestore
  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const invitationDoc = await getDoc(doc(db, 'invitations', token))
        if (invitationDoc.exists()) {
          const data = invitationDoc.data()
          setInvitation({
            id: invitationDoc.id,
            email: data.email,
            role: data.role,
            clubId: data.clubId,
            status: data.status,
            token: data.token,
            createdBy: data.createdBy,
            coachId: data.coachId,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
            linkedPlayerId: data.linkedPlayerId,
            linkedPlayerIds: data.linkedPlayerIds,
            acceptedAt: data.acceptedAt?.toDate?.() || data.acceptedAt,
          } as Invitation)
        }
      } catch (err) {
        console.error('Error loading invitation:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadInvitation()
  }, [token])

  // Determine status
  const isExpired = invitation && invitation.status === 'expirada'
  const isAccepted = invitation && invitation.status === 'aceptada'
  const isDateExpired =
    invitation && invitation.status === 'pendiente' && new Date() > new Date(invitation.expiresAt)
  const isValid = invitation && invitation.status === 'pendiente' && !isDateExpired

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio'
    }

    if (!password) {
      newErrors.pwd = 'La contrasena es obligatoria'
    } else if (password.length < 6) {
      newErrors.pwd = 'La contrasena debe tener al menos 6 caracteres'
    }

    if (!confirmPassword) {
      newErrors.confirmPwd = 'Debes confirmar la contrasena'
    } else if (password !== confirmPassword) {
      newErrors.confirmPwd = 'Las contrasenas no coinciden'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate() || !invitation) return

    setIsSubmitting(true)
    setErrors({})

    try {
      // 1. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, invitation.email, password)

      // 2. Update display name
      await updateProfile(credential.user, { displayName: name.trim() })

      // 3. Create Firestore user document with correct role
      const userDoc: Record<string, unknown> = {
        email: invitation.email,
        displayName: name.trim(),
        role: invitation.role,
        clubId: invitation.clubId,
        isActive: true,
        createdAt: new Date(),
      }
      if (invitation.linkedPlayerId) {
        userDoc.linkedPlayerId = invitation.linkedPlayerId
      }
      if (invitation.linkedPlayerIds && invitation.linkedPlayerIds.length > 0) {
        userDoc.linkedPlayerIds = invitation.linkedPlayerIds
      }
      await setDoc(doc(db, 'users', credential.user.uid), userDoc)

      // 4. Link coach record in Firestore directly (store is empty/unauthenticated here)
      if (invitation.role === 'entrenador' || invitation.role === 'coordinador') {
        const nameParts = name.trim().split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        const clubId = invitation.clubId

        let coachDocId: string | null = null

        // Priority 1: use coachId stored in the invitation
        if (invitation.coachId) {
          const coachSnap = await getDoc(doc(db, 'coaches', invitation.coachId))
          if (coachSnap.exists()) {
            coachDocId = invitation.coachId
          }
        }

        // Priority 2: find by email in Firestore
        if (!coachDocId) {
          const coachQuery = query(
            collection(db, 'coaches'),
            where('clubId', '==', clubId),
            where('email', '==', invitation.email.toLowerCase()),
            limit(1)
          )
          const coachSnap = await getDocs(coachQuery)
          if (!coachSnap.empty) {
            coachDocId = coachSnap.docs[0].id
          }
        }

        if (coachDocId) {
          // Update the coach's userId directly in Firestore
          await updateDoc(doc(db, 'coaches', coachDocId), {
            userId: credential.user.uid,
            firstName,
            lastName,
          })
          // Also update local store as best-effort (may be a no-op if store is empty)
          updateCoach(coachDocId, { userId: credential.user.uid, firstName, lastName })
        } else {
          console.warn('[ActivateAccount] No coach record found to link. Creating one.')
          // Fallback: create new coach doc directly in Firestore
          const newCoachId = credential.user.uid // use uid as a stable id
          await setDoc(doc(db, 'coaches', newCoachId), {
            id: newCoachId,
            firstName,
            lastName,
            dni: '',
            email: invitation.email.toLowerCase(),
            phone: '',
            hireDate: new Date(),
            isActive: true,
            staffRole: invitation.role,
            userId: credential.user.uid,
            clubId,
            createdAt: new Date(),
          })
        }
      }

      // 5. Mark invitation as accepted in Firestore
      try {
        await updateDoc(doc(db, 'invitations', token!), {
          status: 'aceptada',
          acceptedAt: new Date(),
        })
      } catch (err) {
        console.error('Error updating invitation in Firestore:', err)
      }

      // 6. Also update in local store as fallback/sync
      updateInvitation(invitation.id, {
        status: 'aceptada',
        acceptedAt: new Date(),
      })

      // 7. Sign out so the new user can log in fresh
      await auth.signOut()

      setSuccess(true)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-in-use') {
        setErrors({ pwd: 'Ya existe una cuenta con este email. Intenta iniciar sesion directamente.' })
      } else if (code === 'auth/weak-password') {
        setErrors({ pwd: 'La contrasena es demasiado debil. Usa al menos 6 caracteres.' })
      } else {
        setErrors({ pwd: 'Error al crear la cuenta. Intentalo de nuevo.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Render helpers ---

  const renderInvalidToken = () => (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <CardTitle>Enlace no valido</CardTitle>
        <CardDescription>
          Este enlace de invitacion no es valido. Es posible que haya sido eliminado o que la
          direccion sea incorrecta.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link to="/login">
          <Button variant="outline">Ir al inicio de sesion</Button>
        </Link>
      </CardContent>
    </Card>
  )

  const renderExpired = () => (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-orange-500" />
        </div>
        <CardTitle>Invitacion expirada</CardTitle>
        <CardDescription>
          Esta invitacion ha expirado. Contacta con el administrador de tu academia para solicitar
          una nueva invitacion.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link to="/login">
          <Button variant="outline">Ir al inicio de sesion</Button>
        </Link>
      </CardContent>
    </Card>
  )

  const renderAlreadyAccepted = () => (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <ShieldCheck className="h-12 w-12 text-blue-500" />
        </div>
        <CardTitle>Invitacion ya utilizada</CardTitle>
        <CardDescription>
          Esta invitacion ya fue utilizada para crear una cuenta. Si ya tienes cuenta, inicia sesion
          directamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link to="/login">
          <Button variant="outline">Ir al inicio de sesion</Button>
        </Link>
      </CardContent>
    </Card>
  )

  const renderSuccess = () => (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <CardTitle>Cuenta creada correctamente</CardTitle>
        <CardDescription>
          Ya puedes acceder con tu email y contrasena.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link to="/login">
          <Button>Ir al inicio de sesion</Button>
        </Link>
      </CardContent>
    </Card>
  )

  const renderForm = () => {
    if (!invitation) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle>Crear tu cuenta</CardTitle>
          <CardDescription>
            Completa los datos para activar tu cuenta en San Javier Academy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (read-only display) */}
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                {invitation.email}
              </p>
            </div>

            {/* Role (read-only display) */}
            <div className="space-y-2">
              <Label>Rol</Label>
              <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                {roleLabels[invitation.role] || invitation.role}
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ej: Juan Garcia Lopez"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.name
                      return next
                    })
                  }
                }}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimo 6 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.pwd) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.pwd
                        return next
                      })
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.pwd && (
                <p className="text-sm text-destructive">{errors.pwd}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repite la contrasena"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirmPwd) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.confirmPwd
                        return next
                      })
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPwd && (
                <p className="text-sm text-destructive">{errors.confirmPwd}</p>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  // --- Determine which view to show ---

  let content: React.ReactNode

  if (isLoading) {
    content = (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando invitacion...</p>
          </div>
        </CardContent>
      </Card>
    )
  } else if (success) {
    content = renderSuccess()
  } else if (!invitation) {
    content = renderInvalidToken()
  } else if (isExpired || isDateExpired) {
    content = renderExpired()
  } else if (isAccepted) {
    content = renderAlreadyAccepted()
  } else if (isValid) {
    content = renderForm()
  } else {
    content = renderInvalidToken()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            SJ
          </div>
          <div>
            <span className="text-lg font-semibold">San Javier</span>
            <span className="text-sm text-muted-foreground ml-1">Academy Manager</span>
          </div>
        </div>

        {content}
      </div>
    </div>
  )
}
