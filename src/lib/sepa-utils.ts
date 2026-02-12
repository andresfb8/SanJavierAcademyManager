// ==========================================
// San Javier Academy Manager - Utilidades SEPA
// ==========================================
// Funciones auxiliares para la preparación de datos
// de adeudos directos SEPA (domiciliación bancaria).
// Genera XML en formato pain.008.001.02 compatible
// con la normativa bancaria europea.
// ==========================================

import type { Payment, Player, Club } from '@/types'

// --- Interfaces SEPA ---

/** Configuración SEPA del club (datos necesarios para la domiciliación) */
export interface SepaClubConfig {
  iban: string         // IBAN del club
  bic?: string         // BIC/SWIFT del club
  creditorId: string   // Identificador de acreedor SEPA (ES + sufijo + NIF)
}

/** Información completa de un lote de pagos SEPA */
export interface SepaPaymentInfo {
  debtorName: string           // Nombre del club (acreedor en este contexto, pero es quien inicia el cobro)
  debtorIBAN: string           // IBAN del club
  debtorBIC?: string           // BIC del club
  creditorId: string           // Identificador de acreedor SEPA
  payments: SepaDirectDebit[]  // Lista de adeudos directos
}

/** Un adeudo directo SEPA individual */
export interface SepaDirectDebit {
  endToEndId: string       // ID único de pago (end-to-end)
  amount: number           // Importe en EUR
  mandateId: string        // Referencia del mandato (ej: ID de inscripción)
  mandateDate: Date        // Fecha de firma del mandato
  debtorName: string       // Nombre del deudor (jugador o tutor)
  debtorIBAN: string       // IBAN del deudor
  remittanceInfo: string   // Concepto del pago
}

// --- Funciones de formato y validación de IBAN ---

/**
 * Formatea un IBAN insertando un espacio cada 4 caracteres.
 * Elimina espacios previos antes de reformatear.
 *
 * @example formatIBAN('ES9121000418450200051332') => 'ES91 2100 0418 4502 0005 1332'
 */
