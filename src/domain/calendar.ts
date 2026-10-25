import type { LocalDate } from './models'

/** Device/user local calendar date, deliberately separate from UTC storage instants. */
export function localDateKey(date = new Date()): LocalDate {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function calendarDaysBetween(from: LocalDate, to: LocalDate): number {
  const day = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    const result = new Date(0)
    result.setUTCFullYear(year, month - 1, day)
    result.setUTCHours(0, 0, 0, 0)
    return result.getTime() / 86_400_000
  }
  return day(to) - day(from)
}
