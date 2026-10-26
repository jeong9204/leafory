import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Trash2 } from 'lucide-react'
import type { DiaryPhotoDraft } from '../../app/diary-service'
import { MAX_DIARY_PHOTOS } from '../../app/diary-service'
import { preparePlantPhoto, validatePhotoFile } from '../../lib/plant-photo'
import { PlantPhoto } from '../plants/PlantPhoto'

export function DiaryPhotos({
  photos,
  onChange,
  processing,
  onProcessing,
  error,
  onError,
}: {
  photos: DiaryPhotoDraft[]
  onChange: (photos: DiaryPhotoDraft[]) => void
  processing: boolean
  onProcessing: (value: boolean) => void
  error: string
  onError: (message: string) => void
}) {
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!files.length || lock.current) return
    lock.current = true
    onProcessing(true)
    onError('')
    try {
      if (photos.length + files.length > MAX_DIARY_PHOTOS)
        throw new Error('사진은 최대 10장까지 첨부할 수 있어요.')
      files.forEach(validatePhotoFile)
      const added: DiaryPhotoDraft[] = []
      // Decode sequentially to avoid holding several full-resolution bitmaps in memory.
      for (const file of files)
        added.push({
          ...(await preparePlantPhoto(file)),
          key: crypto.randomUUID(),
        })
      onChange([...photos, ...added])
    } catch (cause) {
      onError(
        cause instanceof Error ? cause.message : '사진을 처리하지 못했어요.',
      )
    } finally {
      lock.current = false
      onProcessing(false)
    }
  }
  function move(index: number, delta: number) {
    const next = [...photos]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    onChange(next)
  }
  return (
    <section
      className="editor-photo-section surface diary-photo-section"
      aria-labelledby="diary-photos-heading"
    >
      <h2 id="diary-photos-heading">
        오늘의 사진 <span>선택 · {photos.length}/10장</span>
      </h2>
      <p className="field-hint">첫 번째 사진이 타임라인에 표시돼요.</p>
      {photos.length ? (
        <ol className="diary-photo-list" aria-label="첨부 사진 순서">
          {photos.map((photo, index) => (
            <li key={photo.key}>
              <PlantPhoto
                blob={photo.blob}
                alt={`첨부 사진 ${index + 1}`}
                className="diary-photo-preview"
                width={150}
                height={150}
              />
              <span className="diary-photo-number">
                {index + 1}
                {index === 0 ? ' · 첫 사진' : ''}
              </span>
              <div className="diary-photo-controls">
                <button
                  type="button"
                  aria-label={`사진 ${index + 1} 앞으로 이동`}
                  disabled={index === 0 || processing}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`사진 ${index + 1} 뒤로 이동`}
                  disabled={index === photos.length - 1 || processing}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`사진 ${index + 1} 삭제`}
                  disabled={processing}
                  onClick={() =>
                    onChange(photos.filter((p) => p.key !== photo.key))
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="diary-photo-empty">작은 변화를 사진으로 남겨 보세요.</p>
      )}
      <div className="editor-photo-actions">
        <button
          type="button"
          disabled={processing || photos.length >= MAX_DIARY_PHOTOS}
          onClick={() => camera.current?.click()}
        >
          <Camera aria-hidden="true" />
          사진 촬영
        </button>
        <button
          type="button"
          disabled={processing || photos.length >= MAX_DIARY_PHOTOS}
          onClick={() => gallery.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          사진 선택
        </button>
      </div>
      <input
        ref={camera}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="카메라로 일기 사진 선택"
        onChange={choose}
      />
      <input
        ref={gallery}
        className="sr-only"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="일기 사진 여러 장 선택"
        onChange={choose}
      />
      <p className="field-hint">
        JPEG · PNG · WebP, 장당 15MB 이하
        <br />
        사진은 이 기기에 저장돼요.
      </p>
      {processing && (
        <p role="status" className="field-hint">
          사진을 준비하고 있어요…
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  )
}
