import {
  cleanup,
  screen,
  within,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { renderApp, testDatabase } from '../../test/render-app'
let context: ReturnType<typeof testDatabase>
beforeEach(() => {
  context = testDatabase()
})
afterEach(async () => {
  cleanup()
  await context.db.delete()
})
describe('책장 홈 데이터와 접근성', () => {
  it('등록한 식물만 표시하고 긴 이름의 전체 접근 가능한 이름과 ID를 유지한다', async () => {
    const name = '매우 긴 이름을 가진 나만의 작은 정원 속 초록 친구'.repeat(2)
    const plant = await context.repos.plants.create({ name, status: 'healthy' })
    renderApp(context.repos)
    const list = await screen.findByRole('list', { name: '내 식물 목록' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(
      screen.getByRole('link', { name: `${name} 상세 보기` }),
    ).toHaveAttribute('href', `/plants/${plant.id}`)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(
      screen.queryByText(/말랐|물주기 필요|건강하지/),
    ).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: `${name} 상세 보기` }))
    expect(await screen.findByRole('heading', { name, level: 1 })).toBeVisible()
  })
  it('새 에셋 로딩 실패 시 기본 화분으로 대체하고 상세 링크를 유지한다', async () => {
    const plant = await context.repos.plants.create({
      name: '괴마옥',
      status: 'healthy',
    })
    renderApp(context.repos)
    const image = await screen.findByRole('img', { name: '괴마옥 픽셀 화분' })
    expect(image).toHaveAttribute(
      'src',
      '/pixel/refined/euphorbia-bupleurifolia.webp',
    )
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/pixel/refined/default.webp')
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/pixel/refined/default.webp')
    expect(
      screen.getByRole('link', { name: '괴마옥 상세 보기' }),
    ).toHaveAttribute('href', `/plants/${plant.id}`)
  })
  it('다수 식물 추가·삭제 후 재조회해 목록을 갱신하고 메뉴 3개를 유지한다', async () => {
    const plants = []
    for (let i = 0; i < 7; i++)
      plants.push(
        await context.repos.plants.create({
          name: `초록 ${i + 1}`,
          status: 'observing',
        }),
      )
    renderApp(context.repos)
    let list = await screen.findByRole('list', { name: '내 식물 목록' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(7)
    await context.repos.plants.delete(plants[0].id)
    fireEvent.focus(window)
    await waitFor(() => {
      list = screen.getByRole('list', { name: '내 식물 목록' })
      expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    })
    const nav = screen.getByRole('navigation', { name: '하단 탐색' })
    expect(within(nav).getAllByRole('link')).toHaveLength(3)
    expect(within(nav).getByRole('link', { name: '홈' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(nav).getByRole('link', { name: '기록 목록' }),
    ).toHaveAttribute('href', '/records')
    expect(within(nav).getByRole('link', { name: '캘린더' })).toHaveAttribute(
      'href',
      '/calendar',
    )
  })
  it('오래된 물주기 기록으로 상태를 바꾸지 않고 실제 기록만 보여준다', async () => {
    const plant = await context.repos.plants.create({
      name: '아직 건강해요',
      status: 'healthy',
    })
    await context.repos.careEvents.create({
      plantId: plant.id,
      eventType: 'watering',
      occurredAt: '2020-01-01T00:00:00Z',
    })
    renderApp(context.repos)
    await screen.findByRole('list', { name: '내 식물 목록' })
    expect(screen.queryByText(/물주기 필요|위험|시들/)).not.toBeInTheDocument()
    expect((await context.repos.plants.getById(plant.id))?.status).toBe(
      'healthy',
    )
  })
  it.each([0, 1, 2, 3, 6, 9, 12])(
    '식물 %s개에서도 장식이 실제 목록 수나 상세 링크를 바꾸지 않는다',
    async (count) => {
      for (let i = 0; i < count; i++)
        await context.repos.plants.create({
          name: `미지원 초록 ${i}`,
          status: 'healthy',
        })
      renderApp(context.repos)
      await screen.findByRole('link', { name: `함께하는 식물 ${count}` })
      if (count === 0) {
        expect(
          screen.queryByRole('list', { name: '내 식물 목록' }),
        ).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: '첫 식물 등록' })).toBeVisible()
      } else {
        const list = screen.getByRole('list', { name: '내 식물 목록' })
        expect(within(list).getAllByRole('listitem')).toHaveLength(count)
        expect(within(list).getAllByRole('link')).toHaveLength(count)
        expect(within(list).getAllByRole('img')).toHaveLength(count)
      }
    },
  )
  it('관리 요약은 한 줄로 표시하고 아이콘에 실제 기록의 의미를 제공한다', async () => {
    const plant = await context.repos.plants.create({
      name: '초록이',
      status: 'healthy',
    })
    await context.repos.careEvents.create({
      plantId: plant.id,
      eventType: 'watering',
      occurredAt: '2026-10-28T03:00:00Z',
    })
    await context.repos.careEvents.create({
      plantId: plant.id,
      eventType: 'grow_light',
      occurredAt: new Date().toISOString(),
      durationMinutes: 120,
    })
    renderApp(context.repos)
    const list = await screen.findByRole('list', { name: '내 식물 목록' })
    expect(
      within(list).getByRole('img', { name: /마지막 물주기/ }),
    ).toBeVisible()
    expect(
      within(list).getByRole('img', { name: '오늘 식물등 120분 기록 있음' }),
    ).toBeVisible()
    expect(within(list).queryByText('120분')).not.toBeInTheDocument()
    expect(within(list).queryByText('관리 기록 없음')).not.toBeInTheDocument()
  })
})
