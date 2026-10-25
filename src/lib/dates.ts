const DAY_MS = 86_400_000
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Calendar dates in the app use Korea time, independent of the device timezone. */
export function todayKey(now = new Date()): string {
  const parts = dateParts.formatToParts(now)
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

export function elapsedDays(date: string, today = todayKey()): number {
  return Math.max(0, dayNumber(today) - dayNumber(date))
}

export function daysBefore(date: string, days: number): string {
  return new Date((dayNumber(date) - days) * DAY_MS).toISOString().slice(0, 10)
}

export function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number)
  return `${month}월 ${day}일`
}

export function fullDate(date: string): string {
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
  return `${shortDate(date)} (${weekday})`
}

export function isThisWeek(date: string, today: string): boolean {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  const monday = dayNumber(today) - ((weekday + 6) % 7)
  return dayNumber(date) >= monday && dayNumber(date) <= dayNumber(today)
}
