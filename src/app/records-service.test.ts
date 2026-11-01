import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabase, fixtureIds } from '../test/render-app'
import { localDateKey } from '../domain/calendar'
import {
  compareRecords,
  filterRecords,
  loadRecordIndex,
  recordsSelection,
} from './records-service'
import type { RecordListEntry } from './records-service'
let context: ReturnType<typeof testDatabase>
let plantId: string
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({ name: '괴마옥', status: 'healthy' })
  ).id
})
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
const row = (patch: Partial<RecordListEntry> = {}): RecordListEntry => ({
  key: 'care_event:a',
  sourceId: 'a',
  recordType: 'care_event',
  kind: 'watering',
  plantId: 'p',
  date: '2026-01-02',
  occurredAt: '2026-01-02T10:00:00Z',
  createdAt: '2026-01-03T00:00:00Z',
  title: '물주기',
  href: '/',
  ...patch,
})
describe('전체 기록 메타데이터', () => {
  it('같은 UUID의 일기와 이벤트를 모두 보존하고 사진/백업/미완료 타이머를 읽지 않는다', async () => {
    const id = fixtureIds[0]
    await context.repos.careEvents.create({
      id,
      plantId,
      eventType: 'watering',
      occurredAt: '2026-01-02T00:30:00Z',
    })
    await context.repos.diaries.create({
      id,
      plantId,
      entryDate: '2026-01-02',
      condition: 'good',
    })
    const spies = [
      vi.spyOn(context.repos.photos, 'listByPlant'),
      vi.spyOn(context.repos.photos, 'getById'),
      vi.spyOn(context.repos.backup, 'snapshot'),
      vi.spyOn(context.repos.lightTimer, 'get'),
    ]
    const result = await loadRecordIndex(context.repos)
    expect(result.records.map((r) => r.key)).toEqual([
      `care_event:${id}`,
      `diary:${id}`,
    ])
    expect(result.records[1]).toMatchObject({
      title: '관찰 일기',
      href: `/plants/${plantId}/diary/${id}`,
    })
    expect(result.records[0].href).toBe(`/plants/${plantId}#care-event-${id}`)
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  })
  it('5개 실제 유형과 식물별/복합/기타 필터를 지원한다', async () => {
    const other = await context.repos.plants.create({
      name: '몬스테라',
      status: 'healthy',
    })
    for (const eventType of [
      'watering',
      'grow_light',
      'repotting',
      'fertilizing',
    ] as const)
      await context.repos.careEvents.create({
        plantId,
        eventType,
        occurredAt: '2026-01-02T09:00:00Z',
        ...(eventType === 'grow_light' ? { durationMinutes: 75 } : {}),
      })
    await context.repos.diaries.create({
      plantId: other.id,
      entryDate: '2026-01-02',
      condition: 'normal',
    })
    const { records, plants } = await loadRecordIndex(context.repos)
    expect(records).toHaveLength(5)
    expect(filterRecords(records, 'all', plantId)).toHaveLength(4)
    expect(filterRecords(records, 'other', '')).toHaveLength(2)
    expect(filterRecords(records, 'diary', other.id)).toHaveLength(1)
    expect(filterRecords(records, 'watering', other.id)).toHaveLength(0)
    expect(filterRecords(records, 'grow_light', '')).toHaveLength(1)
    expect(
      recordsSelection(
        new URLSearchParams('type=unknown&plant=deleted'),
        plants,
      ),
    ).toEqual({ type: 'all', plant: '', invalid: true })
  })
  it('로컬 날짜와 과거 일기 날짜를 사용하고 createdAt을 관찰 시각으로 만들지 않는다', async () => {
    const instant = '2026-01-01T23:30:00-08:00'
    await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: instant,
    })
    await context.repos.diaries.create({
      plantId,
      entryDate: '2024-02-29',
      condition: 'normal',
    })
    const { records } = await loadRecordIndex(context.repos)
    expect(records[0].date).toBe(localDateKey(new Date(instant)))
    expect(records[1].date).toBe('2024-02-29')
    expect(records[1].occurredAt).toBeUndefined()
  })
  it('타이머 완료만 표시하고 원문 ISO 메모를 목록 DTO에 노출하지 않는다', async () => {
    await context.repos.lightTimer.start(plantId)
    expect((await loadRecordIndex(context.repos)).records).toHaveLength(0)
    await context.repos.careEvents.create({
      plantId,
      eventType: 'grow_light',
      occurredAt: '2026-01-02T00:01:01Z',
      durationMinutes: 1,
      memo: '식물등 타이머 자동 기록\n실제 누적 00:01:01\n시작 2026-01-01T23:59:00Z\n측정 종료 2026-01-02T00:01:01Z\n사용자 메모',
    })
    const { records } = await loadRecordIndex(context.repos)
    expect(records[0]).toMatchObject({
      title: '식물등 1분',
      timerUsage: '1분 1초',
      date: localDateKey(new Date('2026-01-02T00:01:01Z')),
    })
    expect(JSON.stringify(records)).not.toContain('실제 누적')
  })
  it('수정/삭제/식물 cascade를 다음 조회에 반영한다', async () => {
    const event = await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: '2026-01-02T09:00:00Z',
    })
    await context.repos.careEvents.update(event.id, {
      eventType: 'repotting',
      occurredAt: '2025-12-31T09:00:00Z',
    })
    expect((await loadRecordIndex(context.repos)).records[0].kind).toBe(
      'repotting',
    )
    await context.repos.careEvents.delete(event.id)
    expect((await loadRecordIndex(context.repos)).records).toHaveLength(0)
    await context.repos.diaries.create({
      plantId,
      entryDate: '2026-01-01',
      condition: 'good',
    })
    await context.repos.plants.delete(plantId)
    expect(await loadRecordIndex(context.repos)).toEqual({
      plants: [],
      records: [],
    })
  })
  it('조회 실패를 빈 결과로 숨기지 않는다', async () => {
    vi.spyOn(context.repos.diaries, 'listByPlant').mockRejectedValue(
      new Error('failed'),
    )
    await expect(loadRecordIndex(context.repos)).rejects.toThrow()
  })
  it('offset이 달라도 instant 순으로 정렬하고 동시각·테이블 ID 충돌을 안정적으로 정렬한다', () => {
    const input = [
      row({ sourceId: 'b', kind: 'grow_light' }),
      row({ sourceId: 'a' }),
      row({
        sourceId: 'a',
        recordType: 'diary',
        kind: 'diary',
        occurredAt: undefined,
        createdAt: '2026-01-04T00:00:00Z',
      }),
      row({ sourceId: 'c', occurredAt: '2026-01-02T06:00:00-08:00' }),
    ]
    const sorted = [...input].sort(compareRecords)
    expect(sorted.map((r) => r.sourceId)).toEqual(['c', 'a', 'b', 'a'])
    expect([...input].reverse().sort(compareRecords)).toEqual(sorted)
  })
  it('같은 날짜 일기는 생성순이며 최종 동률은 타입·종류·ID·식물로 결정된다', () => {
    const a = row({
      recordType: 'diary',
      kind: 'diary',
      occurredAt: undefined,
      createdAt: '2026-01-03T00:00:00Z',
    })
    const b = { ...a, sourceId: 'b', createdAt: '2026-01-04T00:00:00Z' }
    expect([a, b].sort(compareRecords)).toEqual([b, a])
    expect(
      compareRecords(row({ plantId: 'a' }), row({ plantId: 'b' })),
    ).toBeLessThan(0)
    expect(compareRecords(row(), row())).toBe(0)
  })
  it('기기 시간대를 바꾸면 관리 날짜만 변하고 일기 날짜는 유지된다', async () => {
    const previous = process.env.TZ
    try {
      await context.repos.careEvents.create({
        plantId,
        eventType: 'watering',
        occurredAt: '2026-01-02T01:30:00Z',
      })
      await context.repos.diaries.create({
        plantId,
        entryDate: '2026-01-02',
        condition: 'good',
      })
      for (const [zone, expected] of [
        ['Asia/Seoul', '2026-01-02'],
        ['America/Los_Angeles', '2026-01-01'],
      ]) {
        process.env.TZ = zone
        const { records } = await loadRecordIndex(context.repos)
        expect(records.find((r) => r.kind === 'watering')?.date).toBe(expected)
        expect(records.find((r) => r.kind === 'diary')?.date).toBe('2026-01-02')
      }
    } finally {
      if (previous === undefined) delete process.env.TZ
      else process.env.TZ = previous
    }
  })
})
