import type { Repositories } from '../domain/repositories'
import { RepositoryError } from '../domain/errors'
import { validateUuid } from '../domain/validation'

export interface GrowthPhoto {
  id: string
  entryId: string
  date: string
  title: string
  blob: Blob
}

/** Read-only projection: standalone covers and orphaned diary photos are excluded. */
export async function loadGrowthPhotos(repos: Repositories, plantId: string) {
  try {
    validateUuid(plantId)
  } catch {
    throw new RepositoryError('NOT_FOUND', '식물을 찾을 수 없습니다.')
  }
  const plant = await repos.plants.getById(plantId)
  if (!plant) throw new RepositoryError('NOT_FOUND', '식물을 찾을 수 없습니다.')
  const [diaries, photos] = await Promise.all([
    repos.diaries.listByPlant(plantId),
    repos.photos.listByPlant(plantId),
  ])
  const entries = new Map(diaries.map((entry) => [entry.id, entry]))
  const attached = photos.flatMap((photo) => {
    const entry = photo.entryId ? entries.get(photo.entryId) : undefined
    return entry && entry.plantId === plantId && photo.plantId === plantId
      ? [{ photo, entry }]
      : []
  })
  attached.sort(
    (a, b) =>
      a.entry.entryDate.localeCompare(b.entry.entryDate) ||
      a.entry.createdAt.localeCompare(b.entry.createdAt) ||
      a.entry.id.localeCompare(b.entry.id) ||
      a.photo.sortOrder - b.photo.sortOrder ||
      a.photo.id.localeCompare(b.photo.id),
  )
  const result: GrowthPhoto[] = attached.map(({ photo, entry }) => ({
    id: photo.id,
    entryId: entry.id,
    date: entry.entryDate,
    title: entry.title || '식물 일기',
    blob: photo.blob,
  }))
  return { plant, photos: result }
}
