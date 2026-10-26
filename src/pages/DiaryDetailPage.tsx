import { useCallback } from 'react'
import { ChevronLeft, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { loadDiary, conditionLabels } from '../app/diary-service'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { RepositoryError } from '../domain/errors'
import { fullDate } from '../lib/dates'
import { DataFeedback } from '../components/plants/DataFeedback'
import { PlantPhoto } from '../components/plants/PlantPhoto'
import { DeleteDiaryButton } from '../components/diary/DeleteDiaryButton'

export function DiaryDetailPage() {
  const { id = '', entryId = '' } = useParams()
  const { repositories } = useRepositories()
  const query = useCallback(
    () => loadDiary(repositories, id, entryId),
    [repositories, id, entryId],
  )
  const { result, reload } = useRepositoryQuery(query)
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error')
    return result.error instanceof RepositoryError &&
      result.error.code === 'NOT_FOUND' ? (
      <section className="data-feedback">
        <h1>식물 또는 일기를 찾을 수 없습니다</h1>
        <Link to="/">내 식물로 돌아가기</Link>
      </section>
    ) : (
      <DataFeedback error retry={reload} />
    )
  const { plant, entry, photos } = result.data
  return (
    <div className="plant-editor-page diary-detail-page">
      <header className="editor-header">
        <Link to={`/plants/${id}`} aria-label="식물 상세로 돌아가기">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div>
          <h1>{entry.title || '식물 일기'}</h1>
          <p>{plant.name}의 관찰 일기</p>
        </div>
      </header>
      <article className="diary-detail-body surface">
        <div className="diary-detail-meta">
          <time dateTime={entry.entryDate}>{fullDate(entry.entryDate)}</time>
          <span className="plant-status">
            상태 · {conditionLabels[entry.condition]}
          </span>
        </div>
        <p className="diary-observation">
          {entry.content || '관찰 메모가 없어요.'}
        </p>
        {photos.length ? (
          <ol className="diary-detail-photos" aria-label="일기 사진">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <PlantPhoto
                  blob={photo.blob}
                  alt={`일기 사진 ${index + 1}`}
                  className="diary-full-photo"
                  width={600}
                  height={600}
                />
                <p>
                  {index + 1} / {photos.length}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-empty">첨부한 사진이 없어요.</p>
        )}
      </article>
      <div className="diary-detail-actions">
        <Link
          to={`/plants/${id}/diary/${entryId}/edit`}
          className="primary-button"
        >
          <Pencil aria-hidden="true" />
          일기 수정
        </Link>
        <DeleteDiaryButton
          plantId={id}
          entryId={entryId}
          title={entry.title || '식물 일기'}
        />
      </div>
    </div>
  )
}
