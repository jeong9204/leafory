import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabase } from '../test/render-app'
import { routes } from '../app/routes'
import { RepositoryProvider } from '../app/RepositoryProvider'
import { localDateKey } from '../domain/calendar'
let context: ReturnType<typeof testDatabase>
let plantId: string
let diaryId: string
let careId: string
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({
      name: '복귀 테스트 식물',
      status: 'healthy',
    })
  ).id
  diaryId = (
    await context.repos.diaries.create({
      plantId,
      entryDate: localDateKey(),
      condition: 'good',
      title: '복귀 테스트 일기',
    })
  ).id
  careId = (
    await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date().toISOString(),
    })
  ).id
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await context.db.delete()
})
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <RepositoryProvider repositories={context.repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  )
  return router
}
const diaryPath = () => `/plants/${plantId}/diary/${diaryId}`
async function diaryLink() {
  return screen.findByRole('link', { name: /복귀 테스트 일기/ })
}
describe('actual caller back navigation', () => {
  it.each(['button', 'browser'] as const)(
    'records query returns through %s without adding a history entry',
    async (mode) => {
      const path = `/records?type=diary&plant=${plantId}`
      const router = open(path)
      const user = userEvent.setup()
      const link = await diaryLink()
      const sourceKey = router.state.location.key
      await user.click(link)
      await screen.findByRole('heading', { name: '복귀 테스트 일기' })
      if (mode === 'button')
        await user.click(
          screen.getByRole('link', { name: '나의 기록으로 돌아가기' }),
        )
      else await act(() => router.navigate(-1))
      await screen.findByRole('heading', { name: '나의 기록' })
      expect(
        router.state.location.pathname + router.state.location.search,
      ).toBe(path)
      expect(router.state.location.key).toBe(sourceKey)
      expect(screen.getByLabelText('함께하는 식물')).toHaveValue(plantId)
      expect(screen.getByRole('button', { name: '사진 일기' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    },
  )
  it('calendar diary returns to the original calendar entry', async () => {
    const router = open('/calendar')
    const user = userEvent.setup()
    await user.click(await diaryLink())
    await user.click(
      await screen.findByRole('link', { name: '캘린더로 돌아가기' }),
    )
    expect(router.state.location.pathname).toBe('/calendar')
  })
  it('plant diary returns to plant, while direct diary safely replaces with plant', async () => {
    const router = open(diaryPath())
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('link', { name: '식물 상세로 돌아가기' }),
    )
    await screen.findByRole('heading', { name: '복귀 테스트 식물' })
    expect(router.state.historyAction).toBe('REPLACE')
    const sourceKey = router.state.location.key
    await user.click(await diaryLink())
    await user.click(
      await screen.findByRole('link', { name: '식물 상세로 돌아가기' }),
    )
    expect(router.state.location.key).toBe(sourceKey)
  })
  it.each(['cancel', 'save'] as const)(
    'diary edit %s returns to existing detail and its records predecessor',
    async (action) => {
      const router = open('/records?type=diary')
      const user = userEvent.setup()
      await user.click(await diaryLink())
      const detailKey = router.state.location.key
      await user.click(await screen.findByRole('link', { name: '일기 수정' }))
      await screen.findByRole('heading', { name: '일기 수정' })
      if (action === 'save') {
        await user.clear(screen.getByLabelText(/제목/))
        await user.type(screen.getByLabelText(/제목/), '수정된 일기')
        await user.click(screen.getByRole('button', { name: /저장/ }))
      } else await user.click(screen.getByRole('button', { name: '취소' }))
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(diaryPath()),
      )
      expect(router.state.location.key).toBe(detailKey)
      await user.click(
        await screen.findByRole('link', { name: '나의 기록으로 돌아가기' }),
      )
      await screen.findByRole('heading', { name: '나의 기록' })
      expect(router.state.location.search).toBe('?type=diary')
    },
  )
  it.each(['watering', 'grow_light', 'repotting', 'fertilizing'] as const)(
    'records %s anchor and editor cancel preserve the chain',
    async (eventType) => {
      await context.repos.careEvents.update(careId, {
        eventType,
        ...(eventType === 'grow_light' ? { durationMinutes: 10 } : {}),
      })
      const router = open('/records')
      const user = userEvent.setup()
      await screen.findByRole('heading', { name: '나의 기록' })
      const row = document.querySelector<HTMLAnchorElement>(
        `a[href$="#care-event-${careId}"]`,
      )!
      await user.click(row)
      await screen.findByRole('heading', { name: '복귀 테스트 식물' })
      const key = router.state.location.key
      const edit = document.querySelector<HTMLAnchorElement>(
        `a[href$="/care/${careId}/edit"]`,
      )!
      await user.click(edit)
      await screen.findByRole('heading', { name: '관리 기록 수정' })
      await user.click(screen.getByRole('button', { name: '취소' }))
      await waitFor(() => expect(router.state.location.key).toBe(key))
      expect(router.state.location.hash).toBe(`#care-event-${careId}`)
      await user.click(
        await screen.findByRole('link', { name: '나의 기록으로 돌아가기' }),
      )
      await screen.findByRole('heading', { name: '나의 기록' })
    },
  )
  it('more than 30, filters and scroll restore through the screen back button', async () => {
    for (let i = 0; i < 31; i++)
      await context.repos.diaries.create({
        plantId,
        entryDate: localDateKey(),
        condition: 'normal',
        title: `추가 일기 ${i}`,
      })
    const router = open(`/records?type=diary&plant=${plantId}`)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '30개 더 보기' }),
    )
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 720 })
    act(() => window.dispatchEvent(new Event('scroll')))
    await user.click(await diaryLink())
    await user.click(
      await screen.findByRole('link', { name: '나의 기록으로 돌아가기' }),
    )
    await screen.findByRole('heading', { name: '나의 기록' })
    expect(document.querySelectorAll('.record-list-item')).toHaveLength(32)
    expect(router.state.location.search).toContain('type=diary')
    await waitFor(() =>
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 720,
        behavior: 'instant',
      }),
    )
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  })
  it('home recent-record plant back returns to the same home history entry', async () => {
    const router = open('/')
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: '나의 작은 정원' })
    const key = router.state.location.key
    const homeRecord =
      document.querySelector<HTMLAnchorElement>(
        '.recent-records a[href^="/plants/"]',
      ) ??
      document.querySelector<HTMLAnchorElement>(`a[href="/plants/${plantId}"]`)
    await user.click(homeRecord!)
    await user.click(
      await screen.findByRole('link', { name: '내 식물 목록으로 돌아가기' }),
    )
    await screen.findByRole('heading', { name: '나의 작은 정원' })
    expect(router.state.location.key).toBe(key)
  })
  it('dirty diary cancel asks before popping and preserves the records chain', async () => {
    const router = open('/records?type=diary')
    const user = userEvent.setup()
    await user.click(await diaryLink())
    await user.click(await screen.findByRole('link', { name: '일기 수정' }))
    await user.type(await screen.findByLabelText(/제목/), ' 변경')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await screen.findByRole('heading', { name: '작성을 그만둘까요?' })
    await user.click(screen.getByRole('button', { name: '계속 작성' }))
    expect(router.state.location.pathname).toContain('/edit')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(await screen.findByRole('button', { name: '나가기' }))
    await screen.findByRole('heading', { name: '복귀 테스트 일기' })
    expect((await context.repos.diaries.getById(diaryId))?.title).toBe(
      '복귀 테스트 일기',
    )
    await user.click(
      screen.getByRole('link', { name: '나의 기록으로 돌아가기' }),
    )
    await screen.findByRole('heading', { name: '나의 기록' })
  })
  it('saving a care edit pops back to the existing anchor then records', async () => {
    const router = open('/records?type=watering')
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: '나의 기록' })
    await user.click(
      document.querySelector<HTMLAnchorElement>(
        `a[href$="#care-event-${careId}"]`,
      )!,
    )
    await screen.findByRole('heading', { name: '복귀 테스트 식물' })
    const key = router.state.location.key
    await user.click(
      document.querySelector<HTMLAnchorElement>(
        `a[href$="/care/${careId}/edit"]`,
      )!,
    )
    await user.type(await screen.findByLabelText(/메모/), '검증 메모')
    await user.click(screen.getByRole('button', { name: '기록 저장' }))
    await screen.findByRole('heading', { name: '복귀 테스트 식물' })
    expect(router.state.location.key).toBe(key)
    expect(router.state.location.hash).toBe(`#care-event-${careId}`)
    await user.click(
      screen.getByRole('link', { name: '나의 기록으로 돌아가기' }),
    )
    await screen.findByRole('heading', { name: '나의 기록' })
    expect(router.state.location.search).toBe('?type=watering')
  })
})
