import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabase } from '../test/render-app'
import { loadCalendar } from './calendar-service'
let context: ReturnType<typeof testDatabase>
let plantId: string
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({ name: '초록이', status: 'healthy' })
  ).id
})
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
describe('Repository 기반 캘린더 조회', () => {
  it('5개 유형·여러 식물·같은 날짜 여러 기록을 원본 ID/경로와 함께 반환하며 사진은 읽지 않는다', async () => {
    const other = await context.repos.plants.create({
      name: '두 번째',
      status: 'observing',
    })
    const date = new Date(2026, 0, 2, 10, 30).toISOString()
    for (const eventType of [
      'watering',
      'grow_light',
      'repotting',
      'fertilizing',
    ] as const)
      await context.repos.careEvents.create({
        plantId,
        eventType,
        occurredAt: date,
        ...(eventType === 'grow_light' ? { durationMinutes: 75 } : {}),
      })
    const diary = await context.repos.diaries.create({
      plantId: other.id,
      entryDate: '2026-01-02',
      condition: 'good',
      title: '새잎 일기',
    })
    const photos = vi.spyOn(context.repos.photos, 'listByPlant')
    const { plants, records } = await loadCalendar(context.repos)
    expect(plants).toHaveLength(2)
    expect(records).toHaveLength(5)
    expect(new Set(records.map((r) => r.kind)).size).toBe(5)
    expect(records.every((r) => r.date === '2026-01-02')).toBe(true)
    expect(records.find((r) => r.kind === 'diary')).toMatchObject({
      id: diary.id,
      plantName: '두 번째',
      href: `/plants/${other.id}/diary/${diary.id}`,
    })
    expect(records.find((r) => r.kind === 'grow_light')).toMatchObject({
      durationMinutes: 75,
    })
    expect(photos).not.toHaveBeenCalled()
  })
  it('이벤트는 기기 로컬 날짜, 일기는 entryDate로 판정하며 생성 날짜를 사용하지 않는다', async () => {
    await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date(2026, 0, 1, 0, 15).toISOString(),
    })
    await context.repos.careEvents.create({
      plantId,
      eventType: 'repotting',
      occurredAt: new Date(2025, 11, 31, 23, 45).toISOString(),
    })
    await context.repos.diaries.create({
      plantId,
      condition: 'normal',
      entryDate: '2024-02-29',
    })
    const { records } = await loadCalendar(context.repos)
    expect(records.find((r) => r.kind === 'watering')?.date).toBe('2026-01-01')
    expect(records.find((r) => r.kind === 'repotting')?.date).toBe('2025-12-31')
    expect(records.find((r) => r.kind === 'diary')?.date).toBe('2024-02-29')
  })
  it('추가·날짜/유형 수정·삭제를 원본에서 다시 읽어 중복 집계 없이 반영한다', async () => {
    const event = await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date(2026, 0, 2, 12).toISOString(),
    })
    expect((await loadCalendar(context.repos)).records).toHaveLength(1)
    await context.repos.careEvents.update(event.id, {
      eventType: 'fertilizing',
      occurredAt: new Date(2026, 1, 1, 12).toISOString(),
    })
    const changed = (await loadCalendar(context.repos)).records
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatchObject({
      id: event.id,
      date: '2026-02-01',
      kind: 'fertilizing',
    })
    await context.repos.careEvents.delete(event.id)
    expect((await loadCalendar(context.repos)).records).toEqual([])
  })
  it('일기 날짜 수정·삭제와 식물 삭제를 조회에 반영한다', async () => {
    const entry = await context.repos.diaries.create({
      plantId,
      entryDate: '2026-01-02',
      condition: 'good',
    })
    await context.repos.diaries.update(entry.id, { entryDate: '2025-12-31' })
    expect((await loadCalendar(context.repos)).records[0].date).toBe(
      '2025-12-31',
    )
    await context.repos.diaries.delete(entry.id)
    expect((await loadCalendar(context.repos)).records).toEqual([])
    await context.repos.plants.delete(plantId)
    expect(await loadCalendar(context.repos)).toEqual({
      plants: [],
      records: [],
    })
  })
  it('시간대 오프셋이 다른 기록은 실제 시각 순으로 정렬한다', async () => {
    const older = await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: '2026-01-02T12:00:00+09:00',
    })
    const newer = await context.repos.careEvents.create({
      plantId,
      eventType: 'fertilizing',
      occurredAt: '2026-01-02T05:00:00Z',
    })
    const { records } = await loadCalendar(context.repos)
    expect(records.map((record) => record.id)).toEqual([newer.id, older.id])
  })
  it('조회 실패를 호출자에게 전달하며 기존 데이터를 수정하지 않는다', async () => {
    vi.spyOn(context.repos.diaries, 'listByPlant').mockRejectedValueOnce(
      new Error('read failed'),
    )
    await expect(loadCalendar(context.repos)).rejects.toMatchObject({
      code: 'STORAGE',
      cause: expect.any(Error),
    })
    expect(await context.repos.plants.list()).toHaveLength(1)
  })
})
