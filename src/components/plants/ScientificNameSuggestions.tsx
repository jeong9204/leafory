import { useId, useState } from 'react'
import { searchPlantCatalog } from '../../data/catalog/search'
import type { CatalogPlant } from '../../data/catalog/search'
import './scientific-name-suggestions.css'

function ScientificNameCandidate({
  plant,
  onSelect,
}: {
  plant: CatalogPlant
  onSelect: (scientificName: string) => void
}) {
  const detailsId = useId()
  const [expanded, setExpanded] = useState(false)
  return (
    <li>
      <div className="candidate-row">
        <button
          type="button"
          className="scientific-candidate"
          onClick={() => onSelect(plant.scientificName)}
          aria-label={`${plant.commonName} · ${plant.scientificName} 학명 선택`}
        >
          <span className="candidate-name">{plant.commonName}</span>
          <i className="candidate-scientific">{plant.scientificName}</i>
        </button>
        <button
          type="button"
          className="candidate-toggle"
          aria-label={`${expanded ? '닫기' : '자세히 보기'} · ${plant.scientificName}`}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '닫기' : '자세히 보기'}
        </button>
      </div>
      <div id={detailsId} className="candidate-details" hidden={!expanded}>
        {plant.note && <p className="candidate-note">{plant.note}</p>}
        <a
          className="candidate-source"
          href={plant.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Kew 분류 출처 · {plant.checkedAt} 확인
          <span className="sr-only"> · {plant.scientificName} · 새 창</span>
        </a>
        <a
          className="catalog-attribution"
          href="/licenses/plant-catalog-attribution.txt"
          target="_blank"
          rel="noreferrer"
        >
          카탈로그 출처·이용 고지 <span className="sr-only">새 창</span>
        </a>
      </div>
    </li>
  )
}

export function ScientificNameSuggestions({
  query,
  onSelect,
}: {
  query: string
  onSelect: (scientificName: string) => void
}) {
  const headingId = useId()
  const candidates = searchPlantCatalog(query)
  if (!query.trim()) return null
  const visible = candidates.slice(0, 5)
  return (
    <section className="scientific-suggestions" aria-labelledby={headingId}>
      <div className="suggestion-heading">
        <h2 id={headingId}>
          학명 추천 <span>선택</span>
        </h2>
        <p className="suggestion-status" role="status">
          {candidates.length
            ? `${candidates.length}개 후보${candidates.length > 5 ? ' · 5개 표시, 이름을 더 입력해 주세요' : ''}`
            : '추천 후보가 없어요. 학명을 직접 입력하거나 비워 두어도 돼요.'}
        </p>
      </div>
      {visible.length > 0 && (
        <ul>
          {visible.map((plant) => (
            <ScientificNameCandidate
              key={plant.id}
              plant={plant}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
