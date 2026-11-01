import type { CareEvent, Plant } from '../domain/models'
import type { Repositories } from '../domain/repositories'
import { localDateKey } from '../domain/calendar'
import { careLabels } from './care-service'
import { parseTimerRecord, formatTimerUsage } from '../lib/timer-record-display'

export type RecordKind = CareEvent['eventType'] | 'diary'
export const recordFilters = [
  ['all', '전체'],
  ['watering', '물주기'],
  ['grow_light', '식물등'],
  ['diary', '사진 일기'],
  ['other', '기타 관리'],
] as const
export type RecordFilter = (typeof recordFilters)[number][0]
export interface RecordListEntry {
  key: string
  sourceId: string
  recordType: 'care_event' | 'diary'
  kind: RecordKind
  plantId: string
  date: string
  createdAt: string
  occurredAt?: string
  title: string
  timerUsage?: string
  href: string
}
const order: RecordKind[] = [
  'watering',
  'grow_light',
  'repotting',
  'fertilizing',
  'diary',
]
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
export function compareRecords(a: RecordListEntry, b: RecordListEntry) {
  return (
    compareText(b.date, a.date) ||
    Number(Boolean(b.occurredAt)) - Number(Boolean(a.occurredAt)) ||
    (a.occurredAt && b.occurredAt
      ? Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
      : 0) ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    compareText(a.recordType, b.recordType) ||
    order.indexOf(a.kind) - order.indexOf(b.kind) ||
    compareText(a.sourceId, b.sourceId) ||
    compareText(a.plantId, b.plantId)
  )
}
export function recordsSelection(params: URLSearchParams, plants: Plant[]) {
  const rawType = params.get('type')
  const rawPlant = params.get('plant')
  const type = recordFilters.some(([value]) => value === rawType)
    ? (rawType as RecordFilter)
    : 'all'
  const plant = plants.some((p) => p.id === rawPlant) ? rawPlant! : ''
  return {
    type,
    plant,
    invalid: Boolean((rawType && rawType !== type) || (rawPlant && !plant)),
  }
}
export function filterRecords(
  records: RecordListEntry[],
  type: RecordFilter,
  plant: string,
) {
  return records.filter(
    (r) =>
      (!plant || r.plantId === plant) &&
      (type === 'all' ||
        (type === 'other'
          ? r.kind === 'repotting' || r.kind === 'fertilizing'
          : r.kind === type)),
  )
}
/** Metadata only. The existing transaction API uses rw locks, but this callback never writes. */
export function loadRecordIndex(repos: Repositories) {
  return repos.runInTransaction(async (tx) => {
    const plants = await tx.plants.list()
    const groups = await Promise.all(
      plants.map(async (plant) => {
        const [events, diaries] = await Promise.all([
          tx.careEvents.listByPlant(plant.id),
          tx.diaries.listByPlant(plant.id),
        ])
        return [
          ...events.map((event): RecordListEntry => {
            const timer =
              event.eventType === 'grow_light'
                ? parseTimerRecord(event.memo ?? '')
                : undefined
            return {
              key: `care_event:${event.id}`,
              sourceId: event.id,
              recordType: 'care_event',
              kind: event.eventType,
              plantId: plant.id,
              date: localDateKey(new Date(event.occurredAt)),
              createdAt: event.createdAt,
              occurredAt: event.occurredAt,
              title:
                event.eventType === 'watering'
                  ? '물주기 완료'
                  : event.eventType === 'grow_light'
                    ? `식물등 ${event.durationMinutes}분`
                    : `${careLabels[event.eventType]} 기록`,
              timerUsage: timer
                ? formatTimerUsage(timer.elapsedSeconds)
                : undefined,
              href: `/plants/${plant.id}#care-event-${event.id}`,
            }
          }),
          ...diaries.map((entry): RecordListEntry => ({
            key: `diary:${entry.id}`,
            sourceId: entry.id,
            recordType: 'diary',
            kind: 'diary',
            plantId: plant.id,
            date: entry.entryDate,
            createdAt: entry.createdAt,
            title: entry.title || '관찰 일기',
            href: `/plants/${plant.id}/diary/${entry.id}`,
          })),
        ]
      }),
    )
    return { plants, records: groups.flat().sort(compareRecords) }
  })
}
