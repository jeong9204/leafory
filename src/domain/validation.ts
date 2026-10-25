import { RepositoryError } from './errors'
import type { CareEvent, DiaryEntry, DiaryPhoto, Plant } from './models'

export function invalid(message: string): never {
  throw new RepositoryError('VALIDATION', message)
}
export function validateUuid(
  value: unknown,
  field = 'id',
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid(`${field}: UUID가 필요합니다.`)
}
export function validateDate(
  value: unknown,
  field = 'date',
): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    invalid(`${field}: YYYY-MM-DD 날짜가 필요합니다.`)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    invalid(`${field}: 존재하지 않는 날짜입니다.`)
}
export function validateInstant(
  value: unknown,
  field: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    invalid(`${field}: 시간대가 포함된 ISO datetime이 필요합니다.`)
  validateDate(value.slice(0, 10), field)
  const [h, m, s] = value.slice(11, 19).split(':').map(Number)
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value)
  if (
    h > 23 ||
    m > 59 ||
    s > 59 ||
    (offset && (+offset[2] > 23 || +offset[3] > 59)) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid(`${field}: 올바르지 않은 시각입니다.`)
}
function text(value: unknown, field: string, required = false) {
  if (value === undefined && !required) return
  if (typeof value !== 'string' || (required && !value.trim()))
    invalid(
      `${field}: ${required ? '비어 있지 않은 ' : ''}문자열이 필요합니다.`,
    )
}
function optionalUuid(value: unknown, field: string) {
  if (value !== undefined) validateUuid(value, field)
}
function timestamps(value: {
  id: string
  createdAt: string
  updatedAt?: string
}) {
  validateUuid(value.id)
  validateInstant(value.createdAt, 'createdAt')
  if (value.updatedAt !== undefined)
    validateInstant(value.updatedAt, 'updatedAt')
}
export function validatePlant(value: Plant) {
  timestamps(value)
  text(value.name, 'name', true)
  text(value.species, 'species')
  text(value.memo, 'memo')
  if (!['healthy', 'observing', 'concern'].includes(value.status))
    invalid('status: 허용되지 않은 상태입니다.')
  if (value.acquiredAt !== undefined)
    validateDate(value.acquiredAt, 'acquiredAt')
  optionalUuid(value.coverPhotoId, 'coverPhotoId')
}
export function validateDiary(value: DiaryEntry) {
  timestamps(value)
  validateUuid(value.plantId, 'plantId')
  validateDate(value.entryDate, 'entryDate')
  if (!['good', 'normal', 'concern'].includes(value.condition))
    invalid('condition: 허용되지 않은 상태입니다.')
  text(value.title, 'title')
  text(value.content, 'content')
}
export function validatePhoto(value: DiaryPhoto) {
  timestamps(value)
  validateUuid(value.plantId, 'plantId')
  optionalUuid(value.entryId, 'entryId')
  validateInstant(value.capturedAt, 'capturedAt')
  if (!(value.blob instanceof Blob) || value.blob.size === 0)
    invalid('blob: 비어 있지 않은 이미지 Blob이 필요합니다.')
  if (
    typeof value.mimeType !== 'string' ||
    !/^image\/[a-z0-9.+-]+$/i.test(value.mimeType) ||
    value.blob.type.toLowerCase() !== value.mimeType.toLowerCase()
  )
    invalid('mimeType: 이미지 Blob의 MIME type과 일치해야 합니다.')
  if (!Number.isSafeInteger(value.sortOrder) || value.sortOrder < 0)
    invalid('sortOrder: 0 이상의 정수가 필요합니다.')
}
export function validateCareEvent(value: CareEvent) {
  timestamps(value)
  validateUuid(value.plantId, 'plantId')
  validateInstant(value.occurredAt, 'occurredAt')
  text(value.memo, 'memo')
  if (
    !['watering', 'grow_light', 'repotting', 'fertilizing'].includes(
      value.eventType,
    )
  )
    invalid('eventType: 허용되지 않은 이벤트입니다.')
  if (value.eventType === 'grow_light' || value.durationMinutes !== undefined) {
    if (
      !Number.isSafeInteger(value.durationMinutes) ||
      value.durationMinutes! <= 0
    )
      invalid('durationMinutes: 양의 정수(분)가 필요합니다.')
  }
}
