import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { parseExcelSerialDate } from '@/lib/excel'
import ExcelJS from 'exceljs'

interface ImportedPlayer {
  firstName: string
  lastName: string
  dni: string
  birthDate: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  level: string
  status: string
  clothingSize?: string
}

interface ImportPlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (players: ImportedPlayer[]) => void
}

interface ParsedRow {
  player: ImportedPlayer
  errors: string[]
  isValid: boolean
}

const columnMappings: Record<string, string> = {
  'nombre': 'firstName',
  'apellidos': 'lastName',
  'apellido': 'lastName',
  'dni': 'dni',
  'nif': 'dni',
  'fecha nacimiento': 'birthDate',
  'fecha de nacimiento': 'birthDate',
  'nacimiento': 'birthDate',
  'email': 'email',
  'correo': 'email',
  'telefono': 'phone',
  'teléfono': 'phone',
  'movil': 'phone',
  'móvil': 'phone',
  'direccion': 'address',
  'dirección': 'address',
  'ciudad': 'city',
  'codigo postal': 'postalCode',
  'código postal': 'postalCode',
  'cp': 'postalCode',
  'nivel': 'level',
  'estado': 'status',
  'talla': 'clothingSize',
  'talla de ropa': 'clothingSize',
  'talla ropa': 'clothingSize',
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function mapColumnHeader(header: string): string | null {
  const normalized = normalizeHeader(header)
  // Try exact match first (on the normalized version of both sides)
  for (const [key, value] of Object.entries(columnMappings)) {
    const normalizedKey = normalizeHeader(key)
    if (normalized === normalizedKey) {
      return value
    }
  }
  return null
}

function parseDate(value: unknown): string {
  if (!value) return ''

  if (typeof value === 'number') {
    return parseExcelSerialDate(value)
  }

  const str = String(value).trim()

  // Try dd/mm/yyyy or dd-mm-yyyy
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (dmy) {
    const d = String(parseInt(dmy[1])).padStart(2, '0')
    const m = String(parseInt(dmy[2])).padStart(2, '0')
    const y = dmy[3]
    return `${y}-${m}-${d}`
  }

  // Try yyyy-mm-dd (already ISO)
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const y = iso[1]
    const m = String(parseInt(iso[2])).padStart(2, '0')
    const d = String(parseInt(iso[3])).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return str
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return true // empty is ok (not required)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const y = parseInt(match[1])
  const m = parseInt(match[2])
  const d = parseInt(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false
  return true
}

function validateRow(player: ImportedPlayer): string[] {
  const errors: string[] = []
  if (!player.firstName.trim()) {
    errors.push('Nombre es obligatorio')
  }
  if (!player.lastName.trim()) {
    errors.push('Apellidos es obligatorio')
  }
  if (player.birthDate && !isValidDate(player.birthDate)) {
    errors.push('Fecha de nacimiento no valida')
  }
  return errors
}

function ImportPlayersDialog({ open, onOpenChange, onImport }: ImportPlayersDialogProps) {
  const [fileName, setFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [parseError, setParseError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validCount = parsedRows.filter((r) => r.isValid).length
  const errorCount = parsedRows.filter((r) => !r.isValid).length
  const hasFile = parsedRows.length > 0

  const resetFile = useCallback(() => {
    setFileName('')
    setParsedRows([])
    setParseError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const processWorkbook = useCallback(async (data: Uint8Array, name: string) => {
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(data.buffer as ArrayBuffer)
      const ws = wb.worksheets[0]
      if (!ws) {
        setParseError('El archivo no contiene hojas')
        return
      }

      // Read header row (row 1)
      const headerRow = ws.getRow(1)
      const headers: string[] = []
      headerRow.eachCell({ includeEmpty: false }, (cell) => {
        headers.push(String(cell.value ?? ''))
      })

      if (headers.length === 0) {
        setParseError('El archivo no contiene datos')
        return
      }

      // Build column map
      const headerMap: Record<number, string> = {}
      headers.forEach((header, idx) => {
        const mapped = mapColumnHeader(header)
        if (mapped) headerMap[idx + 1] = mapped // exceljs is 1-indexed
      })

      // Parse data rows
      const rows: ParsedRow[] = []
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return // skip header
        const player: ImportedPlayer = {
          firstName: '', lastName: '', dni: '', birthDate: '',
          email: '', phone: '', address: '', city: '',
          postalCode: '', level: '', status: '', clothingSize: '',
        }
        Object.entries(headerMap).forEach(([colIdx, fieldName]) => {
          const cell = row.getCell(Number(colIdx))
          const rawValue = cell.value
          if (fieldName === 'birthDate') {
            if (rawValue instanceof Date) {
              const y = rawValue.getFullYear()
              const m = String(rawValue.getMonth() + 1).padStart(2, '0')
              const d = String(rawValue.getDate()).padStart(2, '0')
                ; (player as unknown as Record<string, string>)[fieldName] = `${y}-${m}-${d}`
            } else {
              ; (player as unknown as Record<string, string>)[fieldName] = parseDate(rawValue)
            }
          } else {
            ; (player as unknown as Record<string, string>)[fieldName] =
              rawValue != null ? String(rawValue).trim() : ''
          }
        })
        const errors = validateRow(player)
        rows.push({ player, errors, isValid: errors.length === 0 })
      })

      if (rows.length === 0) {
        setParseError('El archivo no contiene datos')
        return
      }

      setFileName(name)
      setParsedRows(rows)
      setParseError('')
    } catch {
      setParseError('Error al leer el archivo. Asegurate de que es un archivo Excel valido.')
    }
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      if (
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls')
      ) {
        setParseError('Formato no soportado. Usa archivos .xlsx o .xls')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (result) {
          const data = new Uint8Array(result as ArrayBuffer)
          processWorkbook(data, file.name)
        }
      }
      reader.onerror = () => {
        setParseError('Error al leer el archivo')
      }
      reader.readAsArrayBuffer(file)
    },
    [processWorkbook]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleImport = useCallback(() => {
    const validPlayers = parsedRows.filter((r) => r.isValid).map((r) => r.player)
    onImport(validPlayers)
    resetFile()
    onOpenChange(false)
  }, [parsedRows, onImport, onOpenChange, resetFile])

  const handleClose = useCallback(
    (value: boolean) => {
      if (!value) {
        resetFile()
      }
      onOpenChange(value)
    },
    [onOpenChange, resetFile]
  )

  const previewRows = parsedRows.slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar jugadores</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel con los datos de los jugadores para importarlos al sistema.
          </DialogDescription>
        </DialogHeader>

        {!hasFile ? (
          <div>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">
                Arrastra un archivo Excel o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Formatos aceptados: .xlsx, .xls
              </p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {parseError && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={resetFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  {validCount} {validCount === 1 ? 'valido' : 'validos'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">{errorCount} con errores</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {parsedRows.length} filas en total
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Apellidos</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">DNI</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="p-2">
                        {row.isValid ? (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" title={row.errors.join(', ')}>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">{row.player.firstName || '-'}</td>
                      <td className="p-2">{row.player.lastName || '-'}</td>
                      <td className="p-2">{row.player.dni || '-'}</td>
                      <td className="p-2 max-w-[160px] truncate">{row.player.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">
                Mostrando 10 de {parsedRows.length} filas
              </p>
            )}

            {/* Error details */}
            {errorCount > 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive">
                  Errores encontrados:
                </p>
                {parsedRows
                  .filter((r) => !r.isValid)
                  .slice(0, 5)
                  .map((row, idx) => (
                    <p key={idx} className="text-xs text-destructive/80">
                      Fila {parsedRows.indexOf(row) + 1}: {row.errors.join(', ')}
                    </p>
                  ))}
                {errorCount > 5 && (
                  <p className="text-xs text-destructive/60">
                    ...y {errorCount - 5} errores mas
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={validCount === 0}>
            <Upload className="h-4 w-4 mr-2" />
            Importar {validCount > 0 ? `${validCount} jugador${validCount === 1 ? '' : 'es'}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ImportPlayersDialog, type ImportedPlayer }
