import { useCallback } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { loadGrowthPhotos } from '../app/growth-service'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { RepositoryError } from '../domain/errors'
import { DataFeedback } from '../components/plants/DataFeedback'
import { GrowthComparison } from '../components/growth/GrowthComparison'
import './growth-comparison.css'

export function GrowthComparisonPage() {
  const { id = '' } = useParams()
  const { repositories } = useRepositories()
  const query = useCallback(
    () => loadGrowthPhotos(repositories, id),
    [repositories, id],
  )
  const { result, reload } = useRepositoryQuery(query)
  return (
    <div className="growth-page">
      <header className="editor-header">
        <Link to={`/plants/${id}`} aria-label="식물 상세로 돌아가기">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1>성장 비교</h1>
          <p>
            {result.status === 'success'
              ? `${result.data.plant.name}의 사진 일기`
              : '사진으로 돌아보는 성장 기록'}
          </p>
        </div>
        <button
          type="button"
          className="growth-refresh"
          aria-label="사진 목록 새로고침"
          onClick={reload}
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </header>
      <p className="growth-help">
        일기에 첨부한 사진을 비교해요. 일기와 연결되지 않은 대표 사진은
        제외돼요.
      </p>
      {result.status === 'loading' ? (
        <DataFeedback />
      ) : result.status === 'error' ? (
        result.error instanceof RepositoryError &&
        result.error.code === 'NOT_FOUND' ? (
          <section className="data-feedback">
            <h2>식물을 찾을 수 없습니다</h2>
            <Link to="/">내 식물로 돌아가기</Link>
          </section>
        ) : (
          <DataFeedback error retry={reload} />
        )
      ) : (
        <GrowthComparison
          key={id}
          photos={result.data.photos}
          refreshPhotos={reload}
        />
      )}
    </div>
  )
}
