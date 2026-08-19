import { describe, it, expect } from 'vitest'
import { findOrBuildMigrationSeason } from '@/lib/season-utils'
import type { Season } from '@/types'

const MIGRATION_SEASON_NAME = 'Temporada 2025/2026'

describe('findOrBuildMigrationSeason', () => {
  it('reutiliza una temporada existente con el nombre exacto', () => {
    const existing: Season = {
      id: 'season-1',
      name: MIGRATION_SEASON_NAME,
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2026, 5, 30),
      createdAt: new Date(2025, 8, 1),
    }
    const result = findOrBuildMigrationSeason([existing], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(true)
    if (result.reuse) {
      expect(result.season.id).toBe('season-1')
    }
  })

  it('reutiliza una temporada existente ignorando mayusculas/minusculas y espacios', () => {
    const existing: Season = {
      id: 'season-2',
      name: '  temporada 2025/2026  ',
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2026, 5, 30),
      createdAt: new Date(2025, 8, 1),
    }
    const result = findOrBuildMigrationSeason([existing], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(true)
    if (result.reuse) {
      expect(result.season.id).toBe('season-2')
    }
  })

  it('propone crear una temporada nueva si no existe ninguna con ese nombre', () => {
    const result = findOrBuildMigrationSeason([], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(false)
    if (!result.reuse) {
      expect(result.name).toBe(MIGRATION_SEASON_NAME)
      expect(result.startDate).toEqual(new Date(2025, 8, 1))
      expect(result.endDate).toEqual(new Date(2026, 5, 30))
    }
  })

  it('no confunde una temporada con nombre parecido pero distinto', () => {
    const existing: Season = {
      id: 'season-3',
      name: 'Temporada 2026/2027',
      startDate: new Date(2026, 8, 1),
      endDate: new Date(2027, 5, 30),
      createdAt: new Date(2026, 8, 1),
    }
    const result = findOrBuildMigrationSeason([existing], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(false)
  })
})
