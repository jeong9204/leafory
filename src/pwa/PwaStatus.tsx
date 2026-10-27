import { useEffect, useRef, useState } from 'react'
import './pwa.css'

export function PwaStatus({ canUpdate }: { canUpdate: boolean }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [ready, setReady] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [changed, setChanged] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const reloadRequested = useRef(false)
  useEffect(() => {
    const onlineChanged = () => setOnline(navigator.onLine)
    window.addEventListener('online', onlineChanged)
    window.addEventListener('offline', onlineChanged)
    if (
      !import.meta.env.PROD ||
      !window.isSecureContext ||
      !('serviceWorker' in navigator)
    ) {
      return () => {
        window.removeEventListener('online', onlineChanged)
        window.removeEventListener('offline', onlineChanged)
      }
    }
    const serviceWorker = navigator.serviceWorker
    let alive = true
    let registration: ServiceWorkerRegistration | undefined
    let hadController = Boolean(serviceWorker.controller)
    const onController = () => {
      if (reloadRequested.current) {
        window.location.reload()
        return
      }
      if (hadController) {
        setChanged(true)
        setWaiting(null)
      }
      hadController = true
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_BLOCKED') {
        reloadRequested.current = false
        setApplying(false)
        setError('다른 Leafory 창을 닫은 뒤 다시 눌러 주세요.')
      }
    }
    const inspect = () => {
      if (!alive || !registration) return
      if (registration.waiting) setWaiting(registration.waiting)
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (alive && worker.state === 'redundant')
          setError(
            '오프라인 준비를 마치지 못했어요. 연결과 저장 공간을 확인한 뒤 다시 열어 주세요.',
          )
        if (alive && worker.state === 'installed' && serviceWorker.controller)
          setWaiting(worker)
      })
    }
    const check = () => {
      if (navigator.onLine) void registration?.update().catch(() => {})
    }
    serviceWorker.addEventListener('controllerchange', onController)
    serviceWorker.addEventListener('message', onMessage)
    void serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        if (!alive) return
        registration = reg
        inspect()
        reg.addEventListener('updatefound', inspect)
        void serviceWorker.ready.then(() => {
          if (alive) setReady(true)
        })
        check()
      })
      .catch(() => {
        if (alive)
          setError(
            '오프라인 준비를 마치지 못했어요. 인터넷 연결 후 앱을 다시 열어 주세요.',
          )
      })
    window.addEventListener('focus', check)
    const timer = window.setInterval(check, 60 * 60 * 1000)
    return () => {
      alive = false
      window.removeEventListener('online', onlineChanged)
      window.removeEventListener('offline', onlineChanged)
      window.removeEventListener('focus', check)
      window.clearInterval(timer)
      registration?.removeEventListener('updatefound', inspect)
      serviceWorker.removeEventListener('controllerchange', onController)
      serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])
  if (online && !waiting && !changed && !error) return null
  return (
    <aside className="pwa-status" aria-label="앱 연결 및 업데이트">
      {!online && (
        <p role="status">
          {ready
            ? '오프라인이에요. 필요한 앱 파일이 저장돼 있으면 이 기기의 기록·캘린더·백업을 사용할 수 있어요. 사진 선택·파일 저장은 기기 지원에 따라 달라요. 외부 출처와 업데이트는 연결 후 이용해 주세요.'
            : '오프라인이에요. 아직 준비되지 않은 화면은 열리지 않을 수 있어요. 인터넷 연결 후 다시 열어 주세요.'}
        </p>
      )}
      {(waiting || changed) && (
        <div>
          <p>
            새 Leafory가 준비됐어요.{' '}
            {canUpdate
              ? '저장된 기록은 유지돼요.'
              : '작성 내용을 저장하고 이 화면을 나온 뒤 업데이트해 주세요.'}
          </p>
          <button
            type="button"
            disabled={!canUpdate || applying}
            onClick={() => {
              setError('')
              setApplying(true)
              if (changed) {
                window.location.reload()
                return
              }
              reloadRequested.current = true
              waiting?.postMessage({ type: 'ACTIVATE_UPDATE' })
            }}
          >
            {applying ? '업데이트 중…' : '업데이트 적용'}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  )
}
