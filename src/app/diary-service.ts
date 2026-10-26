import type { DiaryEntry } from '../domain/models'
import type { Repositories } from '../domain/repositories'
import { RepositoryError } from '../domain/errors'
import { validateDate, validateUuid } from '../domain/validation'
import { MAX_STORED_PHOTO_BYTES } from '../lib/plant-photo'
import type { PreparedPhoto } from './plant-service'

export const MAX_DIARY_PHOTOS = 10
export const conditionLabels: Record<DiaryEntry['condition'], string> = {
  good: '좋음',
  normal: '보통',
  concern: '걱정',
}
export type DiaryFields = Pick<
  DiaryEntry,
  'entryDate' | 'condition' | 'title' | 'content'
>
/** Retained photos carry their original ID; new photos only exist in memory until save. */
export interface DiaryPhotoDraft extends PreparedPhoto {
  key: string
  photoId?: string
}
function routeId(id: string) {
  try {
    validateUuid(id)
  } catch {
    throw new RepositoryError('NOT_FOUND', '식물 또는 일기를 찾을 수 없습니다.')
  }
}
export async function loadDiary(
  repos: Repositories,
  plantId: string,
  entryId: string,
) {
  routeId(plantId)
  routeId(entryId)
  const [plant, entry] = await Promise.all([
    repos.plants.getById(plantId),
    repos.diaries.getById(entryId),
  ])
  if (!plant || !entry || entry.plantId !== plantId)
    throw new RepositoryError('NOT_FOUND', '식물 또는 일기를 찾을 수 없습니다.')
  const photos = (await repos.photos.listByPlant(plantId))
    .filter((p) => p.entryId === entryId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  return { plant, entry, photos }
}
export async function saveDiary(
  repos: Repositories,
  plantId: string,
  fields: DiaryFields,
  photos: DiaryPhotoDraft[],
  entryId?: string,
) {
  routeId(plantId)
  validateDate(fields.entryDate, '일기 날짜')
  if (
    !Object.hasOwn(conditionLabels, fields.condition) ||
    (fields.title?.length ?? 0) > 120 ||
    (fields.content?.length ?? 0) > 20000
  )
    throw new RepositoryError(
      'VALIDATION',
      '상태를 선택하고 제목은 120자, 관찰 메모는 20,000자 이내로 입력해 주세요.',
    )
  if (
    photos.length > MAX_DIARY_PHOTOS ||
    new Set(photos.map((p) => p.key)).size !== photos.length ||
    new Set(photos.filter((p) => p.photoId).map((p) => p.photoId)).size !==
      photos.filter((p) => p.photoId).length
  )
    throw new RepositoryError(
      'VALIDATION',
      '사진은 중복 없이 최대 10장까지 첨부할 수 있어요.',
    )
  for (const photo of photos) {
    if (
      !(photo.blob instanceof Blob) ||
      !photo.blob.size ||
      photo.blob.size > MAX_STORED_PHOTO_BYTES ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType) ||
      photo.blob.type !== photo.mimeType
    )
      throw new RepositoryError(
        'VALIDATION',
        '사진 형식과 크기를 확인해 주세요.',
      )
  }
  const clean = {
    ...fields,
    title: fields.title?.trim() || undefined,
    content: fields.content?.trim() || undefined,
  }
  // Decoding/compression happens before this transaction; only IndexedDB work belongs here.
  return repos.runInTransaction(async (tx) => {
    const previous = entryId ? await loadDiary(tx, plantId, entryId) : undefined
    const owned = new Set(previous?.photos.map((p) => p.id))
    for (const photo of photos)
      if (photo.photoId && !owned.has(photo.photoId))
        throw new RepositoryError(
          'VALIDATION',
          '다른 일기의 사진은 사용할 수 없어요.',
        )
    const entry = previous
      ? await tx.diaries.update(previous.entry.id, clean)
      : await tx.diaries.create({ ...clean, plantId })
    const retained = new Set(photos.map((p) => p.photoId))
    for (const old of previous?.photos ?? [])
      if (!retained.has(old.id)) await tx.photos.delete(old.id)
    for (const [sortOrder, photo] of photos.entries()) {
      if (photo.photoId) await tx.photos.update(photo.photoId, { sortOrder })
      else
        await tx.photos.create({
          plantId,
          entryId: entry.id,
          blob: photo.blob,
          mimeType: photo.mimeType,
          capturedAt: photo.capturedAt,
          sortOrder,
        })
    }
    return entry
  })
}
export async function deleteDiary(
  repos: Repositories,
  plantId: string,
  entryId: string,
) {
  return repos.runInTransaction(async (tx) => {
    await loadDiary(tx, plantId, entryId)
    await tx.diaries.delete(entryId)
  })
}
