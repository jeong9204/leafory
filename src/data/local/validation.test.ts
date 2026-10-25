// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaforyDatabase } from './database'
import { createLocalRepositories } from './repositories'
import { calendarDaysBetween, localDateKey } from '../../domain/calendar'
import type { Repositories } from '../../domain/repositories'

let db: LeaforyDatabase
let repos: Repositories
beforeEach(() => {
  db = new LeaforyDatabase(`leafory-validation-${crypto.randomUUID()}`)
  repos = createLocalRepositories(db)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await db.delete()
})

function unsafePlant(input: unknown) {
  return repos.plants.create(input as Parameters<typeof repos.plants.create>[0])
}

describe('입력 검증', () => {
  it.each([
    [{ status: 'healthy' }, '이름 누락'],
    [{ name: '   ', status: 'healthy' }, '빈 이름'],
    [{ name: '식물', status: 'invalid' }, '잘못된 상태'],
    [{ name: '식물', status: 'healthy', id: 'bad-id' }, '잘못된 UUID'],
    [{ name: '식물', status: 'healthy', id: null }, 'null UUID'],
    [
      { name: '식물', status: 'healthy', createdAt: '2020-01-01' },
      '임의 저장 시각',
    ],
    [{ name: '식물', status: 'healthy', memo: 10 }, '문자열 아닌 메모'],
    [null, 'null 입력'],
  ])('%s: %s', async (input, description) => {
    await expect(unsafePlant(input), description).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    expect(await repos.plants.list()).toEqual([])
  })
  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-10-00',
    '2026-1-01',
    'invalid',
    '2026-10-24T12:00:00Z',
  ])('%s는 달력 날짜로 거부한다', async (date) => {
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    await expect(
      repos.plants.update(p.id, { acquiredAt: date }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.diaries.create({
        plantId: p.id,
        entryDate: date,
        condition: 'good',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await repos.diaries.listByPlant(p.id)).toEqual([])
    expect((await repos.plants.getById(p.id))?.acquiredAt).toBeUndefined()
  })
  it.each([
    '2026-02-30T12:00:00Z',
    '2026-10-24T24:00:00Z',
    '2026-10-24T12:60:00Z',
    '2026-10-24T12:00:60Z',
    '2026-10-24T12:00:00',
    '2026-10-24T12:00:00+25:00',
    'not-a-date',
  ])('%s는 저장 시각으로 거부한다', async (occurredAt) => {
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    await expect(
      repos.careEvents.create({
        plantId: p.id,
        eventType: 'watering',
        occurredAt,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it.each([undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    '잘못된 식물등 분 %s를 거부한다',
    async (durationMinutes) => {
      const p = await repos.plants.create({ name: '식물', status: 'healthy' })
      await expect(
        repos.careEvents.create({
          plantId: p.id,
          eventType: 'grow_light',
          occurredAt: '2026-10-24T12:00:00Z',
          durationMinutes,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' })
    },
  )
  it('정수 합산 오버플로도 명시적으로 거부한다', async () => {
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    const instant = new Date(2026, 9, 24, 12)
    for (const durationMinutes of [Number.MAX_SAFE_INTEGER, 1])
      await repos.careEvents.create({
        plantId: p.id,
        eventType: 'grow_light',
        occurredAt: instant.toISOString(),
        durationMinutes,
      })
    await expect(
      repos.queries.growLightMinutes(p.id, localDateKey(instant)),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('일기 상태·이벤트 종류·필수 값과 불변 필드를 검증한다', async () => {
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    const entry = await repos.diaries.create({
      plantId: p.id,
      entryDate: '2024-02-29',
      condition: 'good',
    })
    await expect(
      repos.diaries.update(entry.id, { condition: 'bad' } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.diaries.update(entry.id, { plantId: crypto.randomUUID() } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.plants.update(p.id, { id: crypto.randomUUID() } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.careEvents.create({
        plantId: p.id,
        eventType: 'invalid',
        occurredAt: '2026-10-24T12:00:00Z',
      } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.careEvents.create({
        plantId: p.id,
        eventType: 'watering',
      } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await repos.diaries.getById(entry.id))?.condition).toBe('good')
  })
  it('사진 Blob·MIME·정렬 순서와 없는 일기 참조를 검증한다', async () => {
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    const input = {
      plantId: p.id,
      blob: new Blob(['image'], { type: 'image/png' }),
      mimeType: 'image/png',
      capturedAt: '2026-10-24T12:00:00Z',
      sortOrder: 0,
    }
    for (const patch of [
      { blob: new Blob([], { type: 'image/png' }) },
      { blob: 'not-a-blob' },
      { mimeType: 'image/jpeg' },
      { blob: new Blob(['x'], { type: 'text/plain' }), mimeType: 'text/plain' },
      { capturedAt: '2026-02-30T12:00:00Z' },
      { sortOrder: -1 },
      { sortOrder: 1.5 },
    ])
      await expect(
        repos.photos.create({ ...input, ...patch } as never),
      ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.photos.create({ ...input, entryId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await repos.photos.listByPlant(p.id)).toEqual([])
  })
  it('잘못된 조회 날짜와 limit을 거부한다', async () => {
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    await expect(
      repos.queries.growLightMinutes(p.id, '2026-02-30'),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.queries.daysSinceLastWatering(p.id, 'bad-date'),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    for (const limit of [0, -1, 1.5, NaN])
      await expect(
        repos.queries.recentTimeline(p.id, limit),
      ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('사용자 로컬 달력과 UTC 저장 시각의 분리', () => {
  it.each([
    ['Asia/Seoul', '2026-10-23T15:30:00Z', '2026-10-24'],
    ['America/Los_Angeles', '2026-10-24T02:30:00Z', '2026-10-23'],
    ['UTC', '2026-10-24T02:30:00Z', '2026-10-24'],
  ])(
    '%s의 현지 날짜로 일기와 식물등을 조회한다',
    async (zone, instant, expected) => {
      vi.stubEnv('TZ', zone)
      expect(localDateKey(new Date(instant))).toBe(expected)
      const p = await repos.plants.create({ name: '식물', status: 'healthy' })
      const entry = await repos.diaries.create({
        plantId: p.id,
        entryDate: localDateKey(new Date(instant)),
        condition: 'normal',
      })
      await repos.careEvents.create({
        plantId: p.id,
        eventType: 'grow_light',
        occurredAt: instant,
        durationMinutes: 30,
      })
      expect(entry.entryDate).toBe(expected)
      expect(await repos.queries.growLightMinutes(p.id, expected)).toBe(30)
      expect(
        (await repos.queries.recentTimeline(p.id)).every(
          (row) => row.date === expected,
        ),
      ).toBe(true)
    },
  )
  it('자정 경계를 넘는 이벤트는 시작 시각의 로컬 날짜에 귀속한다', async () => {
    vi.stubEnv('TZ', 'Asia/Seoul')
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    await repos.careEvents.create({
      plantId: p.id,
      eventType: 'grow_light',
      occurredAt: '2026-10-24T23:30:00+09:00',
      durationMinutes: 120,
    })
    expect(await repos.queries.growLightMinutes(p.id, '2026-10-24')).toBe(120)
    expect(await repos.queries.growLightMinutes(p.id, '2026-10-25')).toBe(0)
  })
  it('물주기 경과 일수는 자정과 DST 경계에서도 달력 날짜로 계산한다', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    const p = await repos.plants.create({ name: '식물', status: 'healthy' })
    await repos.careEvents.create({
      plantId: p.id,
      eventType: 'watering',
      occurredAt: '2026-03-07T23:30:00-05:00',
    })
    expect(await repos.queries.daysSinceLastWatering(p.id, '2026-03-09')).toBe(
      2,
    )
    expect(calendarDaysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })
})
