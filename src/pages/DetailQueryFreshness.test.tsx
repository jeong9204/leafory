import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'

it('refreshes warmed plant/diary views after real editor save and diary deletion', async () => {
  const { db, repos } = testDatabase()
  const user = userEvent.setup()
  try {
    const plant = await repos.plants.create({
      name: '복귀 검증 식물',
      status: 'healthy',
    })
    await repos.diaries.create({
      plantId: plant.id,
      entryDate: '2026-11-01',
      condition: 'normal',
      title: '변경 전 일기',
    })
    await repos.careEvents.create({
      plantId: plant.id,
      eventType: 'watering',
      occurredAt: '2026-11-01T09:00:00Z',
    })
    renderApp(repos, `/plants/${plant.id}`)
    await user.click(
      await screen.findByRole('link', { name: '변경 전 일기 일기 보기' }),
    )
    await user.click(await screen.findByRole('link', { name: '일기 수정' }))
    const title = await screen.findByLabelText(/제목/)
    await user.clear(title)
    await user.type(title, '변경 후 일기')
    await user.click(screen.getByRole('button', { name: '일기 저장' }))
    await screen.findByRole('heading', { name: '변경 후 일기' })
    expect(
      screen.queryByRole('heading', { name: '변경 전 일기' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '식물 상세로 돌아가기' }))
    await user.click(
      await screen.findByRole('link', { name: '변경 후 일기 일기 보기' }),
    )
    await user.click(await screen.findByRole('button', { name: '일기 삭제' }))
    const dialog = screen.getByRole('dialog', { name: '일기를 삭제할까요?' })
    await user.click(within(dialog).getByRole('button', { name: '삭제할게요' }))
    await screen.findByRole('heading', { name: plant.name })
    expect(
      screen.queryByRole('link', { name: '변경 후 일기 일기 보기' }),
    ).not.toBeInTheDocument()
    expect(await repos.diaries.listByPlant(plant.id)).toHaveLength(0)
    expect(await repos.careEvents.listByPlant(plant.id)).toHaveLength(1)
  } finally {
    await db.delete()
  }
})
