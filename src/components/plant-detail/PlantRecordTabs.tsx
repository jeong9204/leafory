import { Link } from 'react-router'
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { PlantTimelineEntry } from '../../app/plant-service'
import { PlantPhoto } from '../plants/PlantPhoto'
import { fullDate } from '../../lib/dates'
import { PlantTimeline } from './PlantTimeline'

const tabs = [
  { id: 'timeline', label: '타임라인' },
  { id: 'photos', label: '사진' },
] as const

export function PlantRecordTabs({
  plantId,
  entries,
  photos: photoEntries,
}: {
  plantId?: string
  entries: PlantTimelineEntry[]
  photos?: PlantTimelineEntry[]
}) {
  const [active, setActive] = useState<'timeline' | 'photos'>('timeline')
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      next = 1 - index
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else return
    event.preventDefault()
    setActive(tabs[next].id)
    refs.current[next]?.focus()
  }
  const photos = (photoEntries ?? entries).filter((entry) => entry.image)
  return (
    <section aria-label="식물 기록" className="detail-records">
      <div role="tablist" aria-label="기록 보기 방식" className="detail-tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`detail-tab-${tab.id}`}
            aria-controls={`detail-panel-${tab.id}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => handleKey(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="detail-panel-timeline"
        aria-labelledby="detail-tab-timeline"
        hidden={active !== 'timeline'}
        tabIndex={0}
      >
        <PlantTimeline entries={entries} plantId={plantId} />
      </div>
      <div
        role="tabpanel"
        id="detail-panel-photos"
        aria-labelledby="detail-tab-photos"
        hidden={active !== 'photos'}
        tabIndex={0}
      >
        {photos.length > 0 ? (
          <ul className="detail-gallery" aria-label="식물 기록 사진">
            {photos.map((entry) => (
              <li key={entry.id}>
                <figure className="surface">
                  <PlantPhoto
                    className="detail-gallery-photo"
                    blob={entry.image}
                    alt={entry.imageAlt ?? entry.title}
                    width="160"
                    height="160"
                  />
                  {entry.diaryEntryId && plantId && (
                    <Link
                      className="diary-gallery-link"
                      to={`/plants/${plantId}/diary/${entry.diaryEntryId}`}
                    >
                      일기 보기
                    </Link>
                  )}
                  <figcaption>
                    <time dateTime={entry.date}>{fullDate(entry.date)}</time>
                    <span>{entry.title}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty">아직 사진이 없어요.</p>
        )}
      </div>
    </section>
  )
}
