import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  cleanup,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { PlantTimeline } from './PlantTimeline'
import { renderApp, testDatabase } from '../../test/render-app'
import {
  exportBackup,
  prepareBackup,
  restoreBackup,
} from '../../app/backup-service'
import { loadPlant } from '../../app/plant-service'
const memo =
  '식물등 타이머 자동 기록\n실제 누적 00:01:01\n시작 2026-10-29T09:31:05.181Z\n측정 종료 2026-10-29T09:32:09.957Z\n새잎을 관찰했어요.\n조명 위치 변경'
const entry = {
  id: 'care:1',
  careEventId: '1',
  kind: 'light' as const,
  date: '2026-10-29',
  title: '식물등 1분',
  description: memo,
}
afterEach(cleanup)
describe('타이머 타임라인 표시', () => {
  it('배지와 실제 사용 시간을 표시하고 원문은 기본적으로 접는다', () => {
    render(<PlantTimeline entries={[entry]} />)
    expect(screen.getByRole('heading', { name: '식물등 1분' })).toBeVisible()
    expect(screen.getByText('타이머 기록')).toBeVisible()
    expect(screen.getByText('실제 사용 시간 1분 1초')).toBeVisible()
    expect(
      screen.getByText(/새잎을 관찰했어요/, {
        selector: '.timer-record-user-memo',
      }),
    ).toBeVisible()
    const raw = screen.getByText(/식물등 타이머 자동 기록/, {
      exact: false,
      selector: 'details p',
    })
    expect(raw).not.toBeVisible()
    const details = screen.getByText('원본 기록 보기').closest('details')!
    fireEvent.click(screen.getByText('원본 기록 보기'))
    expect(details).toHaveAttribute('open')
    expect(raw).toBeVisible()
    fireEvent.click(screen.getByText('원본 기록 보기'))
    expect(raw).not.toBeVisible()
  })
  it('수동 기록·일기·다른 관리 유형은 기존 메모 방식으로 유지한다', () => {
    render(
      <PlantTimeline
        entries={[
          { ...entry, id: 'manual', description: '조명을 옮겼어요.' },
          {
            ...entry,
            id: 'diary',
            careEventId: undefined,
            kind: 'growth',
            description: memo,
          },
          { ...entry, id: 'water', kind: 'watering', description: memo },
        ]}
      />,
    )
    expect(screen.getByText('조명을 옮겼어요.')).toBeVisible()
    expect(screen.queryByText('타이머 기록')).not.toBeInTheDocument()
  })
  it('해석 불가능한 타이머 메모는 숨기거나 삭제하지 않는다', () => {
    const raw = '식물등 타이머 자동 기록\n예전 형식의 원본 메모'
    render(<PlantTimeline entries={[{ ...entry, description: raw }]} />)
    expect(screen.getByText(/예전 형식의 원본 메모/)).toBeVisible()
    expect(screen.queryByText('원본 기록 보기')).not.toBeInTheDocument()
  })
  it('조회·백업·복원 후에도 원본 메모를 그대로 유지한다', async () => {
    const { db, repos } = testDatabase()
    try {
      const plant = await repos.plants.create({
        name: '초록이',
        status: 'healthy',
      })
      const event = await repos.careEvents.create({
        plantId: plant.id,
        eventType: 'grow_light',
        occurredAt: '2026-10-29T09:32:09.957Z',
        durationMinutes: 1,
        memo,
      })
      const view = await loadPlant(repos, plant.id)
      render(<PlantTimeline entries={view.entries} />)
      expect(screen.getByText('타이머 기록')).toBeVisible()
      expect((await repos.careEvents.getById(event.id))?.memo).toBe(memo)
      const backup = await prepareBackup((await exportBackup(repos)).blob)
      await restoreBackup(repos, backup)
      expect((await repos.careEvents.getById(event.id))?.memo).toBe(memo)
    } finally {
      await db.delete()
    }
  })
  it('기존 타이머 기록을 수정하고 삭제하며 표시를 갱신한다', async () => {
    const { db, repos } = testDatabase()
    try {
      const user = userEvent.setup()
      const plant = await repos.plants.create({
        name: '초록이',
        status: 'healthy',
      })
      const event = await repos.careEvents.create({
        plantId: plant.id,
        eventType: 'grow_light',
        occurredAt: '2026-10-29T09:32:09.957Z',
        durationMinutes: 1,
        memo,
      })
      renderApp(repos, `/plants/${plant.id}`)
      await user.click(
        await screen.findByRole('link', { name: '식물등 1분 기록 수정' }),
      )
      const field = await screen.findByRole('textbox', { name: /^메모/ })
      expect(field).toHaveValue(memo)
      await user.clear(field)
      await user.type(field, memo + '\n잎이 건강해요.')
      await user.click(screen.getByRole('button', { name: '기록 저장' }))
      await screen.findByText('실제 사용 시간 1분 1초')
      expect(
        screen.getByText(/잎이 건강해요/, {
          selector: '.timer-record-user-memo',
        }),
      ).toBeVisible()
      expect((await repos.careEvents.getById(event.id))?.memo).toBe(
        memo + '\n잎이 건강해요.',
      )
      await user.click(
        screen.getByRole('button', { name: '식물등 1분 기록 삭제' }),
      )
      const dialog = await screen.findByRole('dialog', {
        name: '관리 기록을 삭제할까요?',
      })
      await user.click(
        within(dialog).getByRole('button', { name: '기록 삭제' }),
      )
      await waitFor(() =>
        expect(screen.queryByText('타이머 기록')).not.toBeInTheDocument(),
      )
      expect(await repos.careEvents.getById(event.id)).toBeUndefined()
    } finally {
      cleanup()
      await db.delete()
    }
  })
})
