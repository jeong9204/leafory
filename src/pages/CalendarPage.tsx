import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronRight, Leaf } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import {
  calendarKinds,
  calendarLabels,
  loadCalendar,
} from '../app/calendar-service'
import { localDateKey } from '../domain/calendar'
import { calendarDate } from '../domain/month-calendar'
import { fullDate } from '../lib/dates'
import { DataFeedback } from '../components/plants/DataFeedback'
import { MonthCalendar } from '../components/calendar/MonthCalendar'
import './calendar.css'

export function CalendarPage() {
  const { repositories } = useRepositories()
  const query = useCallback(() => loadCalendar(repositories), [repositories])
  const { result, reload } = useRepositoryQuery(query)
  const [params, setParams] = useSearchParams()
  const [today, setToday] = useState(localDateKey)
  useEffect(() => {
    const refresh = () => setToday(localDateKey())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const selected = calendarDate(params.get('date'), today)
  function selectDate(date: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('date', date)
        return next
      },
      { replace: true },
    )
  }
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') return <DataFeedback error retry={reload} />
  const { plants, records } = result.data
  const plantId = plants.some((p) => p.id === params.get('plant'))
    ? params.get('plant')!
    : ''
  const filtered = records.filter(
    (record) => !plantId || record.plantId === plantId,
  )
  const daily = filtered.filter((record) => record.date === selected)
  const monthlyCount = filtered.filter((record) =>
    record.date.startsWith(selected.slice(0, 7)),
  ).length
  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <div>
          <p>초록과 함께한 날들</p>
          <h1>
            <CalendarDays aria-hidden="true" />
            관리 캘린더
          </h1>
        </div>
        <button
          className="calendar-today"
          type="button"
          onClick={() => selectDate(today)}
        >
          오늘
        </button>
      </header>
      <div className="calendar-filter">
        <label htmlFor="calendar-plant">함께하는 식물</label>
        <select
          id="calendar-plant"
          value={plantId}
          onChange={(event) => {
            const next = new URLSearchParams(params)
            if (event.target.value) next.set('plant', event.target.value)
            else next.delete('plant')
            setParams(next, { replace: true })
          }}
        >
          <option value="">전체 식물</option>
          {plants.map((plant) => (
            <option value={plant.id} key={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
      </div>
      <MonthCalendar
        selected={selected}
        today={today}
        records={filtered}
        onSelect={selectDate}
      />
      <ul className="calendar-legend" aria-label="기록 유형 범례">
        {calendarKinds.map((kind) => (
          <li key={kind}>
            <span className={`calendar-dot ${kind}`} aria-hidden="true" />
            {calendarLabels[kind]}
          </li>
        ))}
      </ul>
      <p className="calendar-month-count">
        이달의 기록 <strong>{monthlyCount}개</strong>
      </p>
      <section
        className="calendar-records"
        aria-labelledby="calendar-records-title"
      >
        <div className="calendar-records-heading">
          <h2 id="calendar-records-title">
            <time dateTime={selected}>{fullDate(selected)}</time>
          </h2>
          <span role="status">{daily.length}개 기록</span>
        </div>
        {daily.length ? (
          <ul aria-label="선택 날짜의 기록">
            {daily.map((record) => (
              <li key={`${record.kind}:${record.id}`}>
                <Link className="calendar-record surface" to={record.href}>
                  <span
                    className={`calendar-dot ${record.kind}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="calendar-record-meta">
                      {record.plantName} · {calendarLabels[record.kind]}
                      {record.occurredAt && (
                        <>
                          {' '}
                          ·{' '}
                          <time dateTime={record.occurredAt}>
                            {new Date(record.occurredAt).toLocaleTimeString(
                              'ko-KR',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              },
                            )}
                          </time>
                        </>
                      )}
                    </p>
                    <h3>{record.title}</h3>
                    {record.durationMinutes !== undefined && (
                      <p>
                        사용 시간 {Math.floor(record.durationMinutes / 60)}시간{' '}
                        {record.durationMinutes % 60}분
                      </p>
                    )}
                    {record.memo && (
                      <p className="calendar-record-memo">{record.memo}</p>
                    )}
                  </div>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="calendar-empty surface">
            <Leaf aria-hidden="true" />
            <h3>이날은 아직 기록이 없어요</h3>
            <p>식물과 함께한 하루를 차곡차곡 남겨 보세요.</p>
            {!plants.length && <Link to="/plants/new">첫 식물 등록</Link>}
          </div>
        )}
      </section>
    </div>
  )
}
