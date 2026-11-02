import {
  NavigationLink as Link,
  BackLink,
} from '../components/navigation/NavigationLink'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import {
  loadRecordIndex,
  filterRecords,
  recordsSelection,
  recordFilters,
} from '../app/records-service'
import { careLabels } from '../app/care-service'
import { localDateKey } from '../domain/calendar'
import { fullDate } from '../lib/dates'
import { plantArt } from '../components/bookshelf/plant-art'
import {
  pixelAsset,
  fallbackPixelAsset,
} from '../components/bookshelf/pixel-assets'
import { DataFeedback } from '../components/plants/DataFeedback'
import type { Repositories } from '../domain/repositories'
import { readRecordPosition, saveRecordPosition } from '../lib/record-position'
import './records.css'

// Per history entry; optional sessionStorage contains only UI position metadata.
const positionStores = new WeakMap<
  Repositories,
  Map<string, { filter: string; count: number; y: number }>
>()
export function RecordsPage() {
  const { repositories } = useRepositories()
  const [positions] = useState(() => {
    const existing = positionStores.get(repositories)
    if (existing) return existing
    const store = new Map<
      string,
      { filter: string; count: number; y: number }
    >()
    positionStores.set(repositories, store)
    return store
  })
  const query = useCallback(() => loadRecordIndex(repositories), [repositories])
  const { result, reload } = useRepositoryQuery(query, true, 'records')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const selection = recordsSelection(
    params,
    result.status === 'success' ? result.data.plants : [],
  )
  const filter = `${selection.type}:${selection.plant}`
  const saved = positions.get(location.key) ?? readRecordPosition(location.key)
  const [page, setPage] = useState(() => ({
    filter: saved?.filter ?? filter,
    count: saved?.count ?? 30,
  }))
  const count = page.filter === filter ? page.count : 30
  const leaving = useRef(false)
  const [today, setToday] = useState(localDateKey)
  useEffect(() => {
    const refresh = () => setToday(localDateKey())
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  useEffect(() => {
    if (result.status !== 'success' || !selection.invalid) return
    const next = new URLSearchParams(params)
    if (selection.type === 'all') next.delete('type')
    if (!selection.plant) next.delete('plant')
    setParams(next, {
      replace: true,
      state: {
        ...location.state,
        recordsNotice:
          '올바르지 않거나 삭제된 필터를 해제했어요. 표시된 조건의 기록을 확인해 주세요.',
      },
    })
  }, [
    result.status,
    selection.invalid,
    selection.type,
    selection.plant,
    params,
    setParams,
    location.state,
  ])
  function rememberPosition(y: number) {
    const position = { filter, count, y }
    positions.set(location.key, position)
    saveRecordPosition(location.key, position)
    if (positions.size > 40) positions.delete(positions.keys().next().value!)
  }
  useEffect(() => {
    if (result.status !== 'success') return
    leaving.current = false
    const previous =
      positions.get(location.key) ?? readRecordPosition(location.key)
    let lastY = previous?.filter === filter ? previous.y : window.scrollY
    let restoring = previous?.filter === filter
    const persist = (y: number) => {
      const position = { filter, count, y }
      positions.set(location.key, position)
      saveRecordPosition(location.key, position)
      if (positions.size > 40) positions.delete(positions.keys().next().value!)
    }
    const frame = restoring
      ? requestAnimationFrame(() => {
          window.scrollTo({ top: lastY, behavior: 'instant' })
          restoring = false
        })
      : undefined
    const remember = () => {
      if (leaving.current || restoring) return
      lastY = window.scrollY
      persist(lastY)
    }
    window.addEventListener('scroll', remember, { passive: true })
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', remember)
      // The destination DOM can already have shortened the page by cleanup time.
      if (!leaving.current) persist(lastY)
    }
  }, [result.status, location.key, filter, count, positions])
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') return <DataFeedback error retry={reload} />
  const { plants, records } = result.data
  const plantMap = new Map(plants.map((p) => [p.id, p]))
  const filtered = filterRecords(records, selection.type, selection.plant)
  const visible = filtered.slice(0, count)
  const groups = new Map<string, typeof visible>()
  for (const record of visible) {
    const group = groups.get(record.date)
    if (group) group.push(record)
    else groups.set(record.date, [record])
  }
  function change(type: string, plant: string) {
    const next = new URLSearchParams(params)
    if (type === 'all') next.delete('type')
    else next.set('type', type)
    if (plant) next.set('plant', plant)
    else next.delete('plant')
    setPage({ filter: `${type}:${plant}`, count: 30 })
    setParams(next, { replace: true, state: location.state })
  }
  return (
    <div className="records-page">
      <header className="records-header">
        <BackLink fallback="/" aria-label="내 정원으로 돌아가기">
          <ChevronLeft aria-hidden="true" />
        </BackLink>
        <div>
          <p className="records-eyebrow">GARDEN NOTES</p>
          <h1>나의 기록</h1>
          <p className="records-subtitle">초록 친구들과 함께한 모든 순간</p>
        </div>
      </header>
      <div className="records-filters" role="group" aria-label="기록 종류">
        {recordFilters.map(([type, label]) => (
          <button
            key={type}
            type="button"
            aria-pressed={selection.type === type}
            onClick={() => change(type, selection.plant)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="records-plant-filter">
        <label htmlFor="records-plant">함께하는 식물</label>
        <select
          id="records-plant"
          value={selection.plant}
          onChange={(e) => change(selection.type, e.target.value)}
        >
          <option value="">전체 식물</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {(selection.type !== 'all' || selection.plant) && (
        <button
          className="records-reset"
          type="button"
          onClick={() => change('all', '')}
        >
          필터 초기화
        </button>
      )}
      {location.state?.recordsNotice && (
        <p className="records-notice" role="status">
          {String(location.state.recordsNotice)}
        </p>
      )}
      <p className="records-count" role="status">
        함께 남긴 순간 <strong>{filtered.length}개</strong> · {visible.length}개
        표시
      </p>
      {filtered.length ? (
        <>
          {[...groups].map(([date, entries]) => (
            <section
              className="record-date-group"
              key={date}
              aria-labelledby={`records-date-${date}`}
            >
              <div className="record-date-heading">
                <h2 id={`records-date-${date}`}>
                  {date.slice(0, 4)}년 {fullDate(date)}
                  {date === today ? ' · 오늘' : ''}
                </h2>
                <span>{entries.length}개 표시</span>
              </div>
              <ul className="record-list">
                {entries.map((record) => {
                  const plant = plantMap.get(record.plantId)!
                  return (
                    <li key={record.key}>
                      <Link
                        className="record-list-item"
                        to={record.href}
                        onClick={(event) => {
                          if (
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          )
                            return
                          rememberPosition(window.scrollY)
                          leaving.current = true
                        }}
                      >
                        <img
                          src={pixelAsset(plantArt(plant))}
                          onError={fallbackPixelAsset}
                          width="44"
                          height="44"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="record-list-content">
                          <span
                            className="record-plant-name"
                            title={plant.name}
                          >
                            {plant.name}
                          </span>
                          <strong className="record-title">
                            {record.title}
                          </strong>
                          <span className="record-meta">
                            {record.kind === 'diary'
                              ? '사진 일기'
                              : careLabels[record.kind]}{' '}
                            ·{' '}
                            <time dateTime={record.occurredAt ?? record.date}>
                              {record.occurredAt
                                ? new Date(
                                    record.occurredAt,
                                  ).toLocaleTimeString('ko-KR', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : fullDate(record.date)}
                            </time>
                          </span>
                          {record.timerUsage && (
                            <span className="record-timer">
                              타이머 · {record.timerUsage}
                            </span>
                          )}
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {visible.length < filtered.length && (
            <button
              type="button"
              className="secondary-button records-more"
              onClick={() => setPage({ filter, count: count + 30 })}
            >
              30개 더 보기
            </button>
          )}
        </>
      ) : (
        <section className="records-empty surface">
          <h2>
            {records.length
              ? '선택한 조건의 기록이 없어요'
              : plants.length
                ? '아직 남긴 기록이 없어요'
                : '첫 초록 친구를 만나 보세요'}
          </h2>
          <p>
            {records.length
              ? '다른 식물이나 기록 종류를 선택해 보세요.'
              : plants.length
                ? '식물 상세에서 첫 물주기나 관찰 일기를 남겨 보세요.'
                : '식물을 등록하면 이곳에 함께한 순간이 모여요.'}
          </p>
          {records.length ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => change('all', '')}
            >
              필터 초기화
            </button>
          ) : (
            <Link
              className="secondary-button"
              to={plants.length ? '/' : '/plants/new'}
            >
              {plants.length ? '내 정원으로' : '식물 등록'}
            </Link>
          )}
        </section>
      )}
    </div>
  )
}
