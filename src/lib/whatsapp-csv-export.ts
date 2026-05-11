import type { Payment, Player } from '@/types'
import { MONTHS } from '@/constants'

export interface WhatsAppRow {
  telefono: string       // formato internacional sin +: 34612345678
  mensaje: string        // mensaje completo ya construido
  // Optional info for the CSV (some extensions allow adding extra columns, but usually only look at phone/message)
  nombre?: string
  deuda_total?: string
  num_recibos?: number
}

/**
 * Genera el CSV para la extensión de WhatsApp.
 * Agrupa por jugador y suma toda la deuda pendiente.
 */
export function generateWhatsAppCSV(
  payments: Payment[],
  players: Player[],
  plantilla: string      // plantilla con {{nombre}}, {{deuda}}, {{num_recibos}}
): { rows: WhatsAppRow[], sinTelefono: Player[] } {
  // 1. Filtrar pagos vencidos (pendiente + dueDate pasada)
  const hoy = new Date()
  const vencidos = payments.filter(p =>
    p.status === 'pendiente' &&
    p.dueDate &&
    new Date(p.dueDate) < hoy
  )

  // 2. Agrupar por jugador
  const porJugador = new Map<string, Payment[]>()
  for (const p of vencidos) {
    if (!porJugador.has(p.playerId)) porJugador.set(p.playerId, [])
    porJugador.get(p.playerId)!.push(p)
  }

  const rows: WhatsAppRow[] = []
  const sinTelefono: Player[] = []

  for (const [playerId, pagos] of porJugador.entries()) {
    const player = players.find(p => p.id === playerId)
    if (!player) continue

    // 3. Normalizar teléfono a formato internacional
    const telefonoRaw = player.phone ?? ''
    const telefono = normalizarTelefono(telefonoRaw)

    if (!telefono) {
      sinTelefono.push(player)
      continue
    }

    const deudaTotal = pagos.reduce((s, p) => s + p.amount, 0)
    const nombre = `${player.firstName} ${player.lastName}`

    // 4. Obtener meses ordenados
    // Ordenar los pagos por año y mes
    const pagosOrdenados = [...pagos].sort((a, b) => {
      if (a.billingYear !== b.billingYear) return a.billingYear - b.billingYear;
      return a.billingMonth - b.billingMonth;
    });
    
    // Obtener etiquetas de meses con el año si hay varios años, o solo el mes
    const etiquetasMeses = pagosOrdenados.map(p => {
      const nombreMes = MONTHS.find(m => m.value === p.billingMonth)?.label || p.billingMonth;
      return `${nombreMes} ${p.billingYear}`;
    });
    
    // Formatear como lista legible (ej: "Enero 2024, Febrero 2024 y Marzo 2024")
    let mesesTexto = '';
    if (etiquetasMeses.length === 1) {
      mesesTexto = etiquetasMeses[0];
    } else if (etiquetasMeses.length > 1) {
      const ultimos = etiquetasMeses.pop();
      mesesTexto = `${etiquetasMeses.join(', ')} y ${ultimos}`;
    }

    // 5. Sustituir variables en la plantilla
    const mensaje = plantilla
      .replace(/\{\{nombre\}\}/g, nombre)
      .replace(/\{\{deuda\}\}/g, deudaTotal.toFixed(2))
      .replace(/\{\{num_recibos\}\}/g, String(pagos.length))
      .replace(/\{\{meses\}\}/g, mesesTexto)
      .replace(/\{\{club\}\}/g, 'Club de Pádel San Javier')

    rows.push({
      telefono,
      mensaje,
      nombre,
      deuda_total: deudaTotal.toFixed(2),
      num_recibos: pagos.length,
    })
  }

  return { rows, sinTelefono }
}

/**
 * Descarga el CSV en el formato que esperan las extensiones.
 * Columnas requeridas: telefono, mensaje
 */
export async function descargarCSV(rows: WhatsAppRow[], filename = 'morosos-whatsapp.xlsx'): Promise<void> {
  const XLSX = await import('xlsx')
  const dataToExport = rows.map(r => ({
    'Phone': r.telefono,
    'Message': r.mensaje,
    '@value1': r.mensaje,
  }))

  const ws = XLSX.utils.json_to_sheet(dataToExport)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Morosos')
  XLSX.writeFile(wb, filename, { bookType: 'xlsx' })
}

/**
 * Normaliza el teléfono a formato internacional sin +
 * Ejemplos: "612345678" → "34612345678"
 *           "+34 612 345 678" → "34612345678"
 *           "0034612345678" → "34612345678"
 */
function normalizarTelefono(raw: string): string {
  // Quitar todo lo que no sea número
  const solo = raw.replace(/\D/g, '')
  if (!solo) return ''

  // Ya tiene prefijo 34
  if (solo.startsWith('34') && solo.length === 11) return solo
  // Tiene 00 delante
  if (solo.startsWith('0034')) return solo.slice(2)
  // Solo 9 dígitos — añadir prefijo España
  if (solo.length === 9) return '34' + solo

  return solo
}
