import { Droplet, Sprout, Sun } from 'lucide-react'
import { Link } from 'react-router'
import { DeleteCareButton } from './DeleteCareButton'
import type { PlantTimelineEntry } from '../../app/plant-service'
import { PlantPhoto } from '../plants/PlantPhoto'
import { fullDate } from '../../lib/dates'

const eventIcons = {
  growth: Sprout,
  watering: Droplet,
  light: Sun,
  repotting: Sprout,
  fertilizing: Sprout,
}
const eventNames = {
  growth: '성장 관찰',
  watering: '물주기',
  light: '식물등',
  repotting: '분갈이',
  fertilizing: '비료 주기',
}

export function PlantTimeline({
  entries,
  plantId,
}: {
  entries: PlantTimelineEntry[]
  plantId?: string
}) {
  if (entries.length === 0)
    return <p className="detail-empty">아직 기록이 없어요.</p>
  return (
    <ol className="detail-timeline" aria-label="식물 관리 타임라인">
      {entries.map((entry) => {
        const Icon = eventIcons[entry.kind]
        return (
          <li key={entry.id} className="detail-timeline-item">
            <span className={`detail-event-icon ${entry.kind}`}>
              <Icon aria-hidden="true" />
              <span className="sr-only">{eventNames[entry.kind]}</span>
            </span>
            <article
              className={`detail-event-card surface ${entry.image ? '' : 'without-photo'}`}
            >
              {entry.image && (
                <PlantPhoto
                  blob={entry.image}
                  alt={entry.imageAlt ?? entry.title}
                  width="76"
                  height="76"
                  className="detail-event-photo"
                />
              )}
              <div className="min-w-0">
                <time dateTime={entry.date}>
                  {fullDate(entry.date)}
                  {entry.occurredAt &&
                    ` · ${new Date(entry.occurredAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                </time>
                <h3>{entry.title}</h3>
                <p>{entry.description}</p>
              </div>
              {entry.careEventId && plantId && (
                <div className="care-event-actions">
                  <Link
                    to={`/plants/${plantId}/care/${entry.careEventId}/edit`}
                    aria-label={`${entry.title} 기록 수정`}
                  >
                    수정
                  </Link>
                  <DeleteCareButton
                    plantId={plantId}
                    eventId={entry.careEventId}
                    title={entry.title}
                  />
                </div>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}
