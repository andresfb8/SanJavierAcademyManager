import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UploadCloud, CheckCircle, AlertCircle, ArrowRight, FileSpreadsheet } from 'lucide-react'
import { formatCurrency, normalizeText } from '@/lib/utils'
import type { Payment, Player } from '@/types'

interface SepaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingPayments: Payment[]
  players: Player[]
  onProcessConciliation: (
    paidPaymentIds: string[],
    returnedPayments: { paymentId: string; penaltyAmount: number }[]
  ) => void
}

type BankRow = Record<string, any>

interface MatchedPayment {
  bankRow: BankRow
  payment: Payment | null
  status: 'pagado' | 'devuelto' | 'ignorar'
}

export function SepaImportDialog({
  open,
  onOpenChange,
  pendingPayments,
  players,
  onProcessConciliation,
}: SepaImportDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [penaltyAmount, setPenaltyAmount] = useState<number>(1)
  const [bankData, setBankData] = useState<BankRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  
  // Mapeo de columnas
  const [nameCol, setNameCol] = useState<string>('')
  const [amountCol, setAmountCol] = useState<string>('')
  const [statusCol, setStatusCol] = useState<string>('')

  const [matches, setMatches] = useState<MatchedPayment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) as BankRow[]

        if (data.length > 0) {
          const cols = Object.keys(data[0])
          setHeaders(cols)
          setBankData(data)
          
          // Auto-detect columns (best effort)
          const nameC = cols.find(c => /nombre|titular|concepto|remitente/i.test(c)) || cols[0]
          const amtC = cols.find(c => /importe|cantidad|monto/i.test(c)) || cols[1] || ''
          const statC = cols.find(c => /estado|situación/i.test(c)) || ''
          
          setNameCol(nameC)
          setAmountCol(amtC)
          setStatusCol(statC)
          
          setStep(2)
        } else {
          alert('El archivo está vacío o no se pudo leer correctamente.')
        }
      } catch (error) {
        console.error(error)
        alert('Error al leer el archivo. Asegúrate de que es un Excel o CSV válido.')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleAutoMatch = () => {
    const newMatches: MatchedPayment[] = bankData.map(row => {
      const rowName = String(row[nameCol] || '')
      const rowAmount = parseFloat(String(row[amountCol]).replace(',', '.')) || 0
      const rowStatusStr = String(row[statusCol] || '').toLowerCase()

      // Determinar estado basado en la columna si existe
      let defaultStatus: 'pagado' | 'devuelto' | 'ignorar' = 'pagado'
      if (rowStatusStr.includes('devuelto') || rowStatusStr.includes('rechazado') || rowStatusStr.includes('impagado')) {
        defaultStatus = 'devuelto'
      }

      // Buscar coincidencia en pendingPayments (por importe y nombre de forma aproximada)
      const normRowName = normalizeText(rowName)
      let bestMatch: Payment | null = null
      
      // 1. Intentar coincidencia exacta de importe + texto en el nombre
      bestMatch = pendingPayments.find(p => 
        p.amount === rowAmount && 
        (normRowName.includes(normalizeText(p.playerName)) || normalizeText(p.playerName).includes(normRowName))
      ) || null

      // 2. Si no, solo importe
      if (!bestMatch) {
        bestMatch = pendingPayments.find(p => p.amount === rowAmount) || null
      }

      // 3. Si no, solo nombre
      if (!bestMatch) {
         bestMatch = pendingPayments.find(p => 
          normRowName.includes(normalizeText(p.playerName)) || normalizeText(p.playerName).includes(normRowName)
        ) || null
      }

      return {
        bankRow: row,
        payment: bestMatch,
        status: defaultStatus
      }
    })

    setMatches(newMatches)
  }

  // Si cambiamos las columnas, re-matcheamos
  const applyColumnMapping = () => {
    if (!nameCol) {
      alert('Debes seleccionar al menos una columna para identificar el pago (Nombre/Concepto).')
      return
    }
    handleAutoMatch()
  }

  const handleUpdateMatchStatus = (index: number, newStatus: 'pagado' | 'devuelto' | 'ignorar') => {
    const updated = [...matches]
    updated[index].status = newStatus
    setMatches(updated)
  }

  const handleUpdateMatchPayment = (index: number, paymentId: string) => {
    const updated = [...matches]
    const p = pendingPayments.find(p => p.id === paymentId) || null
    updated[index].payment = p
    setMatches(updated)
  }

  const handleConfirm = () => {
    const paidIds: string[] = []
    const returnedArr: { paymentId: string; penaltyAmount: number }[] = []

    // 1. Procesar coincidencias manuales del Excel
    matches.forEach(m => {
      if (m.payment) {
        if (m.status === 'pagado') paidIds.push(m.payment.id)
        else if (m.status === 'devuelto') returnedArr.push({ paymentId: m.payment.id, penaltyAmount })
      }
    })

    // 2. Los pagos pendientes que NO están en el Excel pueden ser cobrados, pero
    // dejaremos que el usuario procese estrictamente lo del Excel para ser seguros.
    // Opcionalmente, podríamos preguntar: "Hay X recibos pendientes que no aparecen en el Excel. ¿Deseas marcarlos como pagados también?"
    
    if (paidIds.length === 0 && returnedArr.length === 0) {
      alert('No hay ninguna acción a realizar. Asegúrate de asignar recibos a las filas del banco.')
      return
    }

    onProcessConciliation(paidIds, returnedArr)
    onOpenChange(false)
  }

  const resetState = () => {
    setStep(1)
    setBankData([])
    setMatches([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) resetState()
      onOpenChange(val)
    }}>
      <DialogContent className="max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Conciliación Bancaria SEPA
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 pb-4">
          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-lg border-2 border-dashed p-10 text-center flex flex-col items-center justify-center bg-muted/20">
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sube el archivo de tu banco</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Sube el archivo Excel (.xlsx) o CSV que has descargado de tu banco con la resolución de la remesa.
                </p>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  Seleccionar Archivo
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          {step === 2 && bankData.length > 0 && (
            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-3">1. Identificar Columnas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Columna de Nombre/Concepto *</Label>
                    <Select
                      options={headers.map(h => ({ value: h, label: h }))}
                      value={nameCol}
                      onChange={(e) => setNameCol(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Columna de Importe</Label>
                    <Select
                      options={[{ value: '', label: '-- Ninguna / No usar --' }, ...headers.map(h => ({ value: h, label: h }))]}
                      value={amountCol}
                      onChange={(e) => setAmountCol(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Columna de Estado (Opcional)</Label>
                    <Select
                      options={[{ value: '', label: '-- Ninguna / No usar --' }, ...headers.map(h => ({ value: h, label: h }))]}
                      value={statusCol}
                      onChange={(e) => setStatusCol(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button size="sm" onClick={applyColumnMapping}>Actualizar Mapeo</Button>
                </div>
              </div>

              {matches.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">2. Revisar Coincidencias</h4>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="penalty">Recargo por Devolución (€):</Label>
                      <Input
                        id="penalty"
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-24 text-right"
                        value={penaltyAmount}
                        onChange={(e) => setPenaltyAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dato del Banco</TableHead>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Recibo del Sistema</TableHead>
                          <TableHead className="w-40 text-right">Acción a realizar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matches.map((match, idx) => {
                          const rawName = String(match.bankRow[nameCol] || '')
                          const rawAmount = amountCol ? String(match.bankRow[amountCol] || '') : ''
                          const rawStatus = statusCol ? String(match.bankRow[statusCol] || '') : ''
                          
                          return (
                            <TableRow key={idx}>
                              <TableCell className="max-w-[200px] truncate">
                                <div className="font-medium text-sm truncate" title={rawName}>{rawName || '-'}</div>
                                {amountCol && <div className="text-xs text-muted-foreground">{rawAmount}€</div>}
                                {statusCol && rawStatus && <div className="text-xs text-muted-foreground mt-1 bg-muted inline-block px-1 rounded">{rawStatus}</div>}
                              </TableCell>
                              <TableCell>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell>
                                <Select
                                  options={[
                                    { value: '', label: '-- Seleccionar recibo --' },
                                    ...pendingPayments.map(p => ({
                                      value: p.id,
                                      label: `${p.playerName} - ${formatCurrency(p.amount)}`
                                    }))
                                  ]}
                                  value={match.payment?.id || ''}
                                  onChange={(e) => handleUpdateMatchPayment(idx, e.target.value)}
                                  className="w-full text-sm"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Select
                                  options={[
                                    { value: 'pagado', label: 'Cobrado' },
                                    { value: 'devuelto', label: 'Devuelto + Recargo' },
                                    { value: 'ignorar', label: 'Ignorar' }
                                  ]}
                                  value={match.status}
                                  onChange={(e) => handleUpdateMatchStatus(idx, e.target.value as any)}
                                  className={`w-full text-sm font-medium ${
                                    match.status === 'pagado' ? 'text-green-600 bg-green-50 border-green-200' :
                                    match.status === 'devuelto' ? 'text-red-600 bg-red-50 border-red-200' :
                                    'text-muted-foreground'
                                  }`}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === 2 && matches.length > 0 && (
            <Button onClick={handleConfirm} className="gap-1">
              <CheckCircle className="h-4 w-4" />
              Confirmar Conciliación
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
