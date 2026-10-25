import { Droplet, NotebookText, Sprout, Sun } from 'lucide-react'
import type { PlantView } from '../../app/plant-service'
import { statusLabels } from '../../app/plant-service'
import { localDateKey } from '../../domain/calendar'
import { PlantPhoto } from '../plants/PlantPhoto'
import { shortDate } from '../../lib/dates'

interface PlantSummaryProps {
  view: PlantView
  message: string
  recordCount: number
}

export function PlantSummary({
  view,
  message,
  recordCount,
}: PlantSummaryProps) {
  const { plant } = view
  const date = view.lastWatered
    ? localDateKey(new Date(view.lastWatered))
    : undefined
  return (
    <section
      aria-label={`${plant.name} 현재 상태와 관리 요약`}
      className="detail-summary surface"
    >
      <PlantPhoto
        blob={view.cover}
        alt={`${plant.name} 대표 사진`}
        width="240"
        height="280"
        className="detail-portrait"
      />
      <div className="detail-state">
        <span className="detail-status">
          <Sprout aria-hidden="true" />
          {statusLabels[plant.status]}
        </span>
        <p>{message}</p>
        <Sprout aria-hidden="true" className="detail-decoration" />
      </div>
      <dl className="detail-metrics">
        <div>
          <dt>
            <Droplet aria-hidden="true" />
            <span>
              마지막
              <br />
              물주기
            </span>
          </dt>
          <dd>
            {date ? (
              <time dateTime={date}>{shortDate(date)}</time>
            ) : (
              '기록 없음'
            )}
          </dd>
        </div>
        <div>
          <dt>
            <Sun aria-hidden="true" />
            <span>
              오늘의
              <br />
              식물등
            </span>
          </dt>
          <dd>
            {view.lightMinutes === undefined
              ? '기록 없음'
              : `${view.lightMinutes}분`}
          </dd>
        </div>
        <div>
          <dt>
            <NotebookText aria-hidden="true" />
            <span>
              총<br />
              기록
            </span>
          </dt>
          <dd>{recordCount}개</dd>
        </div>
      </dl>
    </section>
  )
}
