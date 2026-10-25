import type { CareEvent } from '../domain/models'
import type { Repositories } from '../domain/repositories'
import { RepositoryError } from '../domain/errors'
import { validateUuid } from '../domain/validation'
import { localDateKey } from '../domain/calendar'

export const careLabels: Record<CareEvent['eventType'], string> = {
  watering: '물주기',
  grow_light: '식물등',
  repotting: '분갈이',
  fertilizing: '비료',
}
export function localDateTime(date = new Date()) {
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export interface CareFields {
  eventType: CareEvent['eventType']
  dateTime: string
  hours: string
  minutes: string
  memo: string
}
export function careInput(fields: CareFields) {
  const date = new Date(fields.dateTime)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fields.dateTime) ||
    !Number.isFinite(date.getTime()) ||
    localDateTime(date) !== fields.dateTime
  )
    throw new RepositoryError(
      'VALIDATION',
      '올바른 기록 날짜와 시각을 입력해 주세요.',
    )
  let durationMinutes: number | undefined
  if (fields.eventType === 'grow_light') {
    const hours = Number(fields.hours || '0'),
      minutes = Number(fields.minutes || '0')
    if (
      !/^\d*$/.test(fields.hours) ||
      !/^\d*$/.test(fields.minutes) ||
      minutes > 59 ||
      !Number.isSafeInteger(hours * 60 + minutes) ||
      hours * 60 + minutes <= 0
    )
      throw new RepositoryError(
        'VALIDATION',
        '식물등 시간은 1분 이상, 분은 0~59로 입력해 주세요.',
      )
    durationMinutes = hours * 60 + minutes
  }
  if (fields.memo.length > 3000)
    throw new RepositoryError(
      'VALIDATION',
      '메모는 3,000자 이내로 입력해 주세요.',
    )
  return {
    eventType: fields.eventType,
    occurredAt: date.toISOString(),
    durationMinutes,
    memo: fields.memo.trim() || undefined,
  }
}
export async function loadCare(
  repos: Repositories,
  plantId: string,
  eventId: string,
) {
  try {
    validateUuid(plantId)
    validateUuid(eventId)
  } catch {
    throw new RepositoryError('NOT_FOUND', '관리 기록을 찾을 수 없습니다.')
  }
  const event = await repos.careEvents.getById(eventId)
  if (!event || event.plantId !== plantId)
    throw new RepositoryError('NOT_FOUND', '관리 기록을 찾을 수 없습니다.')
  return event
}
export async function saveCare(
  repos: Repositories,
  plantId: string,
  fields: CareFields,
  eventId?: string,
) {
  const input = careInput(fields)
  return repos.runInTransaction(async (tx) => {
    if (eventId) {
      const previous = await loadCare(tx, plantId, eventId)
      // Editing only a memo/type must not round an existing event's seconds.
      if (localDateTime(new Date(previous.occurredAt)) === fields.dateTime)
        input.occurredAt = previous.occurredAt
      return tx.careEvents.update(eventId, input)
    }
    return tx.careEvents.create({ ...input, plantId })
  })
}
export async function deleteCare(
  repos: Repositories,
  plantId: string,
  eventId: string,
) {
  return repos.runInTransaction(async (tx) => {
    await loadCare(tx, plantId, eventId)
    await tx.careEvents.delete(eventId)
  })
}
