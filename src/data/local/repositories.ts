import { validateSnapshot } from '../../domain/backup'
import type { Table } from 'dexie'
import { RepositoryError } from '../../domain/errors'
import { calendarDaysBetween, localDateKey } from '../../domain/calendar'
import type {
  CareEvent,
  CreateInput,
  DiaryEntry,
  DiaryPhoto,
  Plant,
  TimelineRecord,
  UpdateInput,
} from '../../domain/models'
import type { EntityRepository, Repositories } from '../../domain/repositories'
import {
  invalid,
  validateCareEvent,
  validateDate,
  validateDiary,
  validatePhoto,
  validatePlant,
  validateUuid,
} from '../../domain/validation'
import type { LeaforyDatabase } from './database'
import { createLightTimerRepository } from './light-timer'
import { TIMER_KEY } from '../../domain/light-timer'

type Stored = { id: string; createdAt: string; updatedAt?: string }

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause
    const conflict = cause instanceof Error && cause.name === 'ConstraintError'
    throw new RepositoryError(
      conflict ? 'CONFLICT' : 'STORAGE',
      conflict ? '이미 존재하는 ID입니다.' : '로컬 저장소 작업에 실패했습니다.',
      { cause },
    )
  }
}
function fields(input: unknown, allowed: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    invalid('입력은 객체여야 합니다.')
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) invalid(`${key}: 변경할 수 없는 필드입니다.`)
}
function notFound(entity: string): never {
  throw new RepositoryError('NOT_FOUND', `${entity}을(를) 찾을 수 없습니다.`)
}
function utc(value: string) {
  return new Date(value).toISOString()
}
function newest<T extends { id: string; createdAt: string }>(a: T, b: T) {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
}

