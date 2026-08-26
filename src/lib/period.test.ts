import { describe, it, expect } from 'vitest'
import { getPeriodStart } from '@/lib/period'

describe('getPeriodStart', () => {
  it('devuelve el dia 1 del mes actual para "month"', () => {
    const now = new Date('2026-08-15T12:00:00')
    expect(getPeriodStart('month', now)).toEqual(new Date(2026, 7, 1))
  })

  it('devuelve el inicio del trimestre para "quarter"', () => {
    expect(getPeriodStart('quarter', new Date('2026-08-15T12:00:00'))).toEqual(new Date(2026, 6, 1)) // Q3: jul-sep
    expect(getPeriodStart('quarter', new Date('2026-01-05T12:00:00'))).toEqual(new Date(2026, 0, 1)) // Q1: ene-mar
    expect(getPeriodStart('quarter', new Date('2026-05-20T12:00:00'))).toEqual(new Date(2026, 3, 1)) // Q2: abr-jun
    expect(getPeriodStart('quarter', new Date('2026-12-31T12:00:00'))).toEqual(new Date(2026, 9, 1)) // Q4: oct-dic
  })

  it('devuelve el 1 de enero del ano actual para "year"', () => {
    expect(getPeriodStart('year', new Date('2026-08-15T12:00:00'))).toEqual(new Date(2026, 0, 1))
  })
})

import { getCurrentPeriodMonthKeys, getPreviousPeriodMonthKeys, getLastNMonthKeys } from '@/lib/period'

describe('getCurrentPeriodMonthKeys', () => {
  it('devuelve solo el mes actual para "month"', () => {
    expect(getCurrentPeriodMonthKeys('month', new Date('2026-08-15T12:00:00'))).toEqual(['2026-8'])
  })

  it('devuelve los meses transcurridos del trimestre para "quarter"', () => {
    expect(getCurrentPeriodMonthKeys('quarter', new Date('2026-08-15T12:00:00'))).toEqual(['2026-7', '2026-8'])
  })

  it('devuelve los meses transcurridos del ano para "year"', () => {
    expect(getCurrentPeriodMonthKeys('year', new Date('2026-08-15T12:00:00'))).toEqual([
      '2026-1', '2026-2', '2026-3', '2026-4', '2026-5', '2026-6', '2026-7', '2026-8',
    ])
  })
})

describe('getPreviousPeriodMonthKeys', () => {
  it('devuelve el mes inmediatamente anterior para "month"', () => {
    expect(getPreviousPeriodMonthKeys('month', new Date('2026-08-15T12:00:00'))).toEqual(['2026-7'])
  })

  it('devuelve los meses equivalentes del trimestre anterior para "quarter"', () => {
    // Q3 en curso (jul, ago transcurridos) -> meses equivalentes de Q2 (abr, may)
    expect(getPreviousPeriodMonthKeys('quarter', new Date('2026-08-15T12:00:00'))).toEqual(['2026-4', '2026-5'])
  })

  it('devuelve los mismos meses del ano anterior para "year"', () => {
    expect(getPreviousPeriodMonthKeys('year', new Date('2026-08-15T12:00:00'))).toEqual([
      '2025-1', '2025-2', '2025-3', '2025-4', '2025-5', '2025-6', '2025-7', '2025-8',
    ])
  })
})

describe('getLastNMonthKeys', () => {
  it('devuelve los ultimos 6 meses en orden ascendente, incluyendo el actual', () => {
    expect(getLastNMonthKeys(6, new Date('2026-08-15T12:00:00'))).toEqual([
      '2026-3', '2026-4', '2026-5', '2026-6', '2026-7', '2026-8',
    ])
  })

  it('cruza el cambio de ano correctamente', () => {
    expect(getLastNMonthKeys(6, new Date('2026-02-10T12:00:00'))).toEqual([
      '2025-9', '2025-10', '2025-11', '2025-12', '2026-1', '2026-2',
    ])
  })
})
