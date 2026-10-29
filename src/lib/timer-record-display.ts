import { TIMER_RECORD_MEMO } from '../domain/light-timer'
import { validateInstant } from '../domain/validation'

export interface TimerRecordDisplay {
  startedAt: string
  endedAt: string
  elapsedSeconds: number
  userMemo: string
}
// Match only the metadata emitted by the timer. Leave all trailing user text intact.
const instant = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})`
const metadata = new RegExp(
  `^${TIMER_RECORD_MEMO}\\s+실제 누적 (\\d{2,}):([0-5]\\d):([0-5]\\d)\\s+시작 (${instant})\\s+측정 종료 (${instant})(?=\\s|$)`,
)
export function parseTimerRecord(memo: string): TimerRecordDisplay | undefined {
  const match = metadata.exec(memo)
  if (!match) return
  const [, hours, minutes, seconds, startedAt, endedAt] = match
  try {
    validateInstant(startedAt, 'startedAt')
    validateInstant(endedAt, 'endedAt')
  } catch {
    return
  }
  const start = Date.parse(startedAt)
  const end = Date.parse(endedAt)
  const elapsedSeconds =
    Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    !Number.isSafeInteger(elapsedSeconds)
  )
    return
  return {
    startedAt,
    endedAt,
    elapsedSeconds,
    userMemo: memo.slice(match[0].length).trim(),
  }
}
export function formatTimerUsage(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const remainder = seconds % 60
  return [
    hours && `${hours}시간`,
    minutes && `${minutes}분`,
    (remainder || (!hours && !minutes)) && `${remainder}초`,
  ]
    .filter(Boolean)
    .join(' ')
}
export function formatTimerRange(
  record: TimerRecordDisplay,
  timeZone?: string,
) {
  const start = new Date(record.startedAt)
  const end = new Date(record.endedAt)
  const dateParts = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => `${part.type}:${part.value}`)
      .join('|')
  const sameDate = dateParts(start) === dateParts(end)
  const sameYear =
    new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(
      start,
    ) ===
    new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(end)
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    ...(!sameDate
      ? {
          ...(sameYear ? {} : { year: 'numeric' as const }),
          month: 'long' as const,
          day: 'numeric' as const,
        }
      : {}),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${formatter.format(start)} ~ ${formatter.format(end)}`
}
