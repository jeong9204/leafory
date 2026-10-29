// @vitest-environment node
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaforyDatabase } from './database'
import { createLocalRepositories } from './repositories'
import {
  TIMER_KEY,
  TIMER_RECORD_MEMO,
  timerDuration,
  timerElapsedMs,
} from '../../domain/light-timer'
import { localDateKey } from '../../domain/calendar'
import {
  exportBackup,
  prepareBackup,
  restoreBackup,
} from '../../app/backup-service'

let db: LeaforyDatabase
let repos: ReturnType<typeof createLocalRepositories>
let plantId: string
const initial = new Date('2026-10-27T00:00:00Z').getTime()
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(initial)
  db = new LeaforyDatabase(`light-timer-${crypto.randomUUID()}`)
  repos = createLocalRepositories(db)
  plantId = (
    await repos.plants.create({ name: '타이머 식물', status: 'healthy' })
  ).id
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
  vi.useRealTimers()
})
async function paused(ms = 120000) {
  const started = await repos.lightTimer.start(plantId)
  vi.setSystemTime(Date.now() + ms)
  return repos.lightTimer.pause(started.sessionId, started.revision)
}

describe('식물등 타이머 저장과 원자적 완료', () => {
  it('시작 상태만 저장하고 종료 전 통계에는 포함하지 않는다', async () => {
    const timer = await repos.lightTimer.start(plantId)
    expect(await repos.lightTimer.get()).toEqual(timer)
    expect(timer).toMatchObject({
      id: TIMER_KEY,
      plantId,
      status: 'running',
      accumulatedMs: 0,
      revision: 1,
    })
    vi.setSystemTime(initial + 3600000)
    expect(timerElapsedMs((await repos.lightTimer.get())!)).toBe(3600000)
    expect(await repos.queries.totalRecordCount(plantId)).toBe(0)
    expect(await repos.queries.growLightMinutes(plantId, localDateKey())).toBe(
      0,
    )
  })
  it('일시정지 시간을 제외하고 재개한 구간만 누적해 정수 분으로 완료한다', async () => {
    const stopped = await paused(90345)
    vi.setSystemTime(initial + 3600000)
    expect(timerElapsedMs((await repos.lightTimer.get())!)).toBe(90345)
    const resumed = await repos.lightTimer.resume(
      stopped.sessionId,
      stopped.revision,
    )
    vi.setSystemTime(Date.now() + 31555)
    const ended = await repos.lightTimer.pause(
      resumed.sessionId,
      resumed.revision,
    )
    const event = await repos.lightTimer.finish(ended.sessionId, ended.revision)
    expect(event.durationMinutes).toBe(2)
    expect(event.memo).toContain('실제 누적 00:02:01')
    expect(event.occurredAt).toBe(ended.updatedAt)
    expect(await repos.lightTimer.get()).toBeUndefined()
  })
  it.each(['running', 'paused'] as const)(
    'DB를 닫고 다시 열어 %s 상태를 복구한다',
    async (status) => {
      let state = await repos.lightTimer.start(plantId)
      vi.setSystemTime(initial + 120000)
      if (status === 'paused')
        state = await repos.lightTimer.pause(state.sessionId, state.revision)
      const name = db.name
      db.close()
      db = new LeaforyDatabase(name)
      repos = createLocalRepositories(db)
      vi.setSystemTime(initial + 3600000)
      const restored = (await repos.lightTimer.get())!
      expect(restored.sessionId).toBe(state.sessionId)
      expect(restored.status).toBe(status)
      expect(timerElapsedMs(restored)).toBe(
        status === 'running' ? 3600000 : 120000,
      )
    },
  )
  it.each([
    new Date(2026, 9, 27, 23, 59, 30),
    new Date(2026, 11, 31, 23, 59, 30),
  ])(
    '자정·연도 경계 %s에서도 누적을 유지하고 종료 날짜에 기록한다',
    async (start) => {
      vi.setSystemTime(start)
      const timer = await repos.lightTimer.start(plantId)
      vi.setSystemTime(start.getTime() + 120000)
      const stopped = await repos.lightTimer.pause(
        timer.sessionId,
        timer.revision,
      )
      const event = await repos.lightTimer.finish(
        stopped.sessionId,
        stopped.revision,
      )
      expect(event.durationMinutes).toBe(2)
      expect(
        await repos.queries.growLightMinutes(plantId, localDateKey(start)),
      ).toBe(0)
      expect(
        await repos.queries.growLightMinutes(plantId, localDateKey()),
      ).toBe(2)
    },
  )
  it('다른 식물·다른 Repository의 동시 시작도 하나만 허용한다', async () => {
    const other = (
      await repos.plants.create({ name: '두 번째', status: 'healthy' })
    ).id
    const another = createLocalRepositories(db)
    const results = await Promise.allSettled([
      repos.lightTimer.start(plantId),
      another.lightTimer.start(other),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'CONFLICT' },
    })
    expect(await db.timerState.count()).toBe(1)
  })
  it('다른 화면의 오래된 상태로 일시정지하거나 재개할 수 없다', async () => {
    const running = await repos.lightTimer.start(plantId)
    const stopped = await repos.lightTimer.pause(
      running.sessionId,
      running.revision,
    )
    const resumed = await repos.lightTimer.resume(
      stopped.sessionId,
      stopped.revision,
    )
    await expect(
      repos.lightTimer.pause(running.sessionId, running.revision),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await repos.lightTimer.get()).toEqual(resumed)
  })
  it('동시·재실행 종료가 같은 완료 기록 하나만 반환한다', async () => {
    const timer = await paused()
    const results = await Promise.all([
      repos.lightTimer.finish(timer.sessionId, timer.revision),
      createLocalRepositories(db).lightTimer.finish(
        timer.sessionId,
        timer.revision,
      ),
    ])
    expect(results[0].id).toBe(results[1].id)
    expect(await db.careEvents.count()).toBe(1)
    expect(
      await createLocalRepositories(db).lightTimer.finish(
        timer.sessionId,
        timer.revision,
      ),
    ).toEqual(results[0])
    const next = await repos.lightTimer.start(plantId)
    await repos.lightTimer.finish(timer.sessionId, timer.revision)
    expect((await repos.lightTimer.get())?.sessionId).toBe(next.sessionId)
  })
  it('실행 중 종료를 거절하고 1분 미만은 확인 후 기록 없이 취소한다', async () => {
    const running = await repos.lightTimer.start(plantId)
    await expect(
      repos.lightTimer.finish(running.sessionId, running.revision),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    vi.setSystemTime(initial + 59999)
    const stopped = await repos.lightTimer.pause(
      running.sessionId,
      running.revision,
    )
    await expect(
      repos.lightTimer.finish(stopped.sessionId, stopped.revision),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await repos.lightTimer.get()).toEqual(stopped)
    await repos.lightTimer.discard(stopped.sessionId, stopped.revision)
    await repos.lightTimer.discard(stopped.sessionId, stopped.revision)
    expect(await db.careEvents.count()).toBe(0)
  })
  it('시작 저장 실패 후 타이머가 남지 않고 재시도할 수 있다', async () => {
    vi.spyOn(db.timerState, 'add').mockRejectedValueOnce(new Error('quota'))
    await expect(repos.lightTimer.start(plantId)).rejects.toMatchObject({
      code: 'STORAGE',
    })
    expect(await repos.lightTimer.get()).toBeUndefined()
    await expect(repos.lightTimer.start(plantId)).resolves.toMatchObject({
      status: 'running',
    })
  })
  it('일시정지 실패 시 실행 상태를 유지하고 재시도에 전체 시간을 복구한다', async () => {
    const running = await repos.lightTimer.start(plantId)
    vi.setSystemTime(initial + 90000)
    vi.spyOn(db.timerState, 'put').mockRejectedValueOnce(new Error('failed'))
    await expect(
      repos.lightTimer.pause(running.sessionId, running.revision),
    ).rejects.toMatchObject({ code: 'STORAGE' })
    expect(await repos.lightTimer.get()).toEqual(running)
    vi.setSystemTime(initial + 180000)
    expect(
      (await repos.lightTimer.pause(running.sessionId, running.revision))
        .accumulatedMs,
    ).toBe(180000)
  })
  it.each(['event', 'timer'] as const)(
    '완료 중 %s 쓰기 실패는 기록과 타이머 상태를 모두 롤백한다',
    async (target) => {
      const stopped = await paused()
      if (target === 'event')
        vi.spyOn(db.careEvents, 'add').mockRejectedValueOnce(
          new Error('failed'),
        )
      else
        vi.spyOn(db.timerState, 'delete').mockRejectedValueOnce(
          new Error('failed'),
        )
      await expect(
        repos.lightTimer.finish(stopped.sessionId, stopped.revision),
      ).rejects.toMatchObject({ code: 'STORAGE' })
      expect(await db.careEvents.count()).toBe(0)
      expect(await repos.lightTimer.get()).toEqual(stopped)
      await repos.lightTimer.finish(stopped.sessionId, stopped.revision)
      expect(await db.careEvents.count()).toBe(1)
      expect(await repos.lightTimer.get()).toBeUndefined()
    },
  )
  it('관련 식물 삭제는 막고 다른 식물 삭제는 허용하며 취소 후 정상 삭제한다', async () => {
    const other = (
      await repos.plants.create({ name: '다른 식물', status: 'healthy' })
    ).id
    const stopped = await paused()
    await expect(repos.plants.delete(plantId)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(await repos.plants.getById(plantId)).toBeDefined()
    await repos.plants.delete(other)
    expect(await repos.lightTimer.get()).toEqual(stopped)
    await repos.lightTimer.discard(stopped.sessionId, stopped.revision)
    await repos.plants.delete(plantId)
    expect(await repos.plants.getById(plantId)).toBeUndefined()
  })
  it('기기 시각 역행을 거절하지만 기록 없는 취소는 허용한다', async () => {
    const timer = await repos.lightTimer.start(plantId)
    vi.setSystemTime(initial - 1000)
    await expect(
      repos.lightTimer.pause(timer.sessionId, timer.revision),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(timerElapsedMs(timer)).toBe(0)
    await repos.lightTimer.discard(timer.sessionId, timer.revision)
  })
  it('수동 기록은 변경하지 않고 완료된 타이머 기록만 합산한다', async () => {
    const manual = await repos.careEvents.create({
      plantId,
      eventType: 'grow_light',
      durationMinutes: 30,
      occurredAt: new Date().toISOString(),
      memo: '수동 입력',
    })
    const timer = await paused(125000)
    await repos.lightTimer.finish(timer.sessionId, timer.revision)
    expect(await repos.careEvents.getById(manual.id)).toEqual(manual)
    expect(await repos.queries.growLightMinutes(plantId, localDateKey())).toBe(
      32,
    )
    expect(timerDuration(125000)).toBe('00:02:05')
  })
  it('기존 ZIP v1과 호환되고 실행 상태는 제외하며 타이머가 있으면 복원을 막는다', async () => {
    const old = await prepareBackup((await exportBackup(repos)).blob)
    const timer = await paused()
    expect(
      Object.keys(
        (await prepareBackup((await exportBackup(repos)).blob)).data,
      ).sort(),
    ).toEqual(['careEvents', 'diaries', 'photos', 'plants'])
    await expect(restoreBackup(repos, old)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(await repos.lightTimer.get()).toEqual(timer)
    await repos.lightTimer.finish(timer.sessionId, timer.revision)
    const latest = await prepareBackup((await exportBackup(repos)).blob)
    expect(latest.data.careEvents[0].memo).toContain(TIMER_RECORD_MEMO)
    await restoreBackup(repos, old)
    expect(await db.careEvents.count()).toBe(0)
    await restoreBackup(repos, latest)
    expect(await db.careEvents.count()).toBe(1)
    expect(await repos.lightTimer.get()).toBeUndefined()
  })
  it('v1 DB의 식물·사진·시각을 보존하며 v2 테이블만 추가한다', async () => {
    const name = `timer-upgrade-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      plants: 'id, createdAt',
      diaries: 'id, plantId, [plantId+entryDate]',
      photos: 'id, plantId, entryId, [plantId+sortOrder]',
      careEvents: 'id, plantId, [plantId+occurredAt], [plantId+eventType]',
    })
    const plant = (await repos.plants.getById(plantId))!
    const photo = {
      id: crypto.randomUUID(),
      plantId,
      blob: new Blob(['original blob'], { type: 'image/png' }),
      mimeType: 'image/png',
      sortOrder: 0,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    await legacy.table('plants').add(plant)
    await legacy.table('photos').add(photo)
    const diary = await repos.diaries.create({
      plantId,
      entryDate: localDateKey(),
      condition: 'good',
      content: '기존 관찰 기록',
    })
    const care = await repos.careEvents.create({
      plantId,
      eventType: 'grow_light',
      occurredAt: new Date().toISOString(),
      durationMinutes: 30,
    })
    await legacy.table('diaries').add(diary)
    await legacy.table('careEvents').add(care)
    legacy.close()
    const upgraded = new LeaforyDatabase(name)
    try {
      const restored = createLocalRepositories(upgraded)
      expect(await restored.plants.getById(plantId)).toEqual(plant)
      expect(await restored.diaries.getById(diary.id)).toEqual(diary)
      expect(await restored.careEvents.getById(care.id)).toEqual(care)
      expect(await (await restored.photos.getById(photo.id))!.blob.text()).toBe(
        'original blob',
      )
      expect(upgraded.verno).toBe(2)
      expect(await restored.lightTimer.get()).toBeUndefined()
    } finally {
      await upgraded.delete()
    }
  })
  it('일시정지한 다음 날 종료 확인을 해도 실제 측정 종료 날짜를 유지한다', async () => {
    const time = new Date(2026, 9, 27, 23, 55).getTime()
    vi.setSystemTime(time)
    const timer = await paused(120000)
    vi.setSystemTime(time + 86400000)
    const event = await repos.lightTimer.finish(timer.sessionId, timer.revision)
    expect(event.occurredAt).toBe(timer.updatedAt)
    expect(
      await repos.queries.growLightMinutes(
        plantId,
        localDateKey(new Date(time)),
      ),
    ).toBe(2)
    expect(await repos.queries.growLightMinutes(plantId, localDateKey())).toBe(
      0,
    )
  })
  it('재개 저장 실패 후 정지 시간을 더하지 않고 다시 재개한다', async () => {
    const timer = await paused(120000)
    vi.setSystemTime(initial + 3600000)
    vi.spyOn(db.timerState, 'put').mockRejectedValueOnce(new Error('quota'))
    await expect(
      repos.lightTimer.resume(timer.sessionId, timer.revision),
    ).rejects.toMatchObject({ code: 'STORAGE' })
    expect(await repos.lightTimer.get()).toEqual(timer)
    const resumed = await repos.lightTimer.resume(
      timer.sessionId,
      timer.revision,
    )
    vi.setSystemTime(initial + 3660000)
    expect(timerElapsedMs(resumed)).toBe(180000)
  })
})
