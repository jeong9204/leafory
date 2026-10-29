import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Plant } from '../../domain/models'
import { useRepositories } from '../../app/repository-context'
import { RepositoryError } from '../../domain/errors'
export function DeletePlantDialog({
  plant,
  open,
  onClose,
}: {
  plant: Plant
  open: boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const lock = useRef(false)
  const alive = useRef(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { repositories, invalidate } = useRepositories()
  const navigate = useNavigate()
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (open) {
      dialog.current?.showModal()
      cancel.current?.focus()
    } else dialog.current?.close()
  }, [open])
  async function remove() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await repositories.plants.delete(plant.id)
      invalidate()
      if (alive.current) navigate('/', { replace: true })
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof RepositoryError && cause.code === 'CONFLICT'
            ? cause.message
            : '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
        )
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="delete-dialog"
      onClose={onClose}
      aria-labelledby="delete-plant-title"
      aria-describedby="delete-plant-description"
      onCancel={(event) => {
        if (busy) event.preventDefault()
        else onClose()
      }}
    >
      <h2 id="delete-plant-title">{plant.name}을(를) 삭제할까요?</h2>
      <p id="delete-plant-description">
        식물의 사진과 연결된 모든 기록이 함께 삭제돼요. 삭제 후에는 되돌릴 수
        없어요.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button
          ref={cancel}
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="danger-button"
          disabled={busy}
          onClick={remove}
        >
          {busy ? '삭제 중…' : '삭제할게요'}
        </button>
      </div>
    </dialog>
  )
}
