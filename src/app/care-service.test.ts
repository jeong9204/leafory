import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { testDatabase } from '../test/render-app'
import {
  careInput,
  deleteCare,
  loadCare,
  localDateTime,
  saveCare,
} from './care-service'
import { loadPlant } from './plant-service'
import { localDateKey } from '../domain/calendar'
let context: ReturnType<typeof testDatabase>
let plantId: string
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({
      name: '기록 테스트',
      status: 'healthy',
    })
  ).id
})
afterEach(async () => context.db.delete())
const fields = (dateTime = '2026-01-02T12:30') => ({
  eventType: 'watering' as const,
  dateTime,
  hours: '',
  minutes: '',
  memo: ' 과거 기록 ',
})
describe('빠른 관리 기록 서비스', () => {
  it('과거 물주기 생성·수정·삭제 후 마지막 날짜와 건수를 재계산한다', async () => {
    const old = await saveCare(context.repos, plantId, fields())
    const recent = await saveCare(
      context.repos,
      plantId,
      fields('2026-01-05T09:00'),
    )
    expect((await loadPlant(context.repos, plantId)).lastWatered).toBe(
      recent.occurredAt,
    )
    const updated = await saveCare(
      context.repos,
      plantId,
      fields('2026-01-06T10:00'),
      old.id,
    )
    expect(updated.memo).toBe('과거 기록')
    expect((await loadPlant(context.repos, plantId)).lastWatered).toBe(
      updated.occurredAt,
    )
    await deleteCare(context.repos, plantId, old.id)
    expect((await loadPlant(context.repos, plantId)).lastWatered).toBe(
      recent.occurredAt,
    )
    await deleteCare(context.repos, plantId, recent.id)
    expect(await loadPlant(context.repos, plantId)).toMatchObject({
      recordCount: 0,
      lightMinutes: undefined,
      lastWatered: undefined,
    })
  })
  it('오늘 식물등 시간만 합산하고 삭제 후 갱신한다', async () => {
    const light = {
      ...fields(localDateTime()),
      eventType: 'grow_light' as const,
      hours: '1',
      minutes: '30',
    }
    const first = await saveCare(context.repos, plantId, light)
    await saveCare(context.repos, plantId, {
      ...light,
      hours: '0',
      minutes: '20',
    })
    await saveCare(context.repos, plantId, {
      ...light,
      dateTime: '2020-01-02T12:30',
    })
    expect((await loadPlant(context.repos, plantId)).lightMinutes).toBe(110)
    await deleteCare(context.repos, plantId, first.id)
    expect((await loadPlant(context.repos, plantId)).lightMinutes).toBe(20)
  })
  it.each(['repotting', 'fertilizing'] as const)(
    '%s 기록을 저장하고 다시 DB를 열어 복원한다',
    async (eventType) => {
      const saved = await saveCare(context.repos, plantId, {
        ...fields(),
        eventType,
      })
      context.db.close()
      await context.db.open()
      expect(await loadCare(context.repos, plantId, saved.id)).toEqual(saved)
    },
  )
  it('다른 식물의 이벤트 수정과 삭제를 거절한다', async () => {
    const other = await context.repos.plants.create({
      name: '다른 식물',
      status: 'healthy',
    })
    const event = await saveCare(context.repos, plantId, fields())
    await expect(
      saveCare(context.repos, other.id, fields(), event.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      deleteCare(context.repos, other.id, event.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await context.repos.careEvents.getById(event.id)).toBeDefined()
  })
  it.each(['2026-02-30T12:30', 'invalid', '2026-01-01T25:00'])(
    '잘못된 로컬 일시 %s를 거부한다',
    (dateTime) => {
      expect(() => careInput(fields(dateTime))).toThrow()
    },
  )
  it.each([
    ['0', '0'],
    ['1', '60'],
    ['-1', '30'],
    ['1.5', '0'],
    ['1e2', '0'],
  ])('잘못된 식물등 시간 %s:%s를 거부한다', (hours, minutes) => {
    expect(() =>
      careInput({ ...fields(), eventType: 'grow_light', hours, minutes }),
    ).toThrow()
  })
  it('로컬 자정의 날짜를 유지하며 ISO로 변환한다', () => {
    const input = careInput(fields('2026-01-02T00:01'))
    expect(localDateKey(new Date(input.occurredAt))).toBe('2026-01-02')
  })
})

it('메모만 수정하면 원래 기록의 초와 밀리초를 유지한다', async () => {
  const original = await context.repos.careEvents.create({
    plantId,
    eventType: 'watering',
    occurredAt: '2026-01-02T00:01:45.123Z',
  })
  const updated = await saveCare(
    context.repos,
    plantId,
    {
      ...fields(localDateTime(new Date(original.occurredAt))),
      memo: '메모 수정',
    },
    original.id,
  )
  expect(updated.occurredAt).toBe(original.occurredAt)
})
