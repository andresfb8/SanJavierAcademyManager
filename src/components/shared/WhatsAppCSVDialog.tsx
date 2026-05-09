import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Download, MessageCircle, Users } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { usePaymentsQuery } from '@/hooks/useQueries'
import { generateWhatsAppCSV, descargarCSV } from '@/lib/whatsapp-csv-export'

const PLANTILLA_DEFAULT = `Hola {{nombre}}, te contactamos del {{club}}.

Tienes {{num_recibos}} cuota(s) pendiente(s) correspondiente(s) a {{meses}} por un total de {{deuda}}€.

Por favor, regulariza tu situación lo antes posible para continuar disfrutando de las clases.

Si ya has realizado el pago, ignora este mensaje.

Gracias 🎾`

interface WhatsAppCSVDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WhatsAppCSVDialog({ open, onOpenChange }: WhatsAppCSVDialogProps) {
  const { players } = useDataStore()
  const { data: payments = [] } = usePaymentsQuery(new Date().getFullYear())
  const [plantilla, setPlantilla] = useState(PLANTILLA_DEFAULT)

  const { rows, sinTelefono } = useMemo(
    () => generateWhatsAppCSV(payments, players, plantilla),
    [payments, players, plantilla]
  )

  const handleDescargar = () => {
    descargarCSV(rows)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Envío masivo WhatsApp — Exportar Excel
          </DialogTitle>
          <DialogDescription>
            Genera el Excel (.xlsx) con los morosos y súbelo a WAPI Sender
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{rows.length}</p>
              <p className="text-xs text-green-600 font-medium">Con teléfono</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{sinTelefono.length}</p>
              <p className="text-xs text-red-600 font-medium">Sin teléfono</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {rows.reduce((s, r) => s + parseFloat(r.deuda_total || "0"), 0).toFixed(0)}€
              </p>
              <p className="text-xs text-blue-600 font-medium">Deuda total</p>
            </div>
          </div>

          {/* Sin teléfono */}
          {sinTelefono.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                  {sinTelefono.length} jugador(es) sin teléfono registrado
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {sinTelefono.map(p => (
                  <Badge key={p.id} variant="outline" className="text-xs border-amber-300 text-amber-700">
                    {p.firstName} {p.lastName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Preview de morosos */}
          {rows.length > 0 && (
            <div>
              <Label className="mb-2 block">Morosos que recibirán el mensaje</Label>
              <div className="rounded-lg border max-h-40 overflow-y-auto divide-y text-sm">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="font-medium">{r.nombre}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-xs">{r.telefono}</span>
                      <Badge variant="destructive" className="text-xs">{r.deuda_total}€</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor de plantilla */}
          <div>
            <Label htmlFor="plantilla" className="mb-2 block">
              Plantilla del mensaje
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                Variables: {`{{nombre}} {{deuda}} {{num_recibos}} {{meses}} {{club}}`}
              </span>
            </Label>
            <Textarea
              id="plantilla"
              value={plantilla}
              onChange={e => setPlantilla(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Preview del primer mensaje */}
          {rows.length > 0 && (
            <div>
              <Label className="mb-2 block">Preview — mensaje de {rows[0].nombre}</Label>
              <div className="rounded-lg bg-[#dcf8c6] border p-3 text-sm whitespace-pre-wrap font-sans">
                {rows[0].mensaje}
              </div>
            </div>
          )}

          {/* Instrucciones */}
          <div className="rounded-lg bg-muted/50 border p-4 space-y-2 text-sm">
            <p className="font-semibold">Pasos tras descargar el Excel para WhatSender:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Abre WhatSender.</li>
              <li>Sube el archivo Excel (.xlsx) que acabas de descargar.</li>
              <li>En la caja de mensaje de WhatSender, escribe SOLO la variable <strong>@value1</strong>.</li>
              <li>Al enviar, WhatSender cogerá todo el mensaje personalizado de la segunda columna (que se asigna a @value1) y lo enviará correctamente.</li>
              <li>Configura un tiempo de espera de seguridad entre envíos y dale a empezar.</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDescargar}
            disabled={rows.length === 0}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Descargar Excel ({rows.length} contactos)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