/** No singleton: construction is explicit and independent from React and the mock UI. */
export function createLocalRepositories(db: LeaforyDatabase): Repositories {
  const dataTables = [db.plants, db.diaries, db.photos, db.careEvents]
  const tables = [...dataTables, db.timerState]
  const read = <T>(work: () => Promise<T>) =>
    guard(() => db.transaction('r', tables, work))
  const write = <T>(work: () => Promise<T>) =>
    guard(() => db.transaction('rw', tables, work))
  async function plantExists(id: string) {
    validateUuid(id, 'plantId')
    if (!(await db.plants.get(id))) notFound('식물')
  }
  async function clearCovers(photoIds: string[]) {
    const covers = new Set(photoIds)
    const plants = await db.plants.toArray()
    for (const plant of plants)
      if (plant.coverPhotoId && covers.has(plant.coverPhotoId)) {
        await db.plants.put({
          ...plant,
          coverPhotoId: undefined,
          updatedAt: new Date().toISOString(),
        })
      }
  }

  function crud<T extends Stored>(options: {
    table: Table<T, string>
    keys: string[]
    timestamped: boolean
    validate: (value: T) => void
    relations: (value: T) => Promise<void>
    remove: (value: T) => Promise<void>
    normalize?: (value: T) => T
  }): EntityRepository<T> {
    const { table, keys, timestamped, validate, relations, remove } = options
    return {
      create: (input: CreateInput<T>) =>
        write(async () => {
          fields(input, [...keys, 'id'])
          const now = new Date().toISOString()
          let value = {
            ...input,
            id: input.id === undefined ? crypto.randomUUID() : input.id,
            createdAt: now,
            ...(timestamped ? { updatedAt: now } : {}),
          } as T
          validate(value)
          value = options.normalize?.(value) ?? value
          await relations(value)
          await table.add(value)
          return value
        }),
      getById: (id) =>
        read(async () => {
          validateUuid(id)
          return table.get(id)
        }),
      update: (id, patch: UpdateInput<T>) =>
        write(async () => {
          validateUuid(id)
          fields(
            patch,
            keys.filter((key) => key !== 'plantId'),
          )
          const current = await table.get(id)
          if (!current) notFound('기록')
          let value = {
            ...current,
            ...patch,
            ...(timestamped ? { updatedAt: new Date().toISOString() } : {}),
          } as T
          validate(value)
          value = options.normalize?.(value) ?? value
          await relations(value)
          await table.put(value)
          return value
        }),
      delete: (id) =>
        write(async () => {
          validateUuid(id)
          const value = await table.get(id)
          if (!value) notFound('기록')
          await remove(value)
          await table.delete(id)
        }),
    }
  }

  const plants = crud<Plant>({
    table: db.plants,
    keys: ['name', 'species', 'acquiredAt', 'status', 'memo', 'coverPhotoId'],
    timestamped: true,
    validate: validatePlant,
    relations: async (plant) => {
      if (plant.coverPhotoId) {
        const photo = await db.photos.get(plant.coverPhotoId)
        if (!photo) notFound('대표 사진')
        if (photo.plantId !== plant.id)
          invalid('coverPhotoId: 다른 식물의 사진입니다.')
      }
    },
    remove: async (plant) => {
      if ((await db.timerState.get(TIMER_KEY))?.plantId === plant.id)
        throw new RepositoryError(
          'CONFLICT',
          '식물등 타이머를 종료하거나 취소한 뒤 식물을 삭제해 주세요.',
        )
      await db.diaries.where('plantId').equals(plant.id).delete()
      await db.photos.where('plantId').equals(plant.id).delete()
      await db.careEvents.where('plantId').equals(plant.id).delete()
    },
  })
  const diaries = crud<DiaryEntry>({
    table: db.diaries,
    keys: ['plantId', 'entryDate', 'condition', 'title', 'content'],
    timestamped: true,
    validate: validateDiary,
    relations: (entry) => plantExists(entry.plantId),
    remove: async (entry) => {
      const photos = await db.photos.where('entryId').equals(entry.id).toArray()
      await clearCovers(photos.map((photo) => photo.id))
      await db.photos.bulkDelete(photos.map((photo) => photo.id))
    },
  })
  const photos = crud<DiaryPhoto>({
    table: db.photos,
    keys: ['plantId', 'entryId', 'blob', 'mimeType', 'capturedAt', 'sortOrder'],
    timestamped: false,
    validate: validatePhoto,
    normalize: (photo) => ({ ...photo, capturedAt: utc(photo.capturedAt) }),
    relations: async (photo) => {
      await plantExists(photo.plantId)
      if (photo.entryId) {
        const entry = await db.diaries.get(photo.entryId)
        if (!entry) notFound('일기')
        if (entry.plantId !== photo.plantId)
          invalid('entryId: 다른 식물의 일기입니다.')
      }
    },
    remove: (photo) => clearCovers([photo.id]),
  })
  const careEvents = crud<CareEvent>({
    table: db.careEvents,
    keys: ['plantId', 'eventType', 'occurredAt', 'durationMinutes', 'memo'],
    timestamped: true,
    validate: validateCareEvent,
    normalize: (event) => ({ ...event, occurredAt: utc(event.occurredAt) }),
    relations: (event) => plantExists(event.plantId),
    remove: async () => {},
  })
  const listByPlant =
    <T extends Stored & { plantId: string }>(
      table: Table<T, string>,
      sort: (a: T, b: T) => number,
    ) =>
    (plantId: string) =>
      read(async () => {
        await plantExists(plantId)
        return (await table.where('plantId').equals(plantId).toArray()).sort(
          sort,
        )
      })
  async function watering(plantId: string) {
    await plantExists(plantId)
    const events = await db.careEvents
      .where('[plantId+eventType]')
      .equals([plantId, 'watering'])
      .toArray()
    return events.sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id),
    )[0]?.occurredAt
  }
  const repositories: Repositories = {
    lightTimer: createLightTimerRepository(db, read, write, (input) =>
      careEvents.create(input),
    ),
    backup: {
      snapshot: () =>
        read(async () => {
          const [plants, diaries, photos, careEvents] = await Promise.all([
            db.plants.toArray(),
            db.diaries.toArray(),
            db.photos.toArray(),
            db.careEvents.toArray(),
          ])
          return { plants, diaries, photos, careEvents }
        }),
      counts: () =>
        read(async () => ({
          plants: await db.plants.count(),
          diaries: await db.diaries.count(),
          photos: await db.photos.count(),
          careEvents: await db.careEvents.count(),
        })),
      replace: (data) =>
        write(async () => {
          validateSnapshot(data)
          if (await db.timerState.count())
            throw new RepositoryError(
              'CONFLICT',
              '실행 중이거나 일시정지한 식물등 타이머를 종료하거나 취소한 뒤 복원해 주세요.',
            )
          // Preserve IDs and timestamp instants; normalize ISO representation like normal CRUD.
          const timestamps = <
            T extends { createdAt: string; updatedAt?: string },
          >(
            row: T,
          ) => ({
            ...row,
            createdAt: utc(row.createdAt),
            ...(row.updatedAt === undefined
              ? {}
              : { updatedAt: utc(row.updatedAt) }),
          })
          // Clearing and inserting all tables share this transaction.
          for (const table of dataTables) await table.clear()
          await db.plants.bulkAdd(data.plants.map(timestamps))
          await db.diaries.bulkAdd(data.diaries.map(timestamps))
          await db.photos.bulkAdd(
            data.photos.map((p) => ({
              ...timestamps(p),
              capturedAt: utc(p.capturedAt),
            })),
          )
          await db.careEvents.bulkAdd(
            data.careEvents.map((e) => ({
              ...timestamps(e),
              occurredAt: utc(e.occurredAt),
            })),
          )
        }),
    },
    plants: {
      ...plants,
      list: () => read(async () => (await db.plants.toArray()).sort(newest)),
    },
    diaries: {
      ...diaries,
      listByPlant: listByPlant(
        db.diaries,
        (a, b) => b.entryDate.localeCompare(a.entryDate) || newest(a, b),
      ),
    },
    photos: {
      ...photos,
      listByPlant: listByPlant(
        db.photos,
        (a, b) => a.sortOrder - b.sortOrder || newest(a, b),
      ),
    },
    careEvents: {
      ...careEvents,
      listByPlant: listByPlant(
        db.careEvents,
        (a, b) => b.occurredAt.localeCompare(a.occurredAt) || newest(a, b),
      ),
    },
    queries: {
      recentTimeline: (plantId, limit = 20) =>
        read(async () => {
          await plantExists(plantId)
          if (!Number.isSafeInteger(limit) || limit < 1)
            invalid('limit: 양의 정수가 필요합니다.')
          const diaries = await db.diaries
            .where('plantId')
            .equals(plantId)
            .toArray()
          const events = await db.careEvents
            .where('plantId')
            .equals(plantId)
            .toArray()
          const records: TimelineRecord[] = [
            ...diaries.map((record): TimelineRecord => ({
              id: record.id,
              recordType: 'diary',
              date: record.entryDate,
              record,
            })),
            ...events.map((record): TimelineRecord => ({
              id: record.id,
              recordType: 'care_event',
              date: localDateKey(new Date(record.occurredAt)),
              record,
            })),
          ]
          const instant = (row: TimelineRecord) =>
            row.recordType === 'diary'
              ? row.record.createdAt
              : row.record.occurredAt
          return records
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                instant(b).localeCompare(instant(a)) ||
                a.recordType.localeCompare(b.recordType) ||
                a.id.localeCompare(b.id),
            )
            .slice(0, limit)
        }),
      lastWateringAt: (plantId) => read(() => watering(plantId)),
      daysSinceLastWatering: (plantId, today = localDateKey()) =>
        read(async () => {
          validateDate(today, 'today')
          const last = await watering(plantId)
          return last === undefined
            ? undefined
            : Math.max(
                0,
                calendarDaysBetween(localDateKey(new Date(last)), today),
              )
        }),
      growLightMinutes: (plantId, date) =>
        read(async () => {
          await plantExists(plantId)
          validateDate(date)
          const events = await db.careEvents
            .where('[plantId+eventType]')
            .equals([plantId, 'grow_light'])
            .toArray()
          const minutes = events
            .filter(
              (event) => localDateKey(new Date(event.occurredAt)) === date,
            )
            .reduce((sum, event) => sum + event.durationMinutes!, 0)
          if (!Number.isSafeInteger(minutes))
            invalid('식물등 합계가 안전한 정수 범위를 초과했습니다.')
          return minutes
        }),
      totalRecordCount: (plantId) =>
        read(async () => {
          await plantExists(plantId)
          return (
            (await db.diaries.where('plantId').equals(plantId).count()) +
            (await db.careEvents.where('plantId').equals(plantId).count())
          )
        }),
    },
    runInTransaction: (work) => write(() => work(repositories)),
  }
  return repositories
}
