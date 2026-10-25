import type { Plant, DiaryPhoto, CareEvent } from '../domain/models'
import type { Repositories } from '../domain/repositories'
import { RepositoryError } from '../domain/errors'
import { localDateKey } from '../domain/calendar'
import { validateUuid } from '../domain/validation'
import { isThisWeek } from '../lib/dates'
import { MAX_STORED_PHOTO_BYTES } from '../lib/plant-photo'

export const statusLabels: Record<Plant['status'], string> = {
  healthy: '건강해요',
  observing: '관찰 중',
  concern: '걱정돼요',
}
export interface PlantTimelineEntry {
  id: string
  careEventId?: string
  occurredAt?: string
  kind: 'growth' | 'watering' | 'light' | 'repotting' | 'fertilizing'
  date: string
  title: string
  description: string
  image?: Blob
  imageAlt?: string
}
export interface PlantView {
  plant: Plant
  cover?: Blob
  lastWatered?: string
  lightMinutes?: number
  recordCount: number
  entries: PlantTimelineEntry[]
  gallery: PlantTimelineEntry[]
}
export type PlantFields = Pick<
  Plant,
  'name' | 'species' | 'acquiredAt' | 'status' | 'memo'
>
export interface PreparedPhoto {
  blob: Blob
  mimeType: string
  capturedAt: string
}
export type PhotoChange =
  | { type: 'keep' }
  | { type: 'remove' }
  | { type: 'replace'; photo: PreparedPhoto }

function assertRouteId(id: string) {
  try {
    validateUuid(id)
  } catch {
    throw new RepositoryError('NOT_FOUND', '식물을 찾을 수 없습니다.')
  }
}
export async function loadPlant(
  repos: Repositories,
  id: string,
): Promise<PlantView> {
  assertRouteId(id)
  const plant = await repos.plants.getById(id)
  if (!plant) throw new RepositoryError('NOT_FOUND', '식물을 찾을 수 없습니다.')
  const [photo, care, diaries, photos] = await Promise.all([
    plant.coverPhotoId ? repos.photos.getById(plant.coverPhotoId) : undefined,
    repos.careEvents.listByPlant(id),
    repos.diaries.listByPlant(id),
    repos.photos.listByPlant(id),
  ])
  const today = localDateKey()
  const lights = care.filter(
    (e) =>
      e.eventType === 'grow_light' &&
      localDateKey(new Date(e.occurredAt)) === today,
  )
  const eventKinds: Record<CareEvent['eventType'], PlantTimelineEntry['kind']> =
    {
      watering: 'watering',
      grow_light: 'light',
      repotting: 'repotting',
      fertilizing: 'fertilizing',
    }
  const eventTitles: Record<CareEvent['eventType'], string> = {
    watering: '물주기 완료',
    grow_light: '식물등',
    repotting: '분갈이',
    fertilizing: '비료 주기',
  }
  const entries: PlantTimelineEntry[] = [
    ...diaries.map((entry) => {
      const image = photos.find((p) => p.entryId === entry.id)
      return {
        id: `diary:${entry.id}`,
        kind: 'growth' as const,
        date: entry.entryDate,
        title: entry.title || '식물 일기',
        description: entry.content || '',
        image: image?.blob,
        imageAlt: `${plant.name} 일기 사진`,
      }
    }),
    ...care.map((event) => ({
      id: `care:${event.id}`,
      careEventId: event.id,
      occurredAt: event.occurredAt,
      kind: eventKinds[event.eventType],
      date: localDateKey(new Date(event.occurredAt)),
      title:
        event.eventType === 'grow_light'
          ? `식물등 ${event.durationMinutes}분`
          : eventTitles[event.eventType],
      description: event.memo || '',
    })),
  ]
  entries.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') ||
      a.id.localeCompare(b.id),
  )
  return {
    plant,
    cover: photo?.blob,
    lastWatered: care.find((e) => e.eventType === 'watering')?.occurredAt,
    lightMinutes: lights.length
      ? lights.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0)
      : undefined,
    recordCount: diaries.length + care.length,
    entries,
    gallery: photos.map((photo) => ({
      id: photo.id,
      kind: 'growth',
      date: localDateKey(new Date(photo.capturedAt)),
      title: photo.id === plant.coverPhotoId ? '대표 사진' : '식물 사진',
      description: '',
      image: photo.blob,
      imageAlt: `${plant.name} 사진`,
    })),
  }
}
export async function loadHome(repos: Repositories, today = localDateKey()) {
  const plants = await repos.plants.list()
  const views = await Promise.all(plants.map((p) => loadPlant(repos, p.id)))
  const records = views
    .flatMap((view) =>
      view.entries.map((entry) => ({ ...entry, plantId: view.plant.id })),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') ||
        a.id.localeCompare(b.id),
    )
  return {
    views,
    records: records.slice(0, 2),
    weekCount: records.filter((entry) => isThisWeek(entry.date, today)).length,
  }
}

/** Image processing has already completed before entering the IndexedDB transaction. */
export async function savePlant(
  repos: Repositories,
  fields: PlantFields,
  photo: PhotoChange,
  id?: string,
): Promise<Plant> {
  const clean = {
    ...fields,
    name: fields.name.trim(),
    species: fields.species?.trim() || undefined,
    memo: fields.memo?.trim() || undefined,
    acquiredAt: fields.acquiredAt || undefined,
  }
  if (
    !clean.name ||
    clean.name.length > 80 ||
    (clean.species?.length ?? 0) > 120 ||
    (clean.memo?.length ?? 0) > 3000
  )
    throw new RepositoryError(
      'VALIDATION',
      '이름은 1~80자, 학명은 120자, 메모는 3,000자 이내로 입력해 주세요.',
    )
  if (
    photo.type === 'replace' &&
    (!['image/jpeg', 'image/png', 'image/webp'].includes(
      photo.photo.mimeType,
    ) ||
      photo.photo.blob.size > MAX_STORED_PHOTO_BYTES)
  )
    throw new RepositoryError(
      'VALIDATION',
      '사진 형식이나 저장 크기를 확인해 주세요.',
    )
  return repos.runInTransaction(async (tx) => {
    let previous: Plant | undefined
    if (id) {
      assertRouteId(id)
      previous = await tx.plants.getById(id)
      if (!previous)
        throw new RepositoryError('NOT_FOUND', '식물을 찾을 수 없습니다.')
    }
    let plant = previous
      ? await tx.plants.update(previous.id, clean)
      : await tx.plants.create(clean)
    if (photo.type !== 'keep') {
      let replacement: DiaryPhoto | undefined
      if (photo.type === 'replace')
        replacement = await tx.photos.create({
          ...photo.photo,
          plantId: plant.id,
          sortOrder: 0,
        })
      plant = await tx.plants.update(plant.id, {
        coverPhotoId: replacement?.id,
      })
      if (previous?.coverPhotoId) {
        const old = await tx.photos.getById(previous.coverPhotoId)
        // Attached diary images belong to history and must not disappear with a cover change.
        if (old && !old.entryId) await tx.photos.delete(old.id)
      }
    }
    return plant
  })
}
