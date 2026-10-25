import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  fixtureIds,
  renderApp,
  seedPlants,
  testDatabase,
} from '../test/render-app'
let context: ReturnType<typeof testDatabase>
beforeEach(async () => {
  context = testDatabase()
  await seedPlants(context.repos)
})
afterEach(async () => context.db.delete())
describe('기본 라우팅', () => {
  it.each([
    ['/', '나의 작은 정원'],
    ['/plants/new', '새로운 초록 친구'],
    [`/plants/${fixtureIds[0]}`, '괴마옥'],
    ['/plants/plant-1', '식물을 찾을 수 없습니다'],
    ['/plants/plant-1/diary/new', '일기 작성'],
    ['/records', '기록 목록'],
    ['/unknown', '페이지를 찾을 수 없습니다'],
  ])('%s 경로에 맞는 화면을 표시한다', async (path, title) => {
    renderApp(context.repos, path)
    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
  })
  it('탐색 링크로 기록 목록과 홈 사이를 이동한다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos)
    await screen.findByRole('heading', { name: '나의 작은 정원' })
    await user.click(screen.getByRole('link', { name: '기록 목록' }))
    expect(
      screen.getByRole('heading', { name: '기록 목록' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '홈' }))
    expect(
      await screen.findByRole('heading', { name: '나의 작은 정원' }),
    ).toBeInTheDocument()
  })
})
