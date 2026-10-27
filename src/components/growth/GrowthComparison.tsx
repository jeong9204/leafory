import { useEffect, useRef, useState } from 'react'
import type { GrowthPhoto } from '../../app/growth-service'
import { PlantPhoto } from '../plants/PlantPhoto'

const dateLabel = (date: string) => date.replaceAll('-', '.')

export function GrowthComparison({
  photos,
  refreshPhotos,
}: {
  photos: GrowthPhoto[]
  refreshPhotos?: () => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const chosen = photos.filter((photo) => selected.includes(photo.id))
  const missing = selected.some(
    (id) => !photos.some((photo) => photo.id === id),
  )
  const showComparison = comparing && chosen.length === 2
  useEffect(() => {
    heading.current?.focus()
  }, [showComparison])

  function toggle(id: string) {
    setComparing(false)
    const ids = chosen.map((photo) => photo.id)
    setSelected(
      ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id].slice(0, 2),
    )
  }
  return (
    <section className="growth-content" aria-label="성장 사진 비교">
      {missing && (
        <p role="status" className="growth-notice">
          선택한 사진이 삭제되었거나 일기에서 제외됐어요. 사진을 다시 선택해
          주세요.
        </p>
      )}
      {showComparison ? (
        <>
          <div className="growth-heading">
            <h2 ref={heading} tabIndex={-1}>
              두 사진 비교
            </h2>
            <button
              type="button"
              className="growth-text-button"
              onClick={() => setComparing(false)}
            >
              사진 다시 선택
            </button>
          </div>
          <p className="growth-help">
            원본 비율을 유지해 같은 크기의 영역에 표시해요.
          </p>
          <div
            className="growth-pair"
            role="group"
            aria-label="선택한 사진 두 장"
          >
            {chosen.map((photo, index) => (
              <figure key={photo.id} className="surface">
                <div className="growth-comparison-image">
                  <PlantPhoto
                    blob={photo.blob}
                    alt={`비교 사진 ${index + 1} · ${photo.title}`}
                    className="growth-comparison-photo"
                    width={600}
                    height={600}
                  />
                </div>
                <figcaption>
                  <span className="growth-photo-label">사진 {index + 1}</span>
                  <time dateTime={photo.date}>{dateLabel(photo.date)}</time>
                  <span className="growth-photo-title">{photo.title}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="growth-heading">
            <h2 ref={heading} tabIndex={-1}>
              비교할 사진 선택
            </h2>
            <span role="status">{chosen.length} / 2 선택</span>
          </div>
          <p id="growth-selection-help" className="growth-help">
            일기 날짜순으로 표시해요. 비교할 사진 두 장을 골라 주세요.
          </p>
          {photos.length < 2 && (
            <p className="growth-notice" role="status">
              성장 비교에는 일기 사진이 두 장 이상 필요해요. 현재{' '}
              {photos.length}장이 있어요.
            </p>
          )}
          <div className="growth-selection-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={photos.length < 2}
              onClick={() => {
                setComparing(false)
                setSelected([photos[0].id, photos[photos.length - 1].id])
              }}
            >
              처음·최근 사진 선택
            </button>
            <button
              type="button"
              className="growth-text-button"
              disabled={!selected.length}
              onClick={() => {
                setComparing(false)
                setSelected([])
              }}
            >
              선택 초기화
            </button>
          </div>
          <ul className="growth-photo-list" aria-label="비교 가능한 일기 사진">
            {photos.map((photo, index) => {
              const checked = chosen.some((value) => value.id === photo.id)
              return (
                <li key={photo.id}>
                  <label
                    className={`growth-photo-choice surface ${checked ? 'is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && chosen.length === 2}
                      onChange={() => toggle(photo.id)}
                      aria-label={`${dateLabel(photo.date)} · ${photo.title} · ${index + 1}번 사진 선택`}
                      aria-describedby="growth-selection-help"
                    />
                    <PlantPhoto
                      blob={photo.blob}
                      alt={`${photo.title} 사진 ${index + 1}`}
                      className="growth-thumbnail"
                      width={160}
                      height={160}
                    />
                    <span className="growth-photo-meta">
                      <time dateTime={photo.date}>{dateLabel(photo.date)}</time>
                      <span className="growth-photo-title">{photo.title}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="primary-button growth-compare-button"
            disabled={chosen.length !== 2}
            onClick={() => {
              refreshPhotos?.()
              setComparing(true)
            }}
          >
            선택한 사진 비교
          </button>
        </>
      )}
    </section>
  )
}
