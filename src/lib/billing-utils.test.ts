import { describe, it, expect } from 'vitest'
import { cycleLength, remainingMonthsInGroup, stripCycleWarning } from '@/lib/billing-utils'

describe('cycleLength', () => {
  it('mensual cubre 1 mes', () => {
    expect(cycleLength('monthly')).toBe(1)
  })

  it('trimestral cubre 3 meses', () => {
    expect(cycleLength('quarterly')).toBe(3)
  })

  it('anual cubre 12 meses', () => {
    expect(cycleLength('annual')).toBe(12)
  })

  it('plazos cubre 1 mes (usa su propio precio por mes, no se multiplica)', () => {
    expect(cycleLength('installments')).toBe(1)
  })
})

describe('remainingMonthsInGroup', () => {
  it('el grupo termina el mismo mes que se factura -> 1 mes restante', () => {
    const groupEnd = new Date(2026, 8, 15) // 15 septiembre 2026 (mes 9, índice 8)
    expect(remainingMonthsInGroup(groupEnd, 9, 2026)).toBe(1)
  })

  it('el grupo termina 2 meses despues del mes de facturacion -> 3 meses restantes', () => {
    const groupEnd = new Date(2026, 10, 30) // noviembre 2026 (mes 11)
    expect(remainingMonthsInGroup(groupEnd, 9, 2026)).toBe(3)
  })

  it('el grupo termina el año siguiente -> cuenta cruzando el cambio de año', () => {
    const groupEnd = new Date(2027, 1, 28) // febrero 2027 (mes 2)
    expect(remainingMonthsInGroup(groupEnd, 12, 2026)).toBe(3) // dic, ene, feb
  })

  it('trimestral con 2 meses restantes -> ciclo incompleto', () => {
    const groupEnd = new Date(2026, 9, 31) // octubre 2026 (mes 10)
    const remaining = remainingMonthsInGroup(groupEnd, 9, 2026) // sep, oct = 2
    expect(remaining).toBe(2)
    expect(remaining < cycleLength('quarterly')).toBe(true)
  })

  it('anual con 12 meses restantes exactos -> ciclo completo', () => {
    const groupEnd = new Date(2027, 7, 31) // agosto 2027 (mes 8)
    const remaining = remainingMonthsInGroup(groupEnd, 9, 2026) // sep 2026 .. ago 2027 = 12
    expect(remaining).toBe(12)
    expect(remaining < cycleLength('annual')).toBe(false)
  })
})

describe('stripCycleWarning', () => {
  it('quita el aviso de ciclo incompleto cuando está presente', () => {
    const concept = 'Cuota Septiembre 2026 - Grupo X ⚠ el grupo finaliza antes de cubrir el ciclo trimestral completo, revisa el importe'
    expect(stripCycleWarning(concept)).toBe('Cuota Septiembre 2026 - Grupo X')
  })

  it('deja el concepto igual cuando no hay aviso', () => {
    const concept = 'Cuota Septiembre 2026 - Grupo X'
    expect(stripCycleWarning(concept)).toBe(concept)
  })
})
