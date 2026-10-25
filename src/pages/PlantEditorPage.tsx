import { useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useRepositories } from '../app/repository-context'
import { loadPlant } from '../app/plant-service'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { PlantForm } from '../components/plants/PlantForm'
import { DataFeedback } from '../components/plants/DataFeedback'
import { RepositoryError } from '../domain/errors'

export function PlantEditorPage() {
  const { id } = useParams()
  const { repositories } = useRepositories()
  const query = useCallback(
    () => (id ? loadPlant(repositories, id) : Promise.resolve(undefined)),
    [repositories, id],
  )
  const { result, reload } = useRepositoryQuery(query, false)
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') {
    if (
      result.error instanceof RepositoryError &&
      result.error.code === 'NOT_FOUND'
    )
      return (
        <section className="data-feedback">
          <h1>식물을 찾을 수 없습니다</h1>
          <Link to="/">내 식물로 돌아가기</Link>
        </section>
      )
    return <DataFeedback error retry={reload} />
  }
  return (
    <div className="plant-editor-page">
      <header className="editor-header">
        <Link
          to={id ? `/plants/${id}` : '/'}
          aria-label="이전 화면으로 돌아가기"
        >
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div>
          <h1>{id ? '식물 정보 수정' : '새로운 초록 친구'}</h1>
          <p>
            {id
              ? '함께하는 이야기를 다듬어 주세요.'
              : '우리의 첫 만남을 기록해 볼까요?'}
          </p>
        </div>
      </header>
      <PlantForm
        key={id ?? 'new'}
        initial={result.data?.plant}
        cover={result.data?.cover}
      />
    </div>
  )
}
