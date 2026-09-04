// ==========================================
// WhatsApp Notification Dialog
// ==========================================
// Editable pre-send dialog that opens a wa.me deep link. Accepts one or
// several recipients — after each send it advances to the next one until
// the queue is exhausted.

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MessageCircle, Phone } from 'lucide-react'

export interface WhatsAppPayload {
    /** Recipient phone number (with or without international prefix) */
    phone: string
    /** Pre-filled message template */
    message: string
    /** Display name shown in the dialog */
    recipientName: string
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    payloads: WhatsAppPayload[]
}

// Normalise phone: strips spaces/dashes, adds +34 if no leading +
function formatPhone(raw: string): string {
    const cleaned = raw.replace(/[\s\-().]/g, '')
    if (!cleaned) return ''
    if (cleaned.startsWith('+')) return cleaned
    if (cleaned.startsWith('00')) return '+' + cleaned.slice(2)
    return '+34' + cleaned
}

export function WhatsAppNotificationDialog({ open, onOpenChange, payloads }: Props) {
    const [index, setIndex] = useState(0)
    const [message, setMessage] = useState('')

    const payload = payloads[index] ?? null

    // Reset the queue position and message every time the dialog opens
    useEffect(() => {
        if (open) setIndex(0)
    }, [open])

    useEffect(() => {
        if (payload) setMessage(payload.message)
    }, [payload])

    const phone = payload ? formatPhone(payload.phone) : ''
    const isPhoneValid = phone.length >= 10
    const isLast = index >= payloads.length - 1

    const handleSend = () => {
        if (!isPhoneValid) return
        const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank', 'noopener,noreferrer')
        if (isLast) {
            onOpenChange(false)
        } else {
            setIndex((i) => i + 1)
        }
    }

    const handleSkip = () => {
        if (isLast) {
            onOpenChange(false)
        } else {
            setIndex((i) => i + 1)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-500" />
                        Enviar aviso por WhatsApp
                        {payloads.length > 1 && (
                            <span className="text-sm font-normal text-muted-foreground ml-auto">
                                {index + 1} de {payloads.length}
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Revisa y edita el mensaje antes de abrirlo en WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Phone */}
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{payload?.recipientName}</span>
                        <span className="text-muted-foreground ml-auto font-mono">
                            {isPhoneValid ? phone : <span className="text-destructive">Sin teléfono válido</span>}
                        </span>
                    </div>

                    {/* Editable message */}
                    <div className="space-y-1.5">
                        <Label htmlFor="wa-message">Mensaje</Label>
                        <textarea
                            id="wa-message"
                            rows={6}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        <p className="text-xs text-muted-foreground">{message.length} caracteres</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    {payloads.length > 1 && !isPhoneValid && (
                        <Button variant="outline" onClick={handleSkip}>
                            Saltar
                        </Button>
                    )}
                    <Button
                        onClick={handleSend}
                        disabled={!isPhoneValid || !message.trim()}
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                        <MessageCircle className="h-4 w-4" />
                        {isLast ? 'Abrir en WhatsApp' : 'Abrir y siguiente'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
