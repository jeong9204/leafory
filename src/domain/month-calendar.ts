import type { LocalDate } from './models'
import { validateDate } from './validation'

// UTC is used only for arithmetic on date-only values, never for event grouping.
function civil(date: LocalDate) {
  return new Date(`${date}T12:00:00Z`)
}
function key(date: Date) {
  return date.toISOString().slice(0, 10)
}
export function calendarDate(
  value: string | null,
  fallback: LocalDate,
): LocalDate {
  try {
    validateDate(value)
    if (Number(value.slice(0, 4)) < 1) return fallback
    return value
  } catch {
    return fallback
  }
}
export function shiftCalendarMonth(date: LocalDate, offset: number): LocalDate {
  const value = civil(date)
  const day = value.getUTCDate()
  value.setUTCDate(1)
  value.setUTCMonth(value.getUTCMonth() + offset)
  if (value.getUTCFullYear() < 1 || value.getUTCFullYear() > 9999) return date
  const last = new Date(value)
  last.setUTCMonth(last.getUTCMonth() + 1)
  last.setUTCDate(0)
  value.setUTCDate(Math.min(day, last.getUTCDate()))
  return key(value)
}
export function shiftCalendarDay(date: LocalDate, days: number): LocalDate {
  const value = civil(date)
  value.setUTCDate(value.getUTCDate() + days)
  return value.getUTCFullYear() < 1 || value.getUTCFullYear() > 9999
    ? date
    : key(value)
}
export function calendarWeekday(date: LocalDate) {
  return civil(date).getUTCDay()
}
export function calendarMonthCells(date: LocalDate): (LocalDate | null)[] {
  const first = `${date.slice(0, 7)}-01`
  const next = civil(first)
  next.setUTCMonth(next.getUTCMonth() + 1)
  next.setUTCDate(0)
  const days = next.getUTCDate()
  const offset = calendarWeekday(first)
  return Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1
      return day > 0 && day <= days
        ? `${first.slice(0, 8)}${String(day).padStart(2, '0')}`
        : null
    },
  )
}
export function calendarMonthLabel(date: LocalDate) {
  return `${Number(date.slice(0, 4))}년 ${Number(date.slice(5, 7))}월`
}
