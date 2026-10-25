import { useRef, useState } from 'react'
import { useRepositories } from '../../app/repository-context'
import { Droplet, MoreHorizontal, Sprout, Sun } from 'lucide-react'
import { Link } from 'react-router'
import type { PlantView } from '../../app/plant-service'
import { statusLabels } from '../../app/plant-service'
import { localDateKey } from '../../domain/calendar'
import { PlantPhoto } from '../plants/PlantPhoto'
import { elapsedDays, shortDate } from '../../lib/dates'

interface PlantCardProps {
  view: PlantView
  today: string
}

export function PlantCard({ view, today }: PlantCardProps) {
  const { repositories, invalidate } = useRepositories()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)
  async function water() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setFeedback('')
    try {
      await repositories.careEvents.create({
        plantId: view.plant.id,
        eventType: 'watering',
        occurredAt: new Date().toISOString(),
      })
      invalidate()
      setFailed(false)
      setFeedback('물주기를 기록했어요.')
    } catch {
      setFailed(true)
      setFeedback('저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const { plant } = view
  const date = view.lastWatered
    ? localDateKey(new Date(view.lastWatered))
    : undefined
  const days = date ? elapsedDays(date, today) : undefined
  return (
    <li className="plant-card surface">
      <span className="plant-more" aria-hidden="true">
        <MoreHorizontal />
      </span>
      <Link
        to={`/plants/${plant.id}`}
        className="plant-photo-link"
        aria-label={`${plant.name} 상세 보기`}
      >
        <PlantPhoto
          blob={view.cover}
          alt={`${plant.name} 화분`}
          className="plant-photo"
          width="160"
          height="180"
        />
      </Link>
      <div className="plant-info min-w-0">
        <Link to={`/plants/${plant.id}`} className="plant-name-link">
          <h3 className="plant-name">{plant.name}</h3>
        </Link>
        <p className="scientific-name" lang="la">
          {plant.species || '학명 미등록'}
        </p>
        <span className="plant-status">
          <Sprout aria-hidden="true" />
          {statusLabels[plant.status]}
        </span>
        <p className="plant-light">
          <Sun aria-hidden="true" />
          <span>
            <span className="light-label">식물등 </span>
            {view.lightMinutes === undefined
              ? '기록 없음'
              : `${view.lightMinutes}분`}
          </span>
        </p>
      </div>
      <div className="watering-area">
        <div className="watering-date">
          <p className="watering-label">
            <span>마지막 물주기</span>
          </p>
          {date ? (
            <>
              <time dateTime={date}>{shortDate(date)}</time>
              <span className="elapsed-days">
                {days === 0 ? '오늘' : `${days}일 전`}
              </span>
            </>
          ) : (
            <span className="no-care-record">기록 없음</span>
          )}
        </div>
        <div>
          <button
            type="button"
            className="water-button"
            disabled={busy}
            aria-busy={busy}
            onClick={water}
            aria-label={`${plant.name} 물주기`}
          >
            <Droplet aria-hidden="true" />
            <span>{busy ? '기록 중…' : '물주기'}</span>
          </button>
        </div>
      </div>
      {feedback && (
        <p
          className={`water-feedback ${failed ? 'is-error' : ''}`}
          role={failed ? 'alert' : 'status'}
        >
          {feedback}
        </p>
      )}
    </li>
  )
}
