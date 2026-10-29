import type { GrowLightTimer } from './models'
import { invalid, validateInstant, validateUuid } from './validation'

export const TIMER_KEY = 'grow-light' as const
export const TIMER_RECORD_MEMO = '식물등 타이머 자동 기록'

export function timerElapsedMs(timer: GrowLightTimer, now = Date.now()) {
  const elapsed =
    timer.accumulatedMs +
    (timer.status === 'running'
      ? Math.max(0, now - Date.parse(timer.runningSince!))
      : 0)
  if (!Number.isSafeInteger(elapsed) || elapsed < 0)
    invalid('타이머 시간을 계산할 수 없습니다.')
  return elapsed
}
export function timerDuration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}
export function validateTimer(timer: GrowLightTimer) {
  if (timer.id !== TIMER_KEY || !['running', 'paused'].includes(timer.status))
    invalid('타이머 상태가 올바르지 않습니다.')
  validateUuid(timer.sessionId, 'sessionId')
  validateUuid(timer.plantId, 'plantId')
  validateInstant(timer.startedAt, 'startedAt')
  validateInstant(timer.updatedAt, 'updatedAt')
  if (
    !Number.isSafeInteger(timer.revision) ||
    timer.revision < 1 ||
    !Number.isSafeInteger(timer.accumulatedMs) ||
    timer.accumulatedMs < 0
  )
    invalid('타이머 누적 시간 또는 버전이 올바르지 않습니다.')
  if (Date.parse(timer.updatedAt) < Date.parse(timer.startedAt))
    invalid('타이머 시각이 올바르지 않습니다.')
  if (timer.status === 'running') {
    validateInstant(timer.runningSince, 'runningSince')
    if (timer.runningSince !== timer.updatedAt)
      invalid('실행 구간 시각이 올바르지 않습니다.')
  } else if (timer.runningSince !== undefined)
    invalid('일시정지 상태에 실행 시각이 남아 있습니다.')
}