export function formatIBAN(iban: string): string {
  // Eliminar todos los espacios existentes
  const clean = iban.replace(/\s/g, '').toUpperCase()
  // Insertar espacio cada 4 caracteres
  return clean.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Validación básica de IBAN.
 * Comprueba que empiece con dos letras (código de país),
 * seguidas de dos dígitos de control, y el resto sean alfanuméricos.
 * Para IBAN español (ES) verifica longitud exacta de 24 caracteres.
 *
 * No realiza validación de dígitos de control (módulo 97).
 */
export function validateIBAN(iban: string): boolean {
  // Limpiar espacios y convertir a mayúsculas
  const clean = iban.replace(/\s/g, '').toUpperCase()

  // Debe tener al menos 15 caracteres (mínimo IBAN válido)
  if (clean.length < 15) return false

  // Debe empezar con dos letras (código de país)
  if (!/^[A-Z]{2}/.test(clean)) return false

  // Después del código de país, dos dígitos de control
  if (!/^[A-Z]{2}\d{2}/.test(clean)) return false

  // El resto debe ser alfanumérico
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return false

  // Longitudes específicas por país (los más comunes en España)
  const countryLengths: Record<string, number> = {
    ES: 24, // España
    FR: 27, // Francia
    DE: 22, // Alemania
    PT: 25, // Portugal
    IT: 27, // Italia
    GB: 22, // Reino Unido
    NL: 18, // Países Bajos
    BE: 16, // Bélgica
    AT: 20, // Austria
  }

  const country = clean.substring(0, 2)
  const expectedLength = countryLengths[country]

  // Si conocemos la longitud esperada, verificarla
  if (expectedLength && clean.length !== expectedLength) {
    return false
  }

  return true
}

// --- Generación de XML SEPA (pain.008.001.02) ---

/**
 * Escapa caracteres especiales XML para evitar XML mal formado.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Formatea una fecha como YYYY-MM-DD (formato ISO requerido por SEPA).
 */
function formatSepaDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formatea una fecha y hora como YYYY-MM-DDTHH:mm:ss (formato ISO para cabeceras SEPA).
 */
function formatSepaDateTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

/**
 * Formatea un importe con exactamente 2 decimales y punto como separador decimal.
 * SEPA requiere este formato: "123.45"
 */
function formatSepaAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Limpia un IBAN eliminando espacios (SEPA XML requiere IBAN sin espacios).
 */
function cleanIBAN(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase()
}

/**
 * Genera un documento XML SEPA válido en formato pain.008.001.02 (adeudo directo).
 *
 * Este formato es el estándar para la presentación de adeudos directos SEPA
 * ante entidades bancarias españolas y europeas.
 *
 * Estructura del documento:
 * - CstmrDrctDbtInitn (Customer Direct Debit Initiation)
 *   - GrpHdr (Cabecera de grupo)
 *   - PmtInf (Información de pago - un bloque con todas las transacciones)
 *     - DrctDbtTxInf[] (Información de cada transacción de adeudo directo)
 *
 * @param info Datos del lote de pagos SEPA
 * @returns Cadena XML completa lista para enviar al banco
 */
export function generateSepaXml(info: SepaPaymentInfo): string {
  const now = new Date()
  const msgId = `SJAM-${formatSepaDate(now).replace(/-/g, '')}-${now.getTime()}`
  const pmtInfId = `PMT-${formatSepaDate(now).replace(/-/g, '')}-001`

  // Calcular el importe total del lote
  const totalAmount = info.payments.reduce((sum, p) => sum + p.amount, 0)
  const numberOfTransactions = info.payments.length

  // Fecha de cobro: día siguiente laborable (simplificado, usamos mañana)
  const requestedCollectionDate = new Date(now)
  requestedCollectionDate.setDate(requestedCollectionDate.getDate() + 1)

  // Construir las transacciones individuales
  const transactions = info.payments
    .map((payment) => {
      const mandateDate = payment.mandateDate instanceof Date
        ? payment.mandateDate
        : new Date(payment.mandateDate)

      return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(payment.endToEndId)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${formatSepaAmount(payment.amount)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escapeXml(payment.mandateId)}</MndtId>
            <DtOfSgntr>${formatSepaDate(mandateDate)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escapeXml(payment.debtorName)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${cleanIBAN(payment.debtorIBAN)}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(payment.remittanceInfo)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`
    })
    .join('\n')

  // Bloque BIC del acreedor (opcional)
  const creditorAgentBlock = info.debtorBIC
    ? `      <CdtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(info.debtorBIC)}</BIC>
        </FinInstnId>
      </CdtrAgt>`
    : `      <CdtrAgt>
        <FinInstnId>
          <Othr>
            <Id>NOTPROVIDED</Id>
          </Othr>
        </FinInstnId>
      </CdtrAgt>`

  // Documento XML completo pain.008.001.02
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${formatSepaDateTime(now)}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${formatSepaAmount(totalAmount)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(info.debtorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${formatSepaAmount(totalAmount)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${formatSepaDate(requestedCollectionDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${escapeXml(info.debtorName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${cleanIBAN(info.debtorIBAN)}</IBAN>
        </Id>
      </CdtrAcct>
${creditorAgentBlock}
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${escapeXml(info.creditorId)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${transactions}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`

  return xml
}

// --- Preparación de datos desde el modelo de la aplicación ---

/**
 * Prepara la estructura SepaPaymentInfo a partir de los datos internos de la aplicación.
 *
 * Toma un array de pagos pendientes, busca el IBAN y nombre del titular de cada jugador,
 * y construye la estructura lista para generar el XML SEPA.
 *
 * Para jugadores menores de edad, usa los datos del tutor como deudor.
 *
 * @param payments   Lista de pagos pendientes a domiciliar
 * @param players    Lista completa de jugadores (para buscar IBANs)
 * @param club       Datos del club
 * @param clubSepa   Configuración SEPA del club (IBAN, BIC, creditorId)
 * @returns Estructura SepaPaymentInfo lista para generateSepaXml()
 */
export function prepareSepaPayments(
  payments: Payment[],
  players: Player[],
  club: Club,
  clubSepa: SepaClubConfig
): SepaPaymentInfo {
  // Crear mapa de jugadores por ID para búsqueda rápida
  const playerMap = new Map<string, Player>()
  for (const player of players) {
    playerMap.set(player.id, player)
  }

  // Convertir cada pago en un adeudo directo SEPA
  const sepaPayments: SepaDirectDebit[] = payments
    .filter((payment) => {
      // Solo procesar pagos pendientes con método de domiciliación
      // o pagos pendientes sin método asignado (se asume domiciliación por defecto)
      return (
        payment.status === 'pendiente' &&
        (!payment.paymentMethod || payment.paymentMethod === 'domiciliacion')
      )
    })
    .map((payment) => {
      const player = playerMap.get(payment.playerId)

      // Determinar nombre del deudor y el IBAN
      // Para menores, usamos el nombre del titular de la cuenta bancaria
      let debtorName: string
      let debtorIBAN: string

      if (player) {
        // El titular de la cuenta es el deudor (puede ser tutor para menores)
        debtorName = player.bankAccountHolder || `${player.firstName} ${player.lastName}`
        debtorIBAN = player.iban
      } else {
        // Si no encontramos al jugador, usamos los datos del pago
        debtorName = payment.playerName
        debtorIBAN = ''
      }

      // Generar ID único end-to-end: combinación de inscripción + mes/año
      const endToEndId = `${payment.enrollmentId ?? payment.id}-${String(payment.billingMonth).padStart(2, '0')}${payment.billingYear}`

      // Construir concepto del pago
      const remittanceInfo = payment.concept || `${payment.groupName ?? 'Pago manual'} - ${String(payment.billingMonth).padStart(2, '0')}/${payment.billingYear}`

      return {
        endToEndId,
        amount: payment.amount,
        mandateId: payment.enrollmentId ?? payment.id,
        mandateDate: player?.registrationDate ?? payment.createdAt,
        debtorName,
        debtorIBAN,
        remittanceInfo,
      }
    })
    // Filtrar pagos sin IBAN (no se pueden domiciliar)
    .filter((dd) => dd.debtorIBAN.length > 0)

  return {
    debtorName: club.name,
    debtorIBAN: clubSepa.iban,
    debtorBIC: clubSepa.bic,
    creditorId: clubSepa.creditorId,
    payments: sepaPayments,
  }
}
