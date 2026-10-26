import type { CareEvent, LocalDate } from '../domain/models'
import type { Repositories } from '../domain/repositories'
import { localDateKey } from '../domain/calendar'
import { careLabels } from './care-service'

export type CalendarKind = CareEvent['eventType'] | 'diary'
export const calendarLabels: Record<CalendarKind, string> = {
  ...careLabels,
  diary: '사진 일기',
}
export const calendarKinds = Object.keys(calendarLabels) as CalendarKind[]
export interface CalendarRecord {
  id: string
  plantId: string
  plantName: string
  kind: CalendarKind
  date: LocalDate
  occurredAt?: string
  title: string
  memo?: string
  durationMinutes?: number
  href: string
}

/** Read existing metadata only. No photo Blobs, materialized calendar data or writes. */
export async function loadCalendar(repos: Repositories) {
  return repos.runInTransaction(async (tx) => {
    const plants = await tx.plants.list()
    const groups = await Promise.all(
      plants.map(async (plant) => {
        const [diaries, events] = await Promise.all([
          tx.diaries.listByPlant(plant.id),
          tx.careEvents.listByPlant(plant.id),
        ])
        const records: CalendarRecord[] = diaries.map((entry) => ({
          id: entry.id,
          plantId: plant.id,
          plantName: plant.name,
          kind: 'diary',
          date: entry.entryDate,
          title: entry.title || '사진 일기',
          memo: entry.content,
          href: `/plants/${plant.id}/diary/${entry.id}`,
        }))
        return records.concat(
          events.map((event) => ({
            id: event.id,
            plantId: plant.id,
            plantName: plant.name,
            kind: event.eventType,
            date: localDateKey(new Date(event.occurredAt)),
            occurredAt: event.occurredAt,
            title: calendarLabels[event.eventType],
            memo: event.memo,
            durationMinutes: event.durationMinutes,
            href: `/plants/${plant.id}/care/${event.id}/edit`,
          })),
        )
      }),
    )
    const records = groups.flat().sort((a, b) => {
      const dateOrder = b.date.localeCompare(a.date)
      if (dateOrder) return dateOrder
      if (a.occurredAt && b.occurredAt) {
        const timeOrder = Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
        if (timeOrder) return timeOrder
      } else if (a.occurredAt) return -1
      else if (b.occurredAt) return 1
      return a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
    })
    return { plants, records }
  })
}
