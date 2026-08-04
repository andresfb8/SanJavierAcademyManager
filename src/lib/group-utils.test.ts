import { describe, it, expect } from 'vitest'
import { isGroupCurrentlyActive, isGroupStale } from '@/lib/group-utils'

function makeGroup(overrides: { isActive?: boolean; startDate?: Date; endDate?: Date } = {}) {
  return {
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    ...overrides,
  }
}

describe('isGroupCurrentlyActive', () => {
  it('es true si la fecha cae dentro del rango y el grupo esta activo', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-03-15'))).toBe(true)
  })

  it('es true en el primer dia del rango (inclusive)', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-01-01'))).toBe(true)
  })

  it('es true en el ultimo dia del rango (inclusive)', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-06-30'))).toBe(true)
  })

  it('es false si la fecha es posterior a endDate', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-07-01'))).toBe(false)
  })

  it('es false si la fecha es anterior a startDate', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2025-12-31'))).toBe(false)
  })

  it('es false si isActive es false aunque la fecha caiga dentro del rango', () => {
    expect(isGroupCurrentlyActive(makeGroup({ isActive: false }), new Date('2026-03-15'))).toBe(false)
  })

  it('ignora la hora del dia, solo compara la fecha', () => {
    const group = makeGroup({ endDate: new Date('2026-06-30T08:00:00') })
    expect(isGroupCurrentlyActive(group, new Date('2026-06-30T23:59:00'))).toBe(true)
  })
})

describe('isGroupStale', () => {
  it('es true si isActive sigue en true pero ya paso endDate', () => {
    expect(isGroupStale(makeGroup(), new Date('2026-07-01'))).toBe(true)
  })

  it('es false si el grupo ya esta desactivado (nada que avisar)', () => {
    expect(isGroupStale(makeGroup({ isActive: false }), new Date('2026-07-01'))).toBe(false)
  })

  it('es false si todavia no ha pasado endDate', () => {
    expect(isGroupStale(makeGroup(), new Date('2026-03-15'))).toBe(false)
  })
})
