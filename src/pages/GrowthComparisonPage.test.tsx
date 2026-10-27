import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
async function attach() {
  const entry = await context.repos.diaries.create({
    plantId: fixtureIds[0],
    entryDate: '2026-01-02',
    condition: 'good',
    title: '새잎',
  })
  for (let i = 0; i < 2; i++)
    await context.repos.photos.create({
      plantId: fixtureIds[0],
      entryId: entry.id,
      blob: new Blob(['p'], { type: 'image/png' }),
      mimeType: 'image/png',
      sortOrder: i,
      capturedAt: '2026-10-27T00:00:00Z',
    })
  return entry
}
describe('성장 비교 화면 연결', () => {
  it('식물 상세에서 진입하고 기존 하단 탐색을 유지한다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos, `/plants/${fixtureIds[0]}`)
    await user.click(await screen.findByRole('link', { name: '성장 비교' }))
    expect(await screen.findByText(/현재 0장이 있어요/)).toBeVisible()
    expect(screen.getByRole('navigation', { name: '하단 탐색' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: '식물 상세로 돌아가기' }),
    ).toHaveAttribute('href', `/plants/${fixtureIds[0]}`)
  })
  it('일기 수정·삭제를 새로고침 후 반영하고 삭제된 선택을 안내한다', async () => {
    const user = userEvent.setup()
    const entry = await attach()
    renderApp(context.repos, `/plants/${fixtureIds[0]}/compare`)
    await screen.findByRole('checkbox', { name: /1번 사진 선택/ })
    await user.click(
      screen.getByRole('button', { name: '처음·최근 사진 선택' }),
    )
    await user.click(screen.getByRole('button', { name: '선택한 사진 비교' }))
    await context.repos.diaries.update(entry.id, { entryDate: '2025-12-01' })
    await user.click(screen.getByRole('button', { name: '사진 목록 새로고침' }))
    await waitFor(() =>
      expect(
        screen
          .getByRole('group', { name: '선택한 사진 두 장' })
          .querySelector('time'),
      ).toHaveAttribute('datetime', '2025-12-01'),
    )
    await context.repos.diaries.delete(entry.id)
    await user.click(screen.getByRole('button', { name: '사진 목록 새로고침' }))
    expect(await screen.findByText(/삭제되었거나 일기에서 제외/)).toBeVisible()
    expect(
      screen.queryByRole('group', { name: '선택한 사진 두 장' }),
    ).not.toBeInTheDocument()
  })
  it('조회 오류 재시도와 없는 식물 안내를 표시한다', async () => {
    const spy = vi
      .spyOn(context.repos.photos, 'listByPlant')
      .mockRejectedValueOnce(new Error('failed'))
    const user = userEvent.setup()
    renderApp(context.repos, `/plants/${fixtureIds[0]}/compare`)
    expect(await screen.findByText('정보를 불러오지 못했어요')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText(/현재 0장이 있어요/)).toBeVisible()
    expect(spy).toHaveBeenCalledTimes(2)
  })
  it('잘못된 식물 ID를 안내한다', async () => {
    renderApp(context.repos, '/plants/missing/compare')
    expect(await screen.findByText('식물을 찾을 수 없습니다')).toBeVisible()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
  it('선택 후 삭제된 사진을 비교 진입 시 다시 조회한다', async () => {
    const entry = await attach()
    const user = userEvent.setup()
    renderApp(context.repos, `/plants/${fixtureIds[0]}/compare`)
    await screen.findByRole('checkbox', { name: /1번 사진 선택/ })
    await user.click(
      screen.getByRole('button', { name: '처음·최근 사진 선택' }),
    )
    const [photo] = await context.repos.photos.listByPlant(fixtureIds[0])
    await context.repos.photos.delete(photo.id)
    await user.click(screen.getByRole('button', { name: '선택한 사진 비교' }))
    expect(await screen.findByText(/삭제되었거나 일기에서 제외/)).toBeVisible()
    expect(await context.repos.diaries.getById(entry.id)).toBeDefined()
  })
})
