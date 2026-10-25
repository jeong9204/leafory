import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteCare } from '../../app/care-service'
import { useRepositories } from '../../app/repository-context'

export function DeleteCareButton({
  plantId,
  eventId,
  title,
}: {
  plantId: string
  eventId: string
  title: string
}) {
  const { repositories, invalidate } = useRepositories()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) {
      dialog.current?.showModal()
      cancel.current?.focus()
    } else dialog.current?.close()
  }, [open])
  function close() {
    if (lock.current) return
    setOpen(false)
    trigger.current?.focus()
  }
  async function remove() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await deleteCare(repositories, plantId, eventId)
      invalidate()
      setOpen(false)
    } catch {
      setError('삭제하지 못했어요. 다시 시도해 주세요.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`${title} 기록 삭제`}
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        <Trash2 aria-hidden="true" />
        <span>삭제</span>
      </button>
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby={`delete-care-${eventId}`}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
      >
        <h2 id={`delete-care-${eventId}`}>관리 기록을 삭제할까요?</h2>
        <p>
          {title} 기록이 삭제되고 통계가 다시 계산돼요. 삭제한 기록은 복원할 수
          없어요.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div>
          <button
            ref={cancel}
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={close}
          >
            취소
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={busy}
            onClick={remove}
          >
            {busy ? '삭제 중…' : '기록 삭제'}
          </button>
        </div>
      </dialog>
    </>
  )
}
