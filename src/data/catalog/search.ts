import plants from './plants.json'

export interface CatalogPlant {
  readonly id: string
  readonly commonName: string
  readonly scientificName: string
  readonly aliases: readonly string[]
  readonly synonyms: readonly string[]
  readonly note: string
  readonly sourceUrl: string
  readonly checkedAt: string
}

// Static reference data only: never persisted to the user's database.
export const plantCatalog: readonly CatalogPlant[] = plants

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·._-]+/gu, '')
}

export function searchPlantCatalog(query: string): readonly CatalogPlant[] {
  const normalized = normalize(query.trim())
  if (!normalized) return []
  return plantCatalog
    .map((plant, index) => {
      const terms = [
        plant.commonName,
        plant.scientificName,
        ...plant.aliases,
        ...plant.synonyms,
      ].map(normalize)
      const rank = Math.min(
        ...terms.map((term) =>
          term === normalized
            ? 0
            : term.startsWith(normalized)
              ? 1
              : term.includes(normalized)
                ? 2
                : 3,
        ),
      )
      return { plant, rank, index }
    })
    .filter(({ rank }) => rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ plant }) => plant)
}
