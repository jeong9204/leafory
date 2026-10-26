import type { Plant, DiaryEntry, DiaryPhoto, CareEvent } from './models'
import {
  invalid,
  validatePlant,
  validateDiary,
  validatePhoto,
  validateCareEvent,
} from './validation'

export interface LocalDataSnapshot {
  plants: Plant[]
  diaries: DiaryEntry[]
  photos: DiaryPhoto[]
  careEvents: CareEvent[]
}
export type DataCounts = Record<keyof LocalDataSnapshot, number>
export const MAX_BACKUP_RECORDS = 10000
export function exactObject(value: unknown, allowed: readonly string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    invalid('백업 데이터 구조가 올바르지 않습니다.')
}
export const recordFields = {
  plants: [
    'id',
    'name',
    'species',
    'acquiredAt',
    'status',
    'memo',
    'coverPhotoId',
    'createdAt',
    'updatedAt',
  ],
  diaries: [
    'id',
    'plantId',
    'entryDate',
    'condition',
    'title',
    'content',
    'createdAt',
    'updatedAt',
  ],
  photos: [
    'id',
    'plantId',
    'entryId',
    'blob',
    'mimeType',
    'capturedAt',
    'createdAt',
    'sortOrder',
  ],
  careEvents: [
    'id',
    'plantId',
    'eventType',
    'occurredAt',
    'durationMinutes',
    'memo',
    'createdAt',
    'updatedAt',
  ],
} as const
/** Shared by import validation and the destructive storage boundary. No React dependency. */
export function validateSnapshot(
  value: unknown,
): asserts value is LocalDataSnapshot {
  exactObject(value, Object.keys(recordFields))
  const data = value as LocalDataSnapshot
  const validators = {
    plants: validatePlant,
    diaries: validateDiary,
    photos: validatePhoto,
    careEvents: validateCareEvent,
  }
  for (const key of Object.keys(recordFields) as (keyof LocalDataSnapshot)[]) {
    const rows = data[key]
    if (!Array.isArray(rows) || rows.length > MAX_BACKUP_RECORDS)
      invalid('백업의 항목 수 또는 목록 형식이 올바르지 않습니다.')
    const ids = new Set<string>()
    for (const row of rows) {
      exactObject(row, recordFields[key])
      const required =
        key === 'photos'
          ? [
              'id',
              'plantId',
              'blob',
              'mimeType',
              'capturedAt',
              'createdAt',
              'sortOrder',
            ]
          : key === 'plants'
            ? ['id', 'name', 'status', 'createdAt', 'updatedAt']
            : key === 'diaries'
              ? [
                  'id',
                  'plantId',
                  'entryDate',
                  'condition',
                  'createdAt',
                  'updatedAt',
                ]
              : [
                  'id',
                  'plantId',
                  'eventType',
                  'occurredAt',
                  'createdAt',
                  'updatedAt',
                ]
      if (
        required.some(
          (field) =>
            !Object.hasOwn(row, field) ||
            (row as unknown as Record<string, unknown>)[field] === undefined,
        )
      )
        invalid('백업에 필수 필드가 없습니다.')
      // Each collection is checked by its own domain validator.
      ;(validators[key] as (value: unknown) => void)(row)
      if (ids.has(row.id)) invalid('백업에 중복된 ID가 있습니다.')
      ids.add(row.id)
    }
  }
  const plants = new Map(data.plants.map((p) => [p.id, p]))
  const diaries = new Map(data.diaries.map((e) => [e.id, e]))
  const photos = new Map(data.photos.map((p) => [p.id, p]))
  for (const e of [...data.diaries, ...data.careEvents, ...data.photos])
    if (!plants.has(e.plantId)) invalid('백업에 연결된 식물이 없습니다.')
  for (const p of data.photos)
    if (p.entryId && diaries.get(p.entryId)?.plantId !== p.plantId)
      invalid('백업 사진의 일기 연결이 올바르지 않습니다.')
  for (const p of data.plants)
    if (p.coverPhotoId && photos.get(p.coverPhotoId)?.plantId !== p.id)
      invalid('백업 대표 사진의 연결이 올바르지 않습니다.')
}
export function snapshotCounts(data: LocalDataSnapshot): DataCounts {
  return {
    plants: data.plants.length,
    diaries: data.diaries.length,
    photos: data.photos.length,
    careEvents: data.careEvents.length,
  }
}
