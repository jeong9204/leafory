import { fireEvent, screen, within, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fixtureIds,
  renderApp,
  seedPlants,
  testDatabase,
} from '../test/render-app'
let context: ReturnType<typeof testDatabase>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24, 10))
  context = testDatabase()
})
afterEach(async () => {
  vi.useRealTimers()
  await context.db.delete()
})
describe('실제 저장소 홈 UI', () => {
  it('빈 DB에 목업을 넣지 않고 빈 상태와 0개 요약을 표시한다', async () => {
    renderApp(context.repos)
    expect(
      await screen.findByText('첫 초록 친구를 만나 보세요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '함께하는 식물 0' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '첫 식물 등록' })).toHaveAttribute(
      'href',
      '/plants/new',
    )
    expect(await context.repos.plants.list()).toEqual([])
  })
  it('식물 수 요약이 실제 카드 수와 일치하고 사진 없는 식물도 표시한다', async () => {
    await seedPlants(context.repos)
    renderApp(context.repos)
    const list = await screen.findByRole('list', { name: '내 식물 목록' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(
      screen.getByRole('link', { name: '함께하는 식물 3' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '이번 주 기록 0' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('기록 없음')).toHaveLength(6)
    expect(
      screen.getByRole('img', { name: '괴마옥 화분 (사진 없음)' }),
    ).toBeInTheDocument()
  })
  it('저장된 이벤트의 날짜·경과 일수와 활성 물주기 버튼을 표시한다', async () => {
    await seedPlants(context.repos, true)
    renderApp(context.repos)
    await screen.findByRole('list', { name: '내 식물 목록' })
    for (const days of [3, 6, 12])
      expect(screen.getByText(`${days}일 전`)).toBeInTheDocument()
    for (const name of ['괴마옥', '몬스테라', '스투키'])
      expect(
        screen.getByRole('button', { name: `${name} 물주기` }),
      ).toBeEnabled()
    expect(
      screen.getByRole('link', { name: '괴마옥 상세 보기' }),
    ).toHaveAttribute('href', `/plants/${fixtureIds[0]}`)
  })
  it('날짜 변경 후 포커스 복귀 시 경과 일수와 헤더를 갱신한다', async () => {
    await seedPlants(context.repos, true)
    renderApp(context.repos)
    await screen.findByText('3일 전')
    vi.setSystemTime(new Date(2026, 9, 25, 10))
    fireEvent.focus(window)
    await waitFor(() =>
      expect(screen.getByText('10월 25일 (일)')).toBeInTheDocument(),
    )
    expect(await screen.findByText('4일 전')).toBeInTheDocument()
  })
  it('조회 실패와 빈 상태를 구분하고 다시 시도할 수 있다', async () => {
    const spy = vi
      .spyOn(context.repos.plants, 'list')
      .mockRejectedValueOnce(new Error('unavailable'))
    renderApp(context.repos)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '정보를 불러오지 못했어요',
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(
      await screen.findByText('첫 초록 친구를 만나 보세요'),
    ).toBeInTheDocument()
    spy.mockRestore()
  })
})
