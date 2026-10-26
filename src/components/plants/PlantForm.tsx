import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { Camera, ImagePlus, Sprout } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { Plant } from '../../domain/models'
import type { PhotoChange } from '../../app/plant-service'
import { savePlant, statusLabels } from '../../app/plant-service'
import { useRepositories } from '../../app/repository-context'
import { preparePlantPhoto } from '../../lib/plant-photo'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { PlantPhoto } from './PlantPhoto'
import { ScientificNameSuggestions } from './ScientificNameSuggestions'

export function PlantForm({
  initial,
  cover,
}: {
  initial?: Plant
  cover?: Blob
}) {
  const { repositories, invalidate } = useRepositories()
  const navigate = useNavigate()
  const prefix = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [species, setSpecies] = useState(initial?.species ?? '')
  const [acquiredAt, setAcquiredAt] = useState(initial?.acquiredAt ?? '')
  const [status, setStatus] = useState<Plant['status']>(
    initial?.status ?? 'healthy',
  )
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [photo, setPhoto] = useState<PhotoChange>({ type: 'keep' })
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const lock = useRef(false)
  const generation = useRef(0)
  const alive = useRef(true)
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const dirty =
    name !== (initial?.name ?? '') ||
    species !== (initial?.species ?? '') ||
    acquiredAt !== (initial?.acquiredAt ?? '') ||
    status !== (initial?.status ?? 'healthy') ||
    memo !== (initial?.memo ?? '') ||
    photo.type !== 'keep' ||
    processing
  const { allowNavigation, guard } = useUnsavedChanges(dirty, saving)
  const preview =
    photo.type === 'replace'
      ? photo.photo.blob
      : photo.type === 'remove'
        ? undefined
        : cover

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const token = ++generation.current
    setProcessing(true)
    setPhotoError('')
    try {
      const prepared = await preparePlantPhoto(file)
      if (alive.current && generation.current === token)
        setPhoto({ type: 'replace', photo: prepared })
    } catch (cause) {
      if (alive.current && generation.current === token)
        setPhotoError(
          cause instanceof Error ? cause.message : '사진을 처리하지 못했어요.',
        )
    } finally {
      if (alive.current && generation.current === token) setProcessing(false)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || processing) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await savePlant(
        repositories,
        { name, species, acquiredAt, status, memo },
        photo,
        initial?.id,
      )
      allowNavigation()
      invalidate()
      if (alive.current) navigate(`/plants/${saved.id}`, { replace: true })
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error &&
            'code' in cause &&
            cause.code === 'VALIDATION'
            ? cause.message
            : '저장하지 못했어요. 입력 내용을 유지했으니 다시 시도해 주세요.',
        )
    } finally {
      lock.current = false
      if (alive.current) setSaving(false)
    }
  }
  return (
    <form
      onSubmit={submit}
      className="plant-editor"
      aria-label={initial ? '식물 수정 폼' : '식물 등록 폼'}
      aria-busy={saving}
    >
      {guard}
      <fieldset disabled={saving || processing}>
        <legend className="sr-only">식물 정보</legend>
        <section
          className="editor-photo-section surface"
          aria-labelledby={`${prefix}-photo-heading`}
        >
          <h2 id={`${prefix}-photo-heading`}>
            대표 사진 <span>선택</span>
          </h2>
          <PlantPhoto
            blob={preview}
            alt="대표 사진 미리보기"
            className="editor-preview"
            width={180}
            height={180}
          />
          <div className="editor-photo-actions">
            <button type="button" onClick={() => camera.current?.click()}>
              <Camera aria-hidden="true" />
              사진 촬영
            </button>
            <button type="button" onClick={() => gallery.current?.click()}>
              <ImagePlus aria-hidden="true" />
              갤러리
            </button>
          </div>
          <input
            ref={camera}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            aria-label="카메라로 대표 사진 선택"
            onChange={choosePhoto}
          />
          <input
            ref={gallery}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="갤러리에서 대표 사진 선택"
            onChange={choosePhoto}
          />
          {preview && (
            <button
              type="button"
              className="photo-remove"
              onClick={() => {
                setPhoto({ type: 'remove' })
                setPhotoError('')
              }}
            >
              사진 삭제
            </button>
          )}
          <p className="field-hint">
            JPEG · PNG · WebP, 15MB 이하
            <br />
            사진은 이 기기에 저장돼요.
          </p>
          {photoError && (
            <p className="form-error" role="alert">
              {photoError}
            </p>
          )}
        </section>
        <div className="editor-fields surface">
          <label htmlFor={`${prefix}-name`}>
            식물 이름 <span className="required-label">필수</span>
          </label>
          <input
            id={`${prefix}-name`}
            name="name"
            autoComplete="off"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 나의 작은 괴마옥"
          />
          <ScientificNameSuggestions query={name} onSelect={setSpecies} />
          <label htmlFor={`${prefix}-species`}>
            학명 또는 품종 <span>선택</span>
          </label>
          <input
            id={`${prefix}-species`}
            name="species"
            autoComplete="off"
            maxLength={120}
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            placeholder="예: Euphorbia bupleurifolia"
          />
          <label htmlFor={`${prefix}-date`}>
            데려온 날짜 <span>선택</span>
          </label>
          <input
            id={`${prefix}-date`}
            name="acquiredAt"
            type="date"
            onInput={(e) => setAcquiredAt(e.currentTarget.value)}
            value={acquiredAt}
            onChange={(e) => setAcquiredAt(e.target.value)}
          />
          <label htmlFor={`${prefix}-status`}>식물 상태</label>
          <select
            id={`${prefix}-status`}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Plant['status'])}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor={`${prefix}-memo`}>
            식물 메모 <span>선택</span>
          </label>
          <textarea
            id={`${prefix}-memo`}
            name="memo"
            rows={4}
            maxLength={3000}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="이 식물과의 첫 이야기를 남겨 보세요."
          />
        </div>
      </fieldset>
      {processing && (
        <p role="status" className="field-hint">
          사진을 준비하고 있어요…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-submit-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={saving || processing}
          onClick={() => navigate(initial ? `/plants/${initial.id}` : '/')}
        >
          취소
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={saving || processing}
        >
          <Sprout aria-hidden="true" />
          {saving ? '저장 중…' : initial ? '수정 저장' : '식물 등록'}
        </button>
      </div>
    </form>
  )
}
