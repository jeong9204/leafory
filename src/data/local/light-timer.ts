import type { LeaforyDatabase } from './database'
import type { Repositories } from '../../domain/repositories'
import type {
  CareEvent,
  CreateInput,
  GrowLightTimer,
} from '../../domain/models'
import { RepositoryError } from '../../domain/errors'
import { invalid, validateUuid } from '../../domain/validation'
import {
  TIMER_KEY,
  TIMER_RECORD_MEMO,
  timerDuration,
  timerElapsedMs,
  validateTimer,
} from '../../domain/light-timer'

type Transaction = <T>(work: () => Promise<T>) => Promise<T>

export function createLightTimerRepository(
  db: LeaforyDatabase,
  read: Transaction,
  write: Transaction,
  createEvent: (input: CreateInput<CareEvent>) => Promise<CareEvent>,
): Repositories['lightTimer'] {
  async function get() {
    const timer = await db.timerState.get(TIMER_KEY)
    if (timer) validateTimer(timer)
    return timer
  }
  async function current(sessionId: string, revision: number) {
    validateUuid(sessionId, 'sessionId')
    const timer = await get()
    if (!timer || timer.sessionId !== sessionId || timer.revision !== revision)
      throw new RepositoryError(
        'CONFLICT',
        '다른 화면에서 타이머가 변경됐어요. 최신 상태를 확인해 주세요.',
      )
    return timer
  }
  function nowFor(timer: GrowLightTimer) {
    const now = new Date()
    if (now.getTime() < Date.parse(timer.updatedAt))
      invalid(
        '기기 시각이 이전으로 바뀌었어요. 시각을 확인하거나 타이머를 취소해 주세요.',
      )
    return now
  }
  return {
    get: () => read(get),
    start: (plantId) =>
      write(async () => {
        validateUuid(plantId, 'plantId')
        if (!(await db.plants.get(plantId)))
          throw new RepositoryError('NOT_FOUND', '식물을 찾을 수 없습니다.')
        if (await get())
          throw new RepositoryError(
            'CONFLICT',
            '이미 측정 중인 식물등 타이머가 있어요. 기존 타이머를 먼저 종료해 주세요.',
          )
        const now = new Date().toISOString()
        const timer: GrowLightTimer = {
          id: TIMER_KEY,
          sessionId: crypto.randomUUID(),
          plantId,
          startedAt: now,
          status: 'running',
          runningSince: now,
          accumulatedMs: 0,
          revision: 1,
          updatedAt: now,
        }
        validateTimer(timer)
        await db.timerState.add(timer)
        return timer
      }),
    pause: (sessionId, revision) =>
      write(async () => {
        const timer = await current(sessionId, revision)
        if (timer.status === 'paused') return timer
        const now = nowFor(timer)
        const paused: GrowLightTimer = {
          ...timer,
          status: 'paused',
          runningSince: undefined,
          accumulatedMs: timerElapsedMs(timer, now.getTime()),
          updatedAt: now.toISOString(),
          revision: timer.revision + 1,
        }
        validateTimer(paused)
        await db.timerState.put(paused)
        return paused
      }),
    resume: (sessionId, revision) =>
      write(async () => {
        const timer = await current(sessionId, revision)
        if (timer.status === 'running') return timer
        const now = nowFor(timer).toISOString()
        const resumed: GrowLightTimer = {
          ...timer,
          status: 'running',
          runningSince: now,
          updatedAt: now,
          revision: timer.revision + 1,
        }
        validateTimer(resumed)
        await db.timerState.put(resumed)
        return resumed
      }),
    finish: (sessionId, revision) =>
      write(async () => {
        validateUuid(sessionId, 'sessionId')
        const existing = await db.careEvents.get(sessionId)
        if (existing) {
          if (
            existing.eventType !== 'grow_light' ||
            !existing.memo?.startsWith(TIMER_RECORD_MEMO)
          )
            throw new RepositoryError(
              'CONFLICT',
              '동일한 ID의 다른 기록이 있습니다.',
            )
          return existing
        }
        const timer = await current(sessionId, revision)
        if (timer.status !== 'paused')
          invalid('종료 전 타이머를 일시정지해 주세요.')
        const durationMinutes = Math.floor(timer.accumulatedMs / 60000)
        if (durationMinutes < 1)
          invalid('1분 이상 측정한 뒤 기록하거나 기록 없이 종료해 주세요.')
        const event = await createEvent({
          id: sessionId,
          plantId: timer.plantId,
          eventType: 'grow_light',
          occurredAt: timer.updatedAt,
          durationMinutes,
          memo: `${TIMER_RECORD_MEMO}\n실제 누적 ${timerDuration(timer.accumulatedMs)}\n시작 ${timer.startedAt}\n측정 종료 ${timer.updatedAt}`,
        })
        await db.timerState.delete(TIMER_KEY)
        return event
      }),
    discard: (sessionId, revision) =>
      write(async () => {
        validateUuid(sessionId, 'sessionId')
        if (!(await get())) return
        await current(sessionId, revision)
        await db.timerState.delete(TIMER_KEY)
      }),
  }
}
