import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Sun } from 'lucide-react'
import { useRepositories } from '../../app/repository-context'
import { useRepositoryQuery } from '../../hooks/useRepositoryQuery'
import type { GrowLightTimer } from '../../domain/models'
import { RepositoryError } from '../../domain/errors'
import { timerDuration, timerElapsedMs } from '../../domain/light-timer'
import './light-timer.css'

type Confirmation = { timer: GrowLightTimer; mode: 'finish' | 'discard' }

export function LightTimerCard({ plantId }: { plantId: string }) {
  const { repositories, invalidate } = useRepositories()
  const query = useCallback(async () => {
    const timer = await repositories.lightTimer.get()
    const owner = timer
      ? await repositories.plants.getById(timer.plantId)
      : undefined
    return { timer, owner }
  }, [repositories])
  const { result, reload } = useRepositoryQuery(query)
  const [now, setNow] = useState(Date.now)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation>()
  const lock = useRef(false)
  const alive = useRef(true)
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const timer = result.status === 'success' ? result.data.timer : undefined
  const owned = timer?.plantId === plantId
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const clock = window.setInterval(tick, 1000)
    const refresh = window.setInterval(reload, 5000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(clock)
      window.clearInterval(refresh)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [reload])
  useEffect(() => {
    if (confirmation) {
      dialog.current?.showModal()
      cancel.current?.focus()
    } else dialog.current?.close()
  }, [confirmation])

  async function act(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      invalidate()
    } catch (cause) {
      if (alive.current) {
        setError(
          cause instanceof RepositoryError && cause.code !== 'STORAGE'
            ? cause.message
            : '저장하지 못했어요. 타이머 상태를 확인한 뒤 다시 시도해 주세요.',
        )
        if (cause instanceof RepositoryError && cause.code === 'CONFLICT')
          setConfirmation(undefined)
      }
    } finally {
      reload()
      if (alive.current) {
        setNow(Date.now())
        setBusy(false)
      }
      lock.current = false
    }
  }
  function transition(kind: 'pause' | 'resume' | 'finish' | 'discard') {
    if (!timer) return
    void act(async () => {
      if (kind === 'finish') {
        const paused = await repositories.lightTimer.pause(
          timer.sessionId,
          timer.revision,
        )
        if (alive.current) setConfirmation({ timer: paused, mode: 'finish' })
      } else if (kind === 'discard') {
        if (alive.current) setConfirmation({ timer, mode: 'discard' })
      } else
        await repositories.lightTimer[kind](timer.sessionId, timer.revision)
    })
  }
  function confirm() {
    if (!confirmation) return
    const { timer: saved, mode } = confirmation
    void act(async () => {
      if (mode === 'discard' || saved.accumulatedMs < 60000) {
        await repositories.lightTimer.discard(saved.sessionId, saved.revision)
        if (alive.current) setNotice('기록 없이 타이머를 종료했어요.')
      } else {
        const event = await repositories.lightTimer.finish(
          saved.sessionId,
          saved.revision,
        )
        if (alive.current)
          setNotice(`식물등 ${event.durationMinutes}분을 기록했어요.`)
      }
      if (alive.current) setConfirmation(undefined)
    })
  }
  const disabled = busy || Boolean(confirmation)
  return (
    <section
      className="light-timer-card surface"
      aria-label="식물등 타이머"
      aria-busy={busy}
    >
      <div className="light-timer-heading">
        <h2>
          <Sun aria-hidden="true" />
          식물등 타이머
        </h2>
        <span>
          {timer
            ? timer.status === 'running'
              ? '실행 중'
              : '일시정지'
            : '대기'}
        </span>
      </div>
      {result.status === 'loading' ? (
        <p role="status">타이머를 불러오는 중이에요…</p>
      ) : result.status === 'error' ? (
        <>
          <p role="alert">타이머를 불러오지 못했어요.</p>
          <button type="button" onClick={reload} className="secondary-button">
            타이머 다시 불러오기
          </button>
        </>
      ) : timer && !owned ? (
        <>
          <p className="light-timer-help">
            {result.data.owner?.name ?? '다른 식물'}에서 타이머를 사용 중이에요.
            한 번에 하나만 측정할 수 있어요.
          </p>
          <Link className="secondary-button" to={`/plants/${timer.plantId}`}>
            타이머 식물로 이동
          </Link>
        </>
      ) : (
        <>
          <output
            className="light-timer-clock"
            aria-label="식물등 누적 사용 시간"
            aria-live="off"
          >
            {timerDuration(timer ? timerElapsedMs(timer, now) : 0)}
          </output>
          <p className="light-timer-help">
            {timer
              ? '종료 후 확인해야 완료 기록과 통계에 반영돼요.'
              : '앱을 닫아도 경과 시간을 복구해요. 실제 조명을 제어하는 기능은 아니에요.'}
          </p>
          <div className="light-timer-actions">
            {!timer ? (
              <button
                type="button"
                className="primary-button"
                disabled={disabled}
                onClick={() =>
                  void act(async () => {
                    await repositories.lightTimer.start(plantId)
                  })
                }
              >
                타이머 시작
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={disabled}
                  onClick={() =>
                    transition(timer.status === 'running' ? 'pause' : 'resume')
                  }
                >
                  {timer.status === 'running' ? '일시정지' : '재개'}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={disabled}
                  onClick={() => transition('finish')}
                >
                  종료
                </button>
              </>
            )}
          </div>
          {timer && (
            <button
              type="button"
              className="light-timer-discard"
              disabled={disabled}
              onClick={() => transition('discard')}
            >
              기록 없이 취소
            </button>
          )}
        </>
      )}
      {notice && (
        <p role="status" className="light-timer-help">
          {notice}
        </p>
      )}
      {errorMessage && !confirmation && (
        <p role="alert" className="form-error">
          {errorMessage}
        </p>
      )}
      <dialog
        ref={dialog}
        className="delete-dialog light-timer-dialog"
        aria-labelledby="light-timer-confirm-title"
        onCancel={(event) => {
          if (busy) event.preventDefault()
          else setConfirmation(undefined)
        }}
        onClose={() => {
          if (!lock.current) setConfirmation(undefined)
        }}
      >
        <h2 id="light-timer-confirm-title">
          {confirmation?.mode === 'discard'
            ? '기록 없이 취소할까요?'
            : '식물등 사용 시간을 기록할까요?'}
        </h2>
        {confirmation && (
          <>
            <p className="light-timer-confirm-time">
              {timerDuration(timerElapsedMs(confirmation.timer, now))}
            </p>
            <p>
              {confirmation.mode === 'discard'
                ? '누적 시간은 관리 기록에 저장되지 않아요.'
                : confirmation.timer.accumulatedMs < 60000
                  ? '1분 미만은 관리 기록을 만들지 않고 타이머만 종료해요.'
                  : `${Math.floor(confirmation.timer.accumulatedMs / 60000)}분을 측정을 멈춘 날짜에 기록해요. 분 미만은 버리고 실제 초 단위 시간은 메모에 남겨요.`}
            </p>
            {confirmation.mode === 'finish' && (
              <p>
                측정을 멈춘 시각:{' '}
                {new Date(confirmation.timer.updatedAt).toLocaleString('ko-KR')}
                <br />
                취소하면 일시정지 상태로 남아요. 계속 측정하려면 재개를 눌러
                주세요.
              </p>
            )}
          </>
        )}
        {errorMessage && confirmation && (
          <p role="alert" className="form-error">
            {errorMessage}
          </p>
        )}
        <div>
          <button
            ref={cancel}
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => setConfirmation(undefined)}
          >
            돌아가기
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={confirm}
          >
            {busy
              ? '저장 중…'
              : confirmation?.mode === 'discard' ||
                  (confirmation?.timer.accumulatedMs ?? 0) < 60000
                ? '기록 없이 종료'
                : '기록하고 종료'}
          </button>
        </div>
      </dialog>
    </section>
  )
}
