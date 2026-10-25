import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import type { CareEvent } from '../domain/models'
import { RepositoryError } from '../domain/errors'
import { loadPlant } from '../app/plant-service'
import {
  careLabels,
  loadCare,
  localDateTime,
  saveCare,
} from '../app/care-service'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { DataFeedback } from '../components/plants/DataFeedback'

export function CareEditorPage() {
  const { id = '', eventId } = useParams()
  const { repositories } = useRepositories()
  const query = useCallback(async () => {
    const view = await loadPlant(repositories, id)
    const event = eventId
      ? await loadCare(repositories, id, eventId)
      : undefined
    return { plant: view.plant, event }
  }, [repositories, id, eventId])
  const { result, reload } = useRepositoryQuery(query, false)
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') {
    if (
      result.error instanceof RepositoryError &&
      result.error.code === 'NOT_FOUND'
    )
      return (
        <section className="data-feedback">
          <h1>식물 또는 기록을 찾을 수 없습니다</h1>
          <Link to="/">내 식물로 돌아가기</Link>
        </section>
      )
    return <DataFeedback error retry={reload} />
  }
  return (
    <div className="plant-editor-page">
      <header className="editor-header">
        <Link to={`/plants/${id}`} aria-label="식물 상세로 돌아가기">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div>
          <h1>{eventId ? '관리 기록 수정' : '빠른 관리 기록'}</h1>
          <p>{result.data.plant.name}의 오늘을 남겨 주세요.</p>
        </div>
      </header>
      <CareForm
        key={`${id}:${eventId ?? 'new'}`}
        plantId={id}
        initial={result.data.event}
      />
    </div>
  )
}
function CareForm({
  plantId,
  initial,
}: {
  plantId: string
  initial?: CareEvent
}) {
  const { repositories, invalidate } = useRepositories()
  const navigate = useNavigate()
  const [original] = useState(() => ({
    eventType: initial?.eventType ?? 'watering',
    dateTime: localDateTime(
      initial ? new Date(initial.occurredAt) : new Date(),
    ),
    hours: initial?.durationMinutes
      ? String(Math.floor(initial.durationMinutes / 60))
      : '',
    minutes: initial?.durationMinutes
      ? String(initial.durationMinutes % 60)
      : '',
    memo: initial?.memo ?? '',
  }))
  const [fields, setFields] = useState(original)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const { allowNavigation, guard } = useUnsavedChanges(
    JSON.stringify(fields) !== JSON.stringify(original),
    busy,
  )
  function change<K extends keyof typeof fields>(
    key: K,
    value: (typeof fields)[K],
  ) {
    setFields((old) => ({ ...old, [key]: value }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await saveCare(repositories, plantId, fields, initial?.id)
      allowNavigation()
      invalidate()
      navigate(`/plants/${plantId}`, { replace: true })
    } catch (cause) {
      setError(
        cause instanceof RepositoryError && cause.code === 'VALIDATION'
          ? cause.message
          : '저장하지 못했어요. 입력 내용을 유지했으니 다시 시도해 주세요.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className="plant-editor care-editor"
      aria-label="관리 기록 폼"
      aria-busy={busy}
      onSubmit={submit}
    >
      {guard}
      <fieldset disabled={busy} className="editor-fields surface">
        <legend className="sr-only">관리 기록 정보</legend>
        <label htmlFor="care-type">관리 종류</label>
        <select
          id="care-type"
          value={fields.eventType}
          onChange={(e) =>
            change('eventType', e.target.value as CareEvent['eventType'])
          }
        >
          {Object.entries(careLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="care-time">기록 날짜·시각</label>
        <input
          id="care-time"
          type="datetime-local"
          required
          value={fields.dateTime}
          onInput={(e) => change('dateTime', e.currentTarget.value)}
          onChange={(e) => change('dateTime', e.target.value)}
        />
        <p className="care-field-note">현재 기기의 로컬 시간 기준이에요.</p>
        {fields.eventType === 'grow_light' && (
          <div className="care-duration">
            <div>
              <label htmlFor="care-hours">사용 시간</label>
              <input
                id="care-hours"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={fields.hours}
                onChange={(e) => change('hours', e.target.value)}
                placeholder="0"
              />
              <span>시간</span>
            </div>
            <div>
              <label htmlFor="care-minutes">사용 분</label>
              <input
                id="care-minutes"
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                step="1"
                value={fields.minutes}
                onChange={(e) => change('minutes', e.target.value)}
                placeholder="0"
              />
              <span>분</span>
            </div>
          </div>
        )}
        <label htmlFor="care-memo">
          메모 <span>선택</span>
        </label>
        <textarea
          id="care-memo"
          rows={4}
          maxLength={3000}
          value={fields.memo}
          onChange={(e) => change('memo', e.target.value)}
          placeholder="오늘의 관리를 짧게 남겨 보세요."
        />
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
          disabled={busy}
          onClick={() => navigate(`/plants/${plantId}`)}
        >
          취소
        </button>
        <button type="submit" className="primary-button" disabled={busy}>
          <Check aria-hidden="true" />
          {busy ? '저장 중…' : '기록 저장'}
        </button>
      </div>
    </form>
  )
}
