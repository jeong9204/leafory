import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteDiary } from '../../app/diary-service'
import { useNavigate } from 'react-router'
import { useRepositories } from '../../app/repository-context'

export function DeleteDiaryButton({
  plantId,
  entryId,
  title,
}: {
  plantId: string
  entryId: string
  title: string
}) {
  const { repositories, invalidate } = useRepositories()
  const navigate = useNavigate()
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
      await deleteDiary(repositories, plantId, entryId)
      invalidate()
      setOpen(false)
      navigate(`/plants/${plantId}`, { replace: true })
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
        aria-label="일기 삭제"
        className="secondary-button"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        <Trash2 aria-hidden="true" />
        <span>일기 삭제</span>
      </button>
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby={`delete-diary-${entryId}`}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
      >
        <h2 id={`delete-diary-${entryId}`}>일기를 삭제할까요?</h2>
        <p>
          {title} 일기와 연결 사진만 삭제돼요. 물주기·식물등 등 별도 관리 기록은
          유지돼요. 삭제한 일기는 복원할 수 없어요.
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
            {busy ? '삭제 중…' : '삭제할게요'}
          </button>
        </div>
      </dialog>
    </>
  )
}
