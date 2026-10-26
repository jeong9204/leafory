import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  calendarMonthCells,
  calendarMonthLabel,
  calendarWeekday,
  shiftCalendarDay,
  shiftCalendarMonth,
} from '../../domain/month-calendar'
import { calendarKinds, calendarLabels } from '../../app/calendar-service'
import type { CalendarRecord } from '../../app/calendar-service'
const weekdays = ['일', '월', '화', '수', '목', '금', '토']

export function MonthCalendar({
  selected,
  today,
  records,
  onSelect,
}: {
  selected: string
  today: string
  records: CalendarRecord[]
  onSelect: (date: string) => void
}) {
  const root = useRef<HTMLTableElement>(null)
  const focusPending = useRef(false)
  useEffect(() => {
    if (focusPending.current) {
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)
        ?.focus()
      focusPending.current = false
    }
  }, [selected])
  const cells = calendarMonthCells(selected)
  const byDate = new Map<string, CalendarRecord[]>()
  for (const record of records)
    byDate.set(record.date, [...(byDate.get(record.date) ?? []), record])
  return (
    <section className="month-calendar surface" aria-label="월별 기록 캘린더">
      <div className="calendar-month-controls">
        <button
          type="button"
          aria-label="이전 달"
          disabled={selected.startsWith('0001-01')}
          onClick={() => onSelect(shiftCalendarMonth(selected, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h2 aria-live="polite">{calendarMonthLabel(selected)}</h2>
        <button
          type="button"
          aria-label="다음 달"
          disabled={selected.startsWith('9999-12')}
          onClick={() => onSelect(shiftCalendarMonth(selected, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <table ref={root} className="calendar-grid">
        <caption className="sr-only">
          {calendarMonthLabel(selected)} 기록. 방향키로 날짜, Page Up/Down으로
          월을 이동할 수 있습니다.
        </caption>
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th scope="col" key={day} aria-label={`${day}요일`}>
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, week) => (
            <tr key={week}>
              {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
                if (!date) return <td key={`empty-${index}`} />
                const dayRecords = byDate.get(date) ?? []
                const kinds = calendarKinds.filter((kind) =>
                  dayRecords.some((r) => r.kind === kind),
                )
                const description = kinds.length
                  ? kinds
                      .map(
                        (kind) =>
                          `${calendarLabels[kind]} ${dayRecords.filter((r) => r.kind === kind).length}건`,
                      )
                      .join(', ')
                  : '기록 없음'
                return (
                  <td key={date}>
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === selected ? 0 : -1}
                      aria-label={`${Number(date.slice(0, 4))}년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 ${weekdays[calendarWeekday(date)]}요일, ${description}`}
                      aria-pressed={date === selected}
                      aria-current={date === today ? 'date' : undefined}
                      onClick={() => onSelect(date)}
                      onKeyDown={(event) => {
                        const offsets: Record<string, number> = {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -7,
                          ArrowDown: 7,
                          Home: -calendarWeekday(date),
                          End: 6 - calendarWeekday(date),
                        }
                        const next =
                          event.key === 'PageUp'
                            ? shiftCalendarMonth(date, -1)
                            : event.key === 'PageDown'
                              ? shiftCalendarMonth(date, 1)
                              : event.key in offsets
                                ? shiftCalendarDay(date, offsets[event.key])
                                : null
                        if (next && next !== date) {
                          event.preventDefault()
                          focusPending.current = true
                          onSelect(next)
                        }
                      }}
                    >
                      <span className="calendar-day-number">
                        {Number(date.slice(8))}
                      </span>
                      <span className="calendar-day-dots" aria-hidden="true">
                        {kinds.map((kind) => (
                          <span key={kind} className={`calendar-dot ${kind}`} />
                        ))}
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
