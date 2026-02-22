// ==========================================
// Toaster Component - Contenedor de Toasts
// ==========================================
// Componente que muestra todas las notificaciones toast activas.
// Se debe incluir una sola vez en el layout principal de la aplicación.

import { useToast } from '@/hooks/use-toast'
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-4 rounded-lg shadow-lg
            border animate-in slide-in-from-top-2 duration-300
            ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-900'
                : toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : toast.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
            }
          `}
        >
          {/* Icono según el tipo */}
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {toast.type === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
            {toast.type === 'warning' && (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            {toast.type === 'info' && <Info className="h-5 w-5 text-blue-600" />}
          </div>

          {/* Mensaje */}
          <div className="flex-1 text-sm font-medium">{toast.message}</div>

          {/* Botón cerrar */}
          <button
            onClick={() => dismiss(toast.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
