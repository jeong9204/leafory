import { useCallback, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import { PlantSummary } from '../components/plant-detail/PlantSummary'
import { PlantRecordTabs } from '../components/plant-detail/PlantRecordTabs'
import { DataFeedback } from '../components/plants/DataFeedback'
import { DeletePlantDialog } from '../components/plants/DeletePlantDialog'
import { useRepositories } from '../app/repository-context'
import { loadPlant } from '../app/plant-service'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { RepositoryError } from '../domain/errors'
import './plant-detail.css'

export function PlantDetailPage() {
  const { id = '' } = useParams()
  const { repositories } = useRepositories()
  const query = useCallback(
    () => loadPlant(repositories, id),
    [repositories, id],
  )
  const { result, reload } = useRepositoryQuery(query)
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') {
    if (
      !(result.error instanceof RepositoryError) ||
      result.error.code !== 'NOT_FOUND'
    )
      return <DataFeedback error retry={reload} />
    return (
      <section className="detail-page detail-not-found">
        <h1>식물을 찾을 수 없습니다</h1>
        <p>삭제되었거나 주소가 올바르지 않아요.</p>
        <Link to="/">내 식물로 돌아가기</Link>
      </section>
    )
  }
  const view = result.data
  const { plant } = view
  return (
    <div className="detail-page">
      <header className="detail-header">
        <Link
          to="/"
          aria-label="내 식물 목록으로 돌아가기"
          className="detail-back"
        >
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1>{plant.name}</h1>
          <p lang="la">{plant.species || '학명 미등록'}</p>
        </div>
        <div
          className="plant-manage-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setMenu(false)
              menuButton.current?.focus()
            }
          }}
        >
          <button
            ref={menuButton}
            type="button"
            className="detail-header-more"
            aria-label="식물 관리 메뉴"
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            <MoreHorizontal aria-hidden="true" />
          </button>
          {menu && (
            <div className="plant-menu-panel surface">
              <Link to={`/plants/${plant.id}/edit`}>
                <Pencil aria-hidden="true" />
                정보 수정
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  setConfirm(true)
                }}
              >
                <Trash2 aria-hidden="true" />
                식물 삭제
              </button>
            </div>
          )}
        </div>
      </header>
      <PlantSummary
        view={view}
        message={'오늘도 천천히\n함께 자라고 있어요.'}
        recordCount={view.recordCount}
      />
      <div className="detail-actions">
        <Link to={`/plants/${plant.id}/care/new`}>
          <Pencil aria-hidden="true" />
          빠른 기록
        </Link>
        <button type="button" disabled aria-describedby="detail-actions-note">
          <NotebookText aria-hidden="true" />
          일기 쓰기
        </button>
      </div>
      <p id="detail-actions-note" className="detail-action-note">
        사진 일기 작성 기능은 준비 중이에요.
      </p>
      <PlantRecordTabs
        key={plant.id}
        plantId={plant.id}
        entries={view.entries}
        photos={view.gallery}
      />
      <section
        aria-labelledby="plant-memo-heading"
        className="detail-memo surface"
      >
        <div className="detail-memo-heading">
          <span className="detail-memo-icon">
            <NotebookText aria-hidden="true" />
          </span>
          <h2 id="plant-memo-heading">식물 메모</h2>
          <Link to={`/plants/${plant.id}/edit`} className="memo-edit-link">
            수정하기
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        <p>{plant.memo || '아직 메모가 없어요.'}</p>
      </section>
      <DeletePlantDialog
        plant={plant}
        open={confirm}
        onClose={() => {
          setConfirm(false)
          menuButton.current?.focus()
        }}
      />
    </div>
  )
}
