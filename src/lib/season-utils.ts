import type { Season } from '@/types'

export const MIGRATION_SEASON_NAME = 'Temporada 2025/2026'

export type MigrationSeasonResult =
  | { reuse: true; season: Season }
  | { reuse: false; name: string; startDate: Date; endDate: Date }

/**
 * Decide si hay que reutilizar una temporada existente llamada
 * "Temporada 2025/2026" (comparación case-insensitive, sin espacios) o crear
 * una nueva con ese nombre y el rango de fechas dado.
 */
export function findOrBuildMigrationSeason(
  seasons: Season[],
  fallbackStartDate: Date,
  fallbackEndDate: Date,
): MigrationSeasonResult {
  const normalizedTarget = MIGRATION_SEASON_NAME.trim().toLowerCase()
  const existing = seasons.find((s) => s.name.trim().toLowerCase() === normalizedTarget)
  if (existing) {
    return { reuse: true, season: existing }
  }
  return {
    reuse: false,
    name: MIGRATION_SEASON_NAME,
    startDate: fallbackStartDate,
    endDate: fallbackEndDate,
  }
}
