import type { Plant, CareEvent } from '../domain/models'
import type { Repositories } from '../domain/repositories'
import { localDateKey } from '../domain/calendar'
import { isThisWeek } from '../lib/dates'
import { careLabels } from './care-service'
export interface ShelfPlant {
  plant: Plant
  lastWatered?: string
  lightMinutes?: number
}
/** Home never loads photos/Blobs; original assets remain available on detail pages. */
export async function loadBookshelf(repos: Repositories, today: string) {
  const plants = await repos.plants.list()
  const records: {
    id: string
    plantId: string
    date: string
    title: string
    occurredAt?: string
  }[] = []
  let weekCount = 0
  const views = await Promise.all(
    plants.map(async (plant) => {
      const [care, diaries] = await Promise.all([
        repos.careEvents.listByPlant(plant.id),
        repos.diaries.listByPlant(plant.id),
      ])
      const dates = [
        ...care.map((e) => localDateKey(new Date(e.occurredAt))),
        ...diaries.map((e) => e.entryDate),
      ]
      weekCount += dates.filter((date) => isThisWeek(date, today)).length
      const latestWater = care
        .filter((e) => e.eventType === 'watering')
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
      const lights = care.filter(
        (e) =>
          e.eventType === 'grow_light' &&
          localDateKey(new Date(e.occurredAt)) === today,
      )
      for (const event of care)
        records.push({
          id: event.id,
          plantId: plant.id,
          date: localDateKey(new Date(event.occurredAt)),
          occurredAt: event.occurredAt,
          title: careTitle(event),
        })
      for (const diary of diaries)
        records.push({
          id: diary.id,
          plantId: plant.id,
          date: diary.entryDate,
          title: diary.title || '관찰 일기',
        })
      return {
        plant,
        lastWatered: latestWater?.occurredAt,
        lightMinutes: lights.length
          ? lights.reduce((n, e) => n + (e.durationMinutes ?? 0), 0)
          : undefined,
      }
    }),
  )
  records.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') ||
      a.id.localeCompare(b.id),
  )
  return { views, weekCount, records: records.slice(0, 2) }
}
function careTitle(event: CareEvent) {
  if (event.eventType === 'watering') return '물주기 완료'
  return event.eventType === 'grow_light'
    ? `식물등 ${event.durationMinutes}분`
    : `${careLabels[event.eventType]} 기록`
}
