// ==========================================
// Toast Hook - Sistema de notificaciones
// ==========================================
// Hook personalizado para mostrar notificaciones toast en la aplicación.
// Basado en el patrón de shadcn/ui pero simplificado para este proyecto.

import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
}

// Estado global de toasts (simple, sin Zustand para evitar dependencias circulares)
let toastState: ToastState = { toasts: [] }
let listeners: Array<(state: ToastState) => void> = []

const notifyListeners = () => {
  listeners.forEach((listener) => listener(toastState))
}

const addToast = (toast: Omit<Toast, 'id'>): void => {
  const id = Math.random().toString(36).substring(2, 9)
  const newToast: Toast = { ...toast, id }

  toastState = {
    toasts: [...toastState.toasts, newToast],
  }
  notifyListeners()

  // Auto-dismiss después de la duración especificada
  const duration = toast.duration ?? 3000
  setTimeout(() => {
    removeToast(id)
  }, duration)
}

const removeToast = (id: string): void => {
  toastState = {
    toasts: toastState.toasts.filter((t) => t.id !== id),
  }
  notifyListeners()
}

// Hook principal
export function useToast() {
  const [state, setState] = useState<ToastState>(toastState)

  // Suscribirse a cambios
  useState(() => {
    listeners.push(setState)
    return () => {
      listeners = listeners.filter((listener) => listener !== setState)
    }
  })

  const toast = useCallback(
    (options: { type: ToastType; message: string; duration?: number }) => {
      addToast(options)
    },
    []
  )

  const success = useCallback((message: string, duration?: number) => {
    addToast({ type: 'success', message, duration })
  }, [])

  const error = useCallback((message: string, duration?: number) => {
    addToast({ type: 'error', message, duration })
  }, [])

  const info = useCallback((message: string, duration?: number) => {
    addToast({ type: 'info', message, duration })
  }, [])

  const warning = useCallback((message: string, duration?: number) => {
    addToast({ type: 'warning', message, duration })
  }, [])

  const dismiss = useCallback((id: string) => {
    removeToast(id)
  }, [])

  return {
    toasts: state.toasts,
    toast,
    success,
    error,
    info,
    warning,
    dismiss,
  }
}

// API global para usar sin hook (útil para llamadas desde stores)
export const toast = {
  success: (message: string, duration?: number) =>
    addToast({ type: 'success', message, duration }),
  error: (message: string, duration?: number) =>
    addToast({ type: 'error', message, duration }),
  info: (message: string, duration?: number) =>
    addToast({ type: 'info', message, duration }),
  warning: (message: string, duration?: number) =>
    addToast({ type: 'warning', message, duration }),
}
