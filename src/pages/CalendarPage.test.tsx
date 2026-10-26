import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'
import { localDateKey } from '../domain/calendar'
let context: ReturnType<typeof testDatabase>
let plantId: string
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({ name: '초록이', status: 'healthy' })
  ).id
})
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
const day = (day: number) =>
  screen.getByRole('button', { name: new RegExp(`2026년 1월 ${day}일 `) })
async function open(date = '2026-01-02') {
  renderApp(context.repos, `/calendar?date=${date}`)
  await screen.findByRole('heading', { name: '관리 캘린더' })
}

describe('관리 캘린더 화면', () => {
  it('하단 탭으로 진입하며 활성 상태와 기록 없는 날짜를 표시한다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos)
    await user.click(await screen.findByRole('link', { name: '캘린더' }))
    await screen.findByRole('heading', { name: '관리 캘린더' })
    expect(screen.getByRole('link', { name: '캘린더' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('이날은 아직 기록이 없어요')).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: '기록 유형 범례' }).children,
    ).toHaveLength(5)
  })
  it('같은 날짜의 5개 유형 점과 여러 기록, 식물등 분 수를 표시하고 식물 필터를 적용한다', async () => {
    const user = userEvent.setup()
    for (const eventType of [
      'watering',
      'grow_light',
      'repotting',
      'fertilizing',
    ] as const)
      await context.repos.careEvents.create({
        plantId,
        eventType,
        occurredAt: new Date(2026, 0, 2, 12).toISOString(),
        ...(eventType === 'grow_light' ? { durationMinutes: 75 } : {}),
      })
    const other = await context.repos.plants.create({
      name: '몬스테라',
      status: 'healthy',
    })
    await context.repos.diaries.create({
      plantId: other.id,
      entryDate: '2026-01-02',
      condition: 'good',
      title: '작은 새잎',
    })
    await open()
    expect(day(2)).toHaveAccessibleName(
      /물주기 1건, 식물등 1건, 분갈이 1건, 비료 1건, 사진 일기 1건/,
    )
    expect(day(2).querySelectorAll('.calendar-dot')).toHaveLength(5)
    expect(
      screen.getByRole('list', { name: '선택 날짜의 기록' }).children,
    ).toHaveLength(5)
    expect(screen.getByText('사용 시간 1시간 15분')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('함께하는 식물'), other.id)
    expect(day(2)).toHaveAccessibleName(/사진 일기 1건/)
    expect(day(2)).not.toHaveAccessibleName(/물주기/)
    expect(
      screen.getByRole('list', { name: '선택 날짜의 기록' }).children,
    ).toHaveLength(1)
    await user.click(day(3))
    expect(screen.getByText('이날은 아직 기록이 없어요')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('함께하는 식물'), '')
    await user.click(day(2))
    expect(
      screen.getByRole('list', { name: '선택 날짜의 기록' }).children,
    ).toHaveLength(5)
  })
  it('월 이동·연도 경계·오늘 이동과 키보드 날짜 탐색을 지원한다', async () => {
    const user = userEvent.setup()
    await open('2026-12-31')
    await user.click(screen.getByRole('button', { name: '다음 달' }))
    expect(
      screen.getByRole('heading', { name: '2027년 1월' }),
    ).toBeInTheDocument()
    const selected = screen.getByRole('button', { pressed: true })
    expect(selected).toHaveAccessibleName(/2027년 1월 31일/)
    selected.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { pressed: true })).toHaveAccessibleName(
      /2027년 2월 1일/,
    )
    expect(screen.getByRole('button', { pressed: true })).toHaveFocus()
    await user.keyboard('{PageUp}')
    expect(screen.getByRole('button', { pressed: true })).toHaveAccessibleName(
      /2027년 1월 1일/,
    )
    await user.click(screen.getByRole('button', { name: '오늘' }))
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute(
      'data-date',
      localDateKey(),
    )
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })
  it('일기는 상세로, 관리 이벤트는 기존 수정 화면으로 이동한다', async () => {
    const user = userEvent.setup()
    await context.repos.diaries.create({
      plantId,
      entryDate: '2026-01-02',
      condition: 'good',
      title: '새잎 확인',
    })
    const event = await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date(2026, 0, 2, 12).toISOString(),
    })
    await open()
    const list = screen.getByRole('list', { name: '선택 날짜의 기록' })
    expect(within(list).getByRole('link', { name: /물주기/ })).toHaveAttribute(
      'href',
      `/plants/${plantId}/care/${event.id}/edit`,
    )
    await user.click(within(list).getByRole('link', { name: /새잎 확인/ }))
    expect(
      await screen.findByRole('heading', { name: '새잎 확인', level: 1 }),
    ).toBeInTheDocument()
  })
  it('재조회로 생성·수정·삭제 후 점·선택 목록·월 건수를 갱신한다', async () => {
    await open()
    const event = await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date(2026, 0, 2, 12).toISOString(),
    })
    fireEvent.focus(window)
    await waitFor(() => expect(day(2)).toHaveAccessibleName(/물주기 1건/))
    await context.repos.careEvents.update(event.id, {
      eventType: 'fertilizing',
      occurredAt: new Date(2026, 0, 3, 12).toISOString(),
    })
    fireEvent.focus(window)
    await waitFor(() => expect(day(2)).toHaveAccessibleName(/기록 없음/))
    expect(day(3)).toHaveAccessibleName(/비료 1건/)
    const user = userEvent.setup()
    await user.click(day(3))
    expect(
      screen.getByRole('list', { name: '선택 날짜의 기록' }).children,
    ).toHaveLength(1)
    await context.repos.careEvents.delete(event.id)
    fireEvent.focus(window)
    await waitFor(() => expect(day(3)).toHaveAccessibleName(/기록 없음/))
    expect(screen.getByText('이날은 아직 기록이 없어요')).toBeInTheDocument()
    expect(screen.getByText('0개')).toBeInTheDocument()
  })
  it('기존 관리 폼 저장의 invalidate 후 캘린더에 수정 내용을 표시한다', async () => {
    const user = userEvent.setup()
    const date = localDateKey()
    const event = await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date().toISOString(),
    })
    await open(date)
    await user.click(
      within(screen.getByRole('list', { name: '선택 날짜의 기록' })).getByRole(
        'link',
        { name: /물주기/ },
      ),
    )
    await screen.findByRole('heading', { name: '관리 기록 수정' })
    await user.selectOptions(screen.getByLabelText('관리 종류'), 'fertilizing')
    await user.click(screen.getByRole('button', { name: '기록 저장' }))
    await screen.findByRole('heading', { name: '초록이', level: 1 })
    await user.click(screen.getByRole('link', { name: '캘린더' }))
    await screen.findByRole('heading', { name: '관리 캘린더' })
    expect(screen.getByRole('button', { pressed: true })).toHaveAccessibleName(
      /비료 1건/,
    )
    expect((await context.repos.careEvents.getById(event.id))?.eventType).toBe(
      'fertilizing',
    )
  })
  it('잘못된 날짜/삭제된 필터는 안전하게 대체하고 저장 오류 시 재시도할 수 있다', async () => {
    const user = userEvent.setup()
    vi.spyOn(context.repos.plants, 'list').mockRejectedValueOnce(
      new Error('read fail'),
    )
    renderApp(context.repos, '/calendar?date=invalid&plant=removed')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('heading', { name: '관리 캘린더' })
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute(
      'data-date',
      localDateKey(),
    )
    expect(screen.getByLabelText('함께하는 식물')).toHaveValue('')
  })
  it('같은 날 같은 유형의 여러 기록은 점 하나와 실제 건수로 표시한다', async () => {
    for (let index = 0; index < 2; index++)
      await context.repos.careEvents.create({
        plantId,
        eventType: 'watering',
        occurredAt: new Date(2026, 0, 2, 12, index).toISOString(),
      })
    await open()
    expect(day(2)).toHaveAccessibleName(/물주기 2건/)
    expect(day(2).querySelectorAll('.calendar-dot')).toHaveLength(1)
    expect(
      screen.getByRole('list', { name: '선택 날짜의 기록' }).children,
    ).toHaveLength(2)
  })
  it('기존 일기 상세에서 삭제하면 캘린더의 점·목록에서 빠지고 관리 이벤트는 남는다', async () => {
    const user = userEvent.setup()
    const entry = await context.repos.diaries.create({
      plantId,
      entryDate: localDateKey(),
      condition: 'normal',
      title: '삭제할 검증 일기',
    })
    await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date().toISOString(),
    })
    await open(localDateKey())
    await user.click(
      within(screen.getByRole('list', { name: '선택 날짜의 기록' })).getByRole(
        'link',
        { name: /삭제할 검증 일기/ },
      ),
    )
    await screen.findByRole('heading', { name: '삭제할 검증 일기', level: 1 })
    await user.click(screen.getByRole('button', { name: '일기 삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제할게요' }))
    await screen.findByRole('heading', { name: '초록이', level: 1 })
    await user.click(screen.getByRole('link', { name: '캘린더' }))
    await screen.findByRole('heading', { name: '관리 캘린더' })
    expect(screen.getByRole('button', { pressed: true })).toHaveAccessibleName(
      /물주기 1건/,
    )
    expect(
      screen.getByRole('button', { pressed: true }),
    ).not.toHaveAccessibleName(/사진 일기/)
    expect(
      screen.getByRole('list', { name: '선택 날짜의 기록' }).children,
    ).toHaveLength(1)
    expect(await context.repos.diaries.getById(entry.id)).toBeUndefined()
  })
  it('빈 데이터에서는 식물 등록 경로를 제공한다', async () => {
    await context.repos.plants.delete(plantId)
    await open()
    expect(screen.getByRole('link', { name: '첫 식물 등록' })).toHaveAttribute(
      'href',
      '/plants/new',
    )
    await act(async () => fireEvent.focus(window))
  })
})
