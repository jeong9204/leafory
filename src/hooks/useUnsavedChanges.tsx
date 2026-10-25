import { useCallback, useEffect, useRef } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

/** Covers router links/back and browser reload/close; successful saves bypass it. */
export function useUnsavedChanges(dirty: boolean, saving = false) {
  const saved = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const stay = useRef<HTMLButtonElement>(null)
  const blocker = useBlocker(() => !saved.current && (dirty || saving))
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!saved.current && (dirty || saving)) {
          event.preventDefault()
          event.returnValue = ''
        }
      },
      [dirty, saving],
    ),
  )
  const blocked = blocker.state === 'blocked'
  useEffect(() => {
    if (blocked) {
      dialog.current?.showModal()
      stay.current?.focus()
    } else dialog.current?.close()
  }, [blocked])
  return {
    allowNavigation: () => {
      saved.current = true
    },
    guard: (
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby="unsaved-heading"
        onCancel={(event) => {
          event.preventDefault()
          blocker.reset?.()
        }}
      >
        <h2 id="unsaved-heading">작성을 그만둘까요?</h2>
        <p>
          {saving
            ? '저장 중이에요. 완료될 때까지 기다려 주세요.'
            : '저장하지 않은 내용은 사라져요.'}
        </p>
        <div>
          <button
            ref={stay}
            type="button"
            className="secondary-button"
            onClick={() => blocker.reset?.()}
          >
            계속 작성
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={saving}
            onClick={() => blocker.proceed?.()}
          >
            나가기
          </button>
        </div>
      </dialog>
    ),
  }
}
