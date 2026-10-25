import { describe, expect, it } from 'vitest'
import {
  daysBefore,
  elapsedDays,
  fullDate,
  isThisWeek,
  todayKey,
} from './dates'

describe('한국 시간의 달력 날짜 계산', () => {
  it('UTC 날짜와 다른 한국 시간 자정을 반영한다', () => {
    expect(todayKey(new Date('2026-10-23T15:00:00Z'))).toBe('2026-10-24')
    expect(todayKey(new Date('2026-10-23T14:59:59Z'))).toBe('2026-10-23')
  })
  it.each([
    ['2026-10-21', '2026-10-24', 3],
    ['2026-10-18', '2026-10-24', 6],
    ['2026-10-12', '2026-10-24', 12],
    ['2026-10-24', '2026-10-24', 0],
    ['2026-10-25', '2026-10-24', 0],
    ['2024-02-28', '2024-03-01', 2],
    ['2025-12-31', '2026-01-01', 1],
  ])('%s에서 %s까지 %i일로 계산한다', (date, today, expected) => {
    expect(elapsedDays(date, today)).toBe(expected)
  })
  it('요일을 실제 달력 기준으로 표시한다', () => {
    expect(fullDate('2026-10-24')).toBe('10월 24일 (토)')
  })
  it('연도 경계를 넘어 이전 날짜를 계산한다', () => {
    expect(daysBefore('2026-01-01', 1)).toBe('2025-12-31')
  })
  it('월요일부터 오늘까지를 이번 주로 집계한다', () => {
    expect(isThisWeek('2026-10-19', '2026-10-24')).toBe(true)
    expect(isThisWeek('2026-10-18', '2026-10-24')).toBe(false)
    expect(isThisWeek('2026-10-25', '2026-10-24')).toBe(false)
    expect(isThisWeek('2026-10-25', '2026-10-26')).toBe(false)
    expect(isThisWeek('2025-12-29', '2026-01-01')).toBe(true)
  })
})
