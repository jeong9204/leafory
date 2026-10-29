import {
  formatTimerRange,
  formatTimerUsage,
  parseTimerRecord,
} from '../../lib/timer-record-display'

export function TimerRecordDescription({ memo }: { memo: string }) {
  const record = parseTimerRecord(memo)
  if (!record) return <p>{memo}</p>
  return (
    <div className="timer-record-description">
      <span className="timer-record-badge">타이머 기록</span>
      <p className="timer-record-range">{formatTimerRange(record)}</p>
      <p>실제 사용 시간 {formatTimerUsage(record.elapsedSeconds)}</p>
      {record.userMemo && (
        <p className="timer-record-user-memo">{record.userMemo}</p>
      )}
      <details className="timer-record-details">
        <summary>원본 기록 보기</summary>
        <p>{memo}</p>
      </details>
    </div>
  )
}
