import { Droplet, Sun } from 'lucide-react'
import { Link } from 'react-router'
import { Fragment, useRef, useState } from 'react'
import type { ShelfPlant } from '../../app/bookshelf-service'
import { useRepositories } from '../../app/repository-context'
import { localDateKey } from '../../domain/calendar'
import { elapsedDays, shortDate } from '../../lib/dates'
import { plantArt } from './plant-art'
import { pixelAsset, pixelDimensions, fallbackPixelAsset } from './pixel-assets'

export function PixelDecoration({
  art,
  className = '',
  loading = 'eager',
}: {
  art: string
  className?: string
  loading?: 'eager' | 'lazy'
}) {
  if (art === 'ivy')
    return (
      <span className={`pixel-art pixel-ivy ${className}`} aria-hidden="true" />
    )
  const [width, height] = pixelDimensions(art)
  return (
    <img
      className={`pixel-art ${className}`}
      src={pixelAsset(art)}
      width={width}
      height={height}
      loading={loading}
      onError={fallbackPixelAsset}
      alt=""
      aria-hidden="true"
      draggable="false"
      decoding="async"
    />
  )
}
function ShelfPlantItem({
  view,
  today,
  priority,
}: {
  view: ShelfPlant
  today: string
  priority: boolean
}) {
  const { plant, lastWatered, lightMinutes } = view
  const { repositories, invalidate } = useRepositories()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)
  const date = lastWatered ? localDateKey(new Date(lastWatered)) : undefined
  const days = date ? elapsedDays(date, today) : undefined
  const art = plantArt(plant)
  async function water() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setFeedback('')
    try {
      await repositories.careEvents.create({
        plantId: plant.id,
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
  return (
    <li className="shelf-plant">
      <Link
        to={`/plants/${plant.id}`}
        className="shelf-plant-link"
        aria-label={`${plant.name} 상세 보기`}
      >
        <span className="shelf-nameplate">
          <span className="shelf-plant-name">{plant.name}</span>
        </span>
        <div className="shelf-care-info">
          {date && (
            <span
              role="img"
              aria-label={`마지막 물주기 ${shortDate(date)}, ${days === 0 ? '오늘' : `${days}일 전`}`}
              title={`마지막 물주기 ${shortDate(date)}`}
            >
              <Droplet aria-hidden="true" />
              <span aria-hidden="true">
                {days === 0 ? '오늘' : `${days}일 전`}
              </span>
            </span>
          )}
          {lightMinutes !== undefined && (
            <span
              role="img"
              aria-label={`오늘 식물등 ${lightMinutes}분 기록 있음`}
              title={`오늘 식물등 ${lightMinutes}분`}
            >
              <Sun aria-hidden="true" />
              <span aria-hidden="true">기록</span>
            </span>
          )}
          {!date && lightMinutes === undefined && (
            <span className="shelf-care-neutral">관리 기록 없음</span>
          )}
        </div>
        <div className="shelf-sprite-stage">
          <img
            src={pixelAsset(art)}
            width="192"
            height="192"
            loading={priority ? 'eager' : 'lazy'}
            onError={fallbackPixelAsset}
            className={`pixel-art plant-sprite art-${art}`}
            alt={`${plant.name} 픽셀 화분`}
            decoding="async"
            draggable="false"
          />
        </div>
      </Link>
      <button
        type="button"
        className="shelf-water-button"
        disabled={busy}
        aria-busy={busy}
        aria-label={`${plant.name} 물주기`}
        title="물주기 기록"
        onClick={water}
      >
        <Droplet aria-hidden="true" />
        <span className="sr-only">{busy ? '기록 중…' : '물주기'}</span>
      </button>
      {feedback && (
        <p className="shelf-feedback" role={failed ? 'alert' : 'status'}>
          {feedback}
        </p>
      )}
    </li>
  )
}
export function Bookshelf({
  views,
  today,
}: {
  views: ShelfPlant[]
  today: string
}) {
  return (
    <div className="garden-bookshelf" data-plant-count={views.length}>
      <div className="shelf-interior">
        <PixelDecoration art="ivy" className="shelf-ivy left" />
        <PixelDecoration art="ivy" className="shelf-ivy right" />
        {views.length ? (
          <ul className="shelf-plants" aria-label="내 식물 목록">
            {views.map((view, index) => (
              <Fragment key={view.plant.id}>
                <ShelfPlantItem
                  view={view}
                  today={today}
                  priority={index < 3}
                />
                <ShelfRowEnd
                  index={index}
                  total={views.length}
                  columns={3}
                  size="wide"
                />
                <ShelfRowEnd
                  index={index}
                  total={views.length}
                  columns={2}
                  size="narrow"
                />
              </Fragment>
            ))}
          </ul>
        ) : (
          <div className="shelf-empty">
            <PixelDecoration art="can" />
            <h3>첫 초록 친구를 만나 보세요</h3>
            <p>
              아직은 비어 있는 작은 책장.
              <br />
              나만의 식물로 한 칸씩 채워 볼까요?
            </p>
            <Link to="/plants/new">
              첫 식물 등록 <span aria-hidden="true">＋</span>
            </Link>
          </div>
        )}
        <div className="shelf-still-life" aria-hidden="true">
          <PixelDecoration art="books" loading="lazy" />
          <PixelDecoration art="globe" loading="lazy" />
          {views.length < 9 && <PixelDecoration art="lantern" loading="lazy" />}
          <PixelDecoration art="cat" loading="lazy" />
        </div>
      </div>
      <div className="shelf-plinth" aria-hidden="true">
        <span>작은 초록이 모여, 나만의 정원</span>
        <span>✦</span>
      </div>
    </div>
  )
}

/** One continuous rail per visible grid row; decorations never occupy a plant cell. */
function ShelfRowEnd({
  index,
  total,
  columns,
  size,
}: {
  index: number
  total: number
  columns: number
  size: 'wide' | 'narrow'
}) {
  const last = index === total - 1
  const filled = (index + 1) % columns
  if (!last && filled !== 0) return null
  const remaining = filled === 0 ? 0 : columns - filled
  const row = Math.floor(index / columns)
  return (
    <>
      {remaining > 0 && (
        <li
          className={`shelf-gap gap-${size}`}
          style={{ gridColumn: `span ${remaining}` }}
          role="presentation"
          aria-hidden="true"
        >
          <PixelDecoration
            art={row % 2 === 0 ? 'books' : 'frame'}
            loading={row === 0 ? 'eager' : 'lazy'}
          />
          {remaining > 1 && (
            <PixelDecoration art="can" loading={row === 0 ? 'eager' : 'lazy'} />
          )}
        </li>
      )}
      <li
        className={`shelf-rail rail-${size}`}
        role="presentation"
        aria-hidden="true"
      >
        {remaining === 0 && total <= 6 && row < 2 && (
          <PixelDecoration
            art={row === 0 ? 'house' : 'spray'}
            loading={row === 0 ? 'eager' : 'lazy'}
            className={`rail-decoration ${row === 1 ? 'at-right' : ''}`}
          />
        )}
      </li>
    </>
  )
}
