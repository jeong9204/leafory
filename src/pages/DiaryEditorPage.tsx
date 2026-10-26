import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useRepositories } from '../app/repository-context'
import { loadPlant } from '../app/plant-service'
import { conditionLabels, loadDiary, saveDiary } from '../app/diary-service'
import type { DiaryFields, DiaryPhotoDraft } from '../app/diary-service'
import { localDateKey } from '../domain/calendar'
import { RepositoryError } from '../domain/errors'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { DataFeedback } from '../components/plants/DataFeedback'
import { DiaryPhotos } from '../components/diary/DiaryPhotos'

export function DiaryEditorPage() {
  const { id = '', entryId } = useParams()
  const { repositories } = useRepositories()
  const query = useCallback(async () => {
    if (entryId) return loadDiary(repositories, id, entryId)
    return {
      plant: (await loadPlant(repositories, id)).plant,
      entry: undefined,
      photos: [],
    }
  }, [repositories, id, entryId])
  const { result, reload } = useRepositoryQuery(query, false)
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
  return (
    <div className="plant-editor-page">
      <header className="editor-header">
        <Link
          to={entryId ? `/plants/${id}/diary/${entryId}` : `/plants/${id}`}
          aria-label="이전 화면으로 돌아가기"
        >
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div>
          <h1>{entryId ? '일기 수정' : '일기 작성'}</h1>
          <p>{result.data.plant.name}의 작은 변화를 남겨 주세요.</p>
        </div>
      </header>
      <DiaryForm
        key={`${id}:${entryId ?? 'new'}`}
        plantId={id}
        initial={result.data}
      />
    </div>
  )
}
function DiaryForm({
  plantId,
  initial,
}: {
  plantId: string
  initial: {
    entry?: Awaited<ReturnType<typeof loadDiary>>['entry']
    photos: Awaited<ReturnType<typeof loadDiary>>['photos']
  }
}) {
  const { repositories, invalidate } = useRepositories()
  const navigate = useNavigate()
  const [original] = useState(() => ({
    entryDate: initial.entry?.entryDate ?? localDateKey(),
    condition: initial.entry?.condition ?? 'normal',
    title: initial.entry?.title ?? '',
    content: initial.entry?.content ?? '',
  }))
  const [fields, setFields] = useState<DiaryFields>(original)
  const [photos, setPhotos] = useState<DiaryPhotoDraft[]>(() =>
    initial.photos.map((p) => ({ ...p, key: p.id, photoId: p.id })),
  )
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const lock = useRef(false)
  const dirty =
    JSON.stringify(fields) !== JSON.stringify(original) ||
    photos.map((p) => p.key).join(',') !==
      initial.photos.map((p) => p.id).join(',') ||
    processing
  const { allowNavigation, guard } = useUnsavedChanges(dirty, busy)
  function change<K extends keyof DiaryFields>(key: K, value: DiaryFields[K]) {
    setFields((old) => ({ ...old, [key]: value }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || processing) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await saveDiary(
        repositories,
        plantId,
        fields,
        photos,
        initial.entry?.id,
      )
      allowNavigation()
      invalidate()
      navigate(`/plants/${plantId}/diary/${saved.id}`, { replace: true })
    } catch (cause) {
      setError(
        cause instanceof RepositoryError && cause.code === 'VALIDATION'
          ? cause.message
          : '저장하지 못했어요. 입력 내용과 사진을 유지했으니 다시 시도해 주세요.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className="plant-editor diary-editor"
      aria-label="사진 일기 폼"
      aria-busy={busy || processing}
      onSubmit={submit}
    >
      {guard}
      <fieldset disabled={busy || processing}>
        <legend className="sr-only">사진 일기 정보</legend>
        <DiaryPhotos
          photos={photos}
          onChange={setPhotos}
          processing={processing}
          onProcessing={setProcessing}
          error={photoError}
          onError={setPhotoError}
        />
        <div className="editor-fields surface">
          <label htmlFor="diary-date">일기 날짜</label>
          <input
            id="diary-date"
            type="date"
            required
            value={fields.entryDate}
            onInput={(e) => change('entryDate', e.currentTarget.value)}
            onChange={(e) => change('entryDate', e.target.value)}
          />
          <label htmlFor="diary-condition">오늘의 식물 상태</label>
          <select
            id="diary-condition"
            value={fields.condition}
            onChange={(e) =>
              change('condition', e.target.value as DiaryFields['condition'])
            }
          >
            {Object.entries(conditionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="diary-title">
            제목 <span>선택</span>
          </label>
          <input
            id="diary-title"
            maxLength={120}
            value={fields.title}
            onChange={(e) => change('title', e.target.value)}
            placeholder="예: 작은 새잎을 발견했어요"
          />
          <label htmlFor="diary-content">
            관찰 메모 <span>선택</span>
          </label>
          <textarea
            id="diary-content"
            rows={7}
            maxLength={20000}
            value={fields.content}
            onChange={(e) => change('content', e.target.value)}
            placeholder="잎의 색, 새싹, 오늘의 느낌을 자유롭게 남겨 보세요."
          />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="editor-submit-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy || processing}
          onClick={() =>
            navigate(
              initial.entry
                ? `/plants/${plantId}/diary/${initial.entry.id}`
                : `/plants/${plantId}`,
            )
          }
        >
          취소
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={busy || processing}
        >
          <Check aria-hidden="true" />
          {busy ? '저장 중…' : '일기 저장'}
        </button>
      </div>
    </form>
  )
}
