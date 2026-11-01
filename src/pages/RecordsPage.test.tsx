import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabase } from '../test/render-app'
import { routes } from '../app/routes'
import { RepositoryProvider } from '../app/RepositoryProvider'
let context: ReturnType<typeof testDatabase>
let plantId: string
const scroll = vi.fn()
const originalScroll = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView',
)
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({ name: '괴마옥', status: 'healthy' })
  ).id
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  scroll.mockClear()
  if (originalScroll)
    Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  await context.db.delete()
})
function open(path = '/records') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <RepositoryProvider repositories={context.repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  )
  return router
}
async function event(
  eventType:
    'watering' | 'grow_light' | 'repotting' | 'fertilizing' = 'watering',
) {
  return context.repos.careEvents.create({
    plantId,
    eventType,
    occurredAt: '2026-01-02T09:00:00Z',
    ...(eventType === 'grow_light' ? { durationMinutes: 60 } : {}),
  })
}
describe('전체 기록 화면', () => {
  it('기록 없음과 필터 결과 없음을 구분하고 필터를 초기화한다', async () => {
    const user = userEvent.setup()
    const router = open()
    await screen.findByRole('heading', { name: '아직 남긴 기록이 없어요' })
    await event()
    act(() => window.dispatchEvent(new Event('focus')))
    await screen.findByText('물주기 완료')
    await act(() => router.navigate('/records?type=diary'))
    await screen.findByRole('heading', { name: '선택한 조건의 기록이 없어요' })
    await user.click(screen.getAllByRole('button', { name: '필터 초기화' })[0])
    expect(router.state.location.search).toBe('')
    await screen.findByText('물주기 완료')
  })
  it('식물 0개면 기존 등록 화면으로 연결한다', async () => {
    await context.repos.plants.delete(plantId)
    open()
    await screen.findByRole('heading', { name: '첫 초록 친구를 만나 보세요' })
    expect(screen.getByRole('link', { name: '식물 등록' })).toHaveAttribute(
      'href',
      '/plants/new',
    )
  })
  it('URL 복합 필터를 적용하고 query를 유지/초기화한다', async () => {
    const user = userEvent.setup()
    await event()
    await event('repotting')
    await event('fertilizing')
    const other = await context.repos.plants.create({
      name: '다른 식물',
      status: 'healthy',
    })
    await context.repos.diaries.create({
      plantId: other.id,
      entryDate: '2026-01-02',
      condition: 'good',
    })
    const router = open(`/records?type=other&plant=${plantId}`)
    await screen.findByRole('heading', { name: '나의 기록' })
    expect(
      screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href')?.includes('#care-event-')),
    ).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '물주기' }))
    expect(router.state.location.search).toContain('type=watering')
    expect(router.state.location.search).toContain(plantId)
    await user.selectOptions(screen.getByLabelText('함께하는 식물'), other.id)
    await screen.findByRole('heading', { name: '선택한 조건의 기록이 없어요' })
    await user.click(screen.getAllByRole('button', { name: '필터 초기화' })[0])
    expect(router.state.location.search).toBe('')
    expect(
      screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href')?.includes('#care-event-')),
    ).toHaveLength(3)
  })
  it('잘못된 query/삭제된 식물을 정상화하고 안내한다', async () => {
    const router = open('/records?type=invalid&plant=deleted')
    await screen.findByText(/올바르지 않거나 삭제된 필터를 해제/)
    expect(router.state.location.search).toBe('')
  })
  it('31개 중 30개를 먼저 표시하고 더 보기/필터 변경/뒤로가기를 처리한다', async () => {
    const user = userEvent.setup()
    for (let i = 0; i < 31; i++) await event()
    const router = open()
    await screen.findByRole('button', { name: '30개 더 보기' })
    const links = () =>
      screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href')?.includes('#care-event-'))
    expect(links()).toHaveLength(30)
    await user.click(screen.getByRole('button', { name: '30개 더 보기' }))
    expect(links()).toHaveLength(31)
    await user.click(links()[0])
    await screen.findByRole('heading', { name: '괴마옥' })
    await act(() => router.navigate(-1))
    await screen.findByRole('heading', { name: '나의 기록' })
    expect(links()).toHaveLength(31)
    await user.click(screen.getByRole('button', { name: '물주기' }))
    expect(links()).toHaveLength(30)
  })
  it('30개는 더 보기 없이 표시하고 사진 없는 일기도 상세로 이동한다', async () => {
    for (let i = 0; i < 29; i++) await event()
    const diary = await context.repos.diaries.create({
      plantId,
      entryDate: '2026-01-01',
      condition: 'normal',
      title: '사진 없는 관찰',
    })
    open()
    await screen.findByText('사진 없는 관찰')
    expect(
      screen.queryByRole('button', { name: '30개 더 보기' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /사진 없는 관찰/ }),
    ).toHaveAttribute('href', `/plants/${plantId}/diary/${diary.id}`)
  })
  it('오류를 빈 목록으로 표시하지 않고 재시도한다', async () => {
    const user = userEvent.setup()
    vi.spyOn(context.repos.plants, 'list').mockRejectedValueOnce(
      new Error('failed'),
    )
    open()
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('heading', { name: '아직 남긴 기록이 없어요' })
  })
  it('포커스 복귀 재조회로 수정/삭제를 반영한다', async () => {
    const e = await event()
    open()
    await screen.findByText('물주기 완료')
    await context.repos.careEvents.update(e.id, { eventType: 'repotting' })
    act(() => window.dispatchEvent(new Event('focus')))
    await screen.findByText('분갈이 기록')
    await context.repos.careEvents.delete(e.id)
    act(() => window.dispatchEvent(new Event('focus')))
    await screen.findByRole('heading', { name: '아직 남긴 기록이 없어요' })
  })
  it('직접 hash 접근과 재진입에서 정확한 항목에 포커스하고 reduced motion을 존중한다', async () => {
    const e = await event()
    const next = await event('repotting')
    const router = open(`/plants/${plantId}#care-event-${e.id}`)
    const article = await screen.findByRole('article', { name: '물주기 완료' })
    await waitFor(() => expect(article).toHaveFocus())
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: '사진' }))
    await act(() => router.navigate(`/plants/${plantId}#care-event-${next.id}`))
    await waitFor(() =>
      expect(screen.getByRole('article', { name: '분갈이' })).toHaveFocus(),
    )
    expect(screen.getByRole('tab', { name: '타임라인' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
  it('삭제된 hash 기록은 안내하고 기존 상세 화면을 유지한다', async () => {
    open(`/plants/${plantId}#care-event-missing`)
    await screen.findByText(
      '이 기록을 찾을 수 없어요. 최신 기록을 확인해 주세요.',
    )
    expect(screen.getByRole('heading', { name: '괴마옥' })).toBeInTheDocument()
  })
  it('30개 밖의 일기도 전체 필터 후 페이지에 포함한다', async () => {
    const user = userEvent.setup()
    for (let i = 0; i < 31; i++) await event()
    await context.repos.diaries.create({
      plantId,
      entryDate: '2024-01-01',
      condition: 'normal',
      title: '오래된 관찰',
    })
    open()
    await screen.findByRole('button', { name: '30개 더 보기' })
    expect(screen.queryByText('오래된 관찰')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '사진 일기' }))
    await screen.findByText('오래된 관찰')
    expect(
      screen.queryByRole('button', { name: '30개 더 보기' }),
    ).not.toBeInTheDocument()
  })
  it('타이머 배지를 간결하게 표시하면서 원본 메모와 사용 시간은 유지한다', async () => {
    const memo =
      '식물등 타이머 자동 기록\n실제 누적 00:01:01\n시작 2026-01-02T09:00:00Z\n측정 종료 2026-01-02T09:01:01Z\n사용자 관찰 메모'
    const event = await context.repos.careEvents.create({
      plantId,
      eventType: 'grow_light',
      occurredAt: '2026-01-02T09:01:01Z',
      durationMinutes: 1,
      memo,
    })
    open()
    await screen.findByText('타이머 · 1분 1초')
    expect(screen.getByText('식물등 1분')).toBeInTheDocument()
    expect(await context.repos.careEvents.getById(event.id)).toMatchObject({
      memo,
      durationMinutes: 1,
    })
  })
})
