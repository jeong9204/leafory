import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ChevronLeft, Download, Upload, Archive } from 'lucide-react'
import { Link } from 'react-router'
import { useRepositories } from '../app/repository-context'
import {
  backupErrorMessage,
  exportBackup,
  prepareBackup,
  restoreBackup,
} from '../app/backup-service'
import type { PreparedBackup } from '../app/backup-service'
import type { DataCounts } from '../domain/backup'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { DataFeedback } from '../components/plants/DataFeedback'
import './backup.css'

function Counts({ counts }: { counts: DataCounts }) {
  return (
    <dl className="backup-counts">
      {(
        [
          ['plants', '식물'],
          ['diaries', '일기'],
          ['photos', '사진'],
          ['careEvents', '관리 기록'],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>
            {counts[key]}
            <span>개</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
function DownloadBackup({
  file,
}: {
  file: Awaited<ReturnType<typeof exportBackup>>
}) {
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file.blob)
    if (link.current) link.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [file.blob])
  return (
    <div className="backup-download">
      <p role="status">
        백업 파일을 만들었어요. 아래 버튼으로 기기에 저장해 주세요.
      </p>
      <a ref={link} download={file.filename} className="primary-button">
        <Download aria-hidden="true" />
        ZIP 다운로드
      </a>
      <p className="field-hint">
        다운로드가 끝났는지 파일 앱에서 확인해 주세요.
      </p>
    </div>
  )
}
export function BackupPage() {
  const { repositories, invalidate } = useRepositories()
  const query = useCallback(() => repositories.backup.counts(), [repositories])
  const { result, reload } = useRepositoryQuery(query)
  const [file, setFile] = useState<Awaited<ReturnType<typeof exportBackup>>>()
  const [prepared, setPrepared] = useState<PreparedBackup>()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [open, setOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [current, setCurrent] = useState<DataCounts>()
  const [capacity, setCapacity] = useState('')
  const [filename, setFilename] = useState('')
  const lock = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const restoreButton = useRef<HTMLButtonElement>(null)
  const { guard } = useUnsavedChanges(false, Boolean(busy))
  useEffect(() => {
    if (open) {
      dialog.current?.showModal()
      cancel.current?.focus()
    } else dialog.current?.close()
  }, [open])
  async function makeBackup() {
    if (lock.current) return
    lock.current = true
    setBusy('백업 파일을 만들고 있어요…')
    setError('')
    setSuccess('')
    try {
      setFile(await exportBackup(repositories))
    } catch (cause) {
      setError(backupErrorMessage(cause))
    } finally {
      lock.current = false
      setBusy('')
    }
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!selected || lock.current) return
    lock.current = true
    setBusy('백업 파일을 검증하고 있어요…')
    setError('')
    setSuccess('')
    setPrepared(undefined)
    setFilename('')
    try {
      setPrepared(await prepareBackup(selected))
      setFilename(selected.name)
    } catch (cause) {
      setError(backupErrorMessage(cause))
    } finally {
      lock.current = false
      setBusy('')
    }
  }
  async function confirmRestore() {
    if (!prepared || lock.current) return
    lock.current = true
    setBusy('현재 데이터와 저장 공간을 확인하고 있어요…')
    setError('')
    setCapacity('')
    setAgree(false)
    try {
      setCurrent(await repositories.backup.counts())
      try {
        const estimate = await navigator.storage?.estimate?.()
        if (
          estimate?.quota !== undefined &&
          estimate.usage !== undefined &&
          estimate.quota - estimate.usage < prepared.sizeBytes * 1.5
        )
          setCapacity(
            '남은 저장 공간이 부족할 수 있어요. 공간을 확보한 뒤 복원하는 것을 권장해요. 공간 추정치는 정확한 보장이 아니에요.',
          )
      } catch {
        /* Capacity estimation is optional; IndexedDB failures still roll back. */
      }
      setOpen(true)
    } catch (cause) {
      setError(backupErrorMessage(cause))
    } finally {
      lock.current = false
      setBusy('')
    }
  }
  function close() {
    if (lock.current) return
    setOpen(false)
    restoreButton.current?.focus()
  }
  async function replace() {
    if (!prepared || !agree || lock.current) return
    lock.current = true
    setBusy('데이터를 복원하고 있어요…')
    setError('')
    setSuccess('')
    try {
      await restoreBackup(repositories, prepared)
      invalidate()
      setOpen(false)
      setPrepared(undefined)
      setFilename('')
      setSuccess('복원을 완료했어요. 식물과 모든 기록을 확인해 주세요.')
      restoreButton.current?.focus()
    } catch (cause) {
      setOpen(false)
      setError(backupErrorMessage(cause))
    } finally {
      lock.current = false
      setBusy('')
    }
  }
  return (
    <div className="plant-editor-page backup-page">
      <header className="editor-header">
        <Link to="/" aria-label="홈으로 돌아가기">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div>
          <h1>데이터 백업</h1>
          <p>소중한 초록빛 기록을 안전하게 보관해요.</p>
        </div>
      </header>
      {guard}
      <section className="backup-card surface" aria-labelledby="backup-current">
        <h2 id="backup-current">
          <Archive aria-hidden="true" />이 기기의 기록
        </h2>
        {result.status === 'success' ? (
          <Counts counts={result.data} />
        ) : (
          <DataFeedback error={result.status === 'error'} retry={reload} />
        )}
      </section>
      <section className="backup-card surface" aria-labelledby="backup-export">
        <h2 id="backup-export">
          <Download aria-hidden="true" />
          내보내기
        </h2>
        <p>
          전체 식물·일기·사진·관리 기록을 ZIP 파일로 만들어요. 백업은 암호화되지
          않으니 안전한 곳에 보관해 주세요.
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={Boolean(busy)}
          onClick={makeBackup}
        >
          백업 파일 만들기
        </button>
        {file && <DownloadBackup file={file} />}
      </section>
      <section className="backup-card surface" aria-labelledby="backup-import">
        <h2 id="backup-import">
          <Upload aria-hidden="true" />
          가져오기
        </h2>
        <p>
          Leafory 백업 ZIP을 선택하면 먼저 파일을 검증해요. 현재는{' '}
          <strong>전체 교체</strong>만 지원해요. 기존 기록과 합쳐지지 않아요.
        </p>
        <p className="backup-risk">
          복원 전 위의 내보내기로 현재 데이터를 먼저 백업하는 것을 권장해요.
        </p>
        <button
          type="button"
          className="secondary-button"
          disabled={Boolean(busy)}
          onClick={() => input.current?.click()}
        >
          백업 ZIP 선택
        </button>
        <input
          ref={input}
          type="file"
          className="sr-only"
          accept=".zip,application/zip,application/x-zip-compressed"
          aria-label="복원할 백업 ZIP 선택"
          disabled={Boolean(busy)}
          onChange={selectFile}
        />
        {prepared && (
          <div className="backup-preview">
            <h3>검증 완료</h3>
            <p className="backup-filename">{filename}</p>
            <p>
              백업 생성:{' '}
              <time dateTime={prepared.createdAt}>
                {new Date(prepared.createdAt).toLocaleString('ko-KR')}
              </time>
            </p>
            <Counts counts={prepared.counts} />
            <button
              ref={restoreButton}
              type="button"
              className="primary-button"
              disabled={Boolean(busy) || result.status !== 'success'}
              onClick={confirmRestore}
            >
              복원 내용 확인
            </button>
          </div>
        )}
      </section>
      {busy && (
        <p role="status" className="backup-message">
          {busy} 화면을 닫지 말아 주세요.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="backup-message">
          {success}
        </p>
      )}
      <p className="field-hint">
        ZIP 및 압축 해제 데이터 최대 100MiB · 사진 장당 최대 15MiB
        <br />이 기기의 로컬 데이터만 백업해요.
      </p>
      <dialog
        ref={dialog}
        className="delete-dialog backup-confirm"
        aria-labelledby="backup-confirm-title"
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
      >
        <h2 id="backup-confirm-title">현재 데이터를 전체 교체할까요?</h2>
        <p>
          이 기기의 식물·일기·사진·관리 기록이 모두 삭제되고 선택한 백업의
          데이터로 바뀌어요. 이 작업은 되돌릴 수 없어요.
        </p>
        {current && (
          <p>
            현재: 식물 {current.plants}개 · 일기 {current.diaries}개 · 사진{' '}
            {current.photos}개 · 관리 기록 {current.careEvents}개
          </p>
        )}
        <p>
          아직 현재 데이터를 백업하지 않았다면 취소한 뒤 먼저 내보내기를 실행해
          주세요.
        </p>
        {capacity && <p className="backup-risk">{capacity}</p>}
        <label className="backup-agreement">
          <input
            type="checkbox"
            checked={agree}
            disabled={Boolean(busy)}
            onChange={(e) => setAgree(e.target.checked)}
          />
          기존 데이터가 사라지고 전체 교체되는 것을 이해했어요.
        </label>
        <div>
          <button
            ref={cancel}
            type="button"
            className="secondary-button"
            disabled={Boolean(busy)}
            onClick={close}
          >
            취소
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={!agree || Boolean(busy)}
            onClick={replace}
          >
            {busy ? '복원 중…' : '전체 교체 복원'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
