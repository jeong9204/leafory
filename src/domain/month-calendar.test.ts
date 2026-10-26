import { describe, expect, it } from 'vitest'
import {
  calendarDate,
  calendarMonthCells,
  calendarMonthLabel,
  calendarWeekday,
  shiftCalendarDay,
  shiftCalendarMonth,
} from './month-calendar'

describe('월별 캘린더 날짜 연산', () => {
  it.each([
    ['2026-12-31', 1, '2027-01-31'],
    ['2026-01-31', -1, '2025-12-31'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-03-31', -1, '2026-02-28'],
    ['0001-01-01', -1, '0001-01-01'],
    ['9999-12-31', 1, '9999-12-31'],
  ])('%s에서 %i개월 이동해 %s을 선택한다', (date, offset, expected) =>
    expect(shiftCalendarMonth(date, offset)).toBe(expected),
  )
  it('윤년·평년 2월 및 일요일로 시작하는 달을 정확히 구성한다', () => {
    expect(calendarMonthCells('2024-02-10').filter(Boolean)).toHaveLength(29)
    expect(calendarMonthCells('2026-02-10')).toHaveLength(28)
    expect(calendarMonthCells('2026-02-10')[0]).toBe('2026-02-01')
    expect(calendarMonthCells('2026-08-10')).toHaveLength(42)
    expect(calendarMonthCells('2026-08-10').filter(Boolean)).toHaveLength(31)
    expect(calendarMonthCells('2026-12-10').filter(Boolean).at(-1)).toBe(
      '2026-12-31',
    )
  })
  it('일자·주 단위 이동은 연도·월 경계와 윤일을 넘는다', () => {
    expect(shiftCalendarDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftCalendarDay('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftCalendarDay('2026-03-08', 7)).toBe('2026-03-15')
    expect(calendarWeekday('2026-02-01')).toBe(0)
    expect(calendarMonthLabel('2027-01-31')).toBe('2027년 1월')
  })
  it('잘못된 URL 날짜는 로컬 오늘로 대체한다', () => {
    for (const value of [
      null,
      'garbage',
      '2026-02-30',
      '0000-01-01',
      '2026-1-1',
    ])
      expect(calendarDate(value, '2026-10-26')).toBe('2026-10-26')
    expect(calendarDate('2024-02-29', '2026-10-26')).toBe('2024-02-29')
  })
})
