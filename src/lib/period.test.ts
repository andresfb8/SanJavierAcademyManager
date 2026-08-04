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
    expect(getPeriodStart('quarter', new Date('2026-12-31T12:00:00'))).toEqual(new Date(2026, 9, 1)) // Q4: oct-dic
  })

  it('devuelve el 1 de enero del ano actual para "year"', () => {
    expect(getPeriodStart('year', new Date('2026-08-15T12:00:00'))).toEqual(new Date(2026, 0, 1))
  })
})
