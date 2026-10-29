import { describe, expect, it } from 'vitest'
import {
  formatTimerRange,
  formatTimerUsage,
  parseTimerRecord,
} from './timer-record-display'
const memo =
  '식물등 타이머 자동 기록\n실제 누적 00:01:01\n시작 2026-10-29T09:31:05.181Z\n측정 종료 2026-10-29T09:32:09.957Z'
describe('타이머 기록 표시 전용 해석', () => {
  it('기존 다중행과 공백으로 합쳐진 메모를 해석한다', () => {
    expect(parseTimerRecord(memo)).toMatchObject({
      elapsedSeconds: 61,
      userMemo: '',
    })
    expect(parseTimerRecord(memo.replaceAll('\n', ' '))).toEqual(
      parseTimerRecord(memo),
    )
  })
  it('추가 사용자 메모와 그 안의 줄바꿈을 보존한다', () => {
    expect(
      parseTimerRecord(memo + '\n조명 위치 변경\n새잎 관찰')?.userMemo,
    ).toBe('조명 위치 변경\n새잎 관찰')
  })
  it.each([
    '일반 메모',
    '식물등 타이머 자동 기록',
    memo.replace('00:01:01', '00:99:01'),
    memo.replace('2026-10-29T09:31', '2026-02-31T09:31'),
    memo.replace('2026-10-29T09:32', '2026-10-28T09:32'),
    memo.replace('00:01:01', '999999999999999999:00:00'),
  ])('해석할 수 없는 메모를 거부해 원문 표시로 넘긴다: %s', (raw) => {
    expect(parseTimerRecord(raw)).toBeUndefined()
  })
  it('한국 시각과 다른 시간대로 변환한다', () => {
    const record = parseTimerRecord(memo)!
    expect(formatTimerRange(record, 'Asia/Seoul')).toBe('오후 6:31 ~ 오후 6:32')
    expect(formatTimerRange(record, 'America/New_York')).toBe(
      '오전 5:31 ~ 오전 5:32',
    )
    expect(formatTimerRange(record)).toBe(
      formatTimerRange(
        record,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    )
  })
  it('로컬 자정을 넘기는 경우 양쪽 날짜를 표시한다', () => {
    const record = {
      ...parseTimerRecord(memo)!,
      startedAt: '2026-10-29T14:59:00Z',
      endedAt: '2026-10-29T15:02:00Z',
    }
    expect(formatTimerRange(record, 'Asia/Seoul')).toBe(
      '10월 29일 오후 11:59 ~ 10월 30일 오전 12:02',
    )
    expect(formatTimerRange(record, 'UTC')).toBe('오후 2:59 ~ 오후 3:02')
  })
  it('다른 연도로 넘어가면 연도까지 구분한다', () => {
    const record = {
      ...parseTimerRecord(memo)!,
      startedAt: '2026-12-31T14:59:00Z',
      endedAt: '2026-12-31T15:02:00Z',
    }
    expect(formatTimerRange(record, 'Asia/Seoul')).toBe(
      '2026년 12월 31일 오후 11:59 ~ 2027년 1월 1일 오전 12:02',
    )
  })
  it.each([
    [0, '0초'],
    [61, '1분 1초'],
    [3600, '1시간'],
    [3661, '1시간 1분 1초'],
    [7200, '2시간'],
  ])('누적 %s초를 %s로 표시한다', (seconds, text) => {
    expect(formatTimerUsage(seconds as number)).toBe(text)
  })
})
