import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'
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
describe('빠른 기록 UI', () => {
  it('홈 물주기는 한 번 저장하고 통계를 갱신하며 실패를 안내한다', async () => {
    renderApp(context.repos)
    const water = await screen.findByRole('button', { name: '초록이 물주기' })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const original = context.repos.careEvents.create
    const spy = vi
      .spyOn(context.repos.careEvents, 'create')
      .mockImplementation(async (input) => {
        await gate
        return original(input)
      })
    fireEvent.click(water)
    fireEvent.click(water)
    expect(spy).toHaveBeenCalledOnce()
    expect(water).toBeDisabled()
    await act(async () => release())
    expect(await screen.findByText('물주기를 기록했어요.')).toBeInTheDocument()
    expect(await screen.findByText('오늘')).toBeInTheDocument()
    spy.mockRejectedValueOnce(new Error('quota'))
    fireEvent.click(water)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장하지 못했어요',
    )
    expect(await context.repos.careEvents.listByPlant(plantId)).toHaveLength(1)
  })
  it('과거 기록 생성, 상세에서 수정, 삭제 후 통계와 새 화면 복원을 검증한다', async () => {
    const user = userEvent.setup()
    const rendered = renderApp(context.repos, `/plants/${plantId}/care/new`)
    await screen.findByRole('form')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    fireEvent.input(screen.getByLabelText('기록 날짜·시각'), {
      target: { value: '2026-01-02T12:30' },
    })
    await user.type(screen.getByLabelText(/메모/), '옛 물주기')
    await user.click(screen.getByRole('button', { name: '기록 저장' }))
    await screen.findByRole('heading', { name: '물주기 완료' })
    expect(screen.getByText('1월 2일')).toBeInTheDocument()
    await user.click(
      screen.getByRole('link', { name: '물주기 완료 기록 수정' }),
    )
    await screen.findByRole('heading', { name: '관리 기록 수정' })
    await user.selectOptions(screen.getByLabelText('관리 종류'), 'grow_light')
    await user.type(screen.getByLabelText('사용 시간'), '1')
    await user.type(screen.getByLabelText('사용 분'), '15')
    await user.click(screen.getByRole('button', { name: '기록 저장' }))
    await screen.findByRole('heading', { name: '식물등 75분' })
    const event = (await context.repos.careEvents.listByPlant(plantId))[0]
    expect(event.durationMinutes).toBe(75)
    rendered.unmount()
    renderApp(context.repos, `/plants/${plantId}`)
    await screen.findByRole('heading', { name: '식물등 75분' })
    await user.click(
      screen.getByRole('button', { name: '식물등 75분 기록 삭제' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '기록 삭제',
      }),
    )
    expect(await screen.findByText('아직 기록이 없어요.')).toBeInTheDocument()
    expect(await context.repos.careEvents.listByPlant(plantId)).toEqual([])
  })
  it('입력 오류·저장 실패에도 내용을 유지하고 중복 제출을 막는다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos, `/plants/${plantId}/care/new`)
    await screen.findByRole('form')
    await user.selectOptions(screen.getByLabelText('관리 종류'), 'grow_light')
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('1분 이상')
    await user.type(screen.getByLabelText('사용 분'), '30')
    await user.type(screen.getByLabelText(/메모/), '유지할 내용')
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const spy = vi
      .spyOn(context.repos, 'runInTransaction')
      .mockImplementation(async () => {
        await gate
        throw new Error('quota')
      })
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    expect(spy).toHaveBeenCalledOnce()
    await act(async () => release())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '입력 내용을 유지',
    )
    expect(screen.getByLabelText(/메모/)).toHaveValue('유지할 내용')
    expect(screen.getByLabelText('사용 분')).toHaveValue(30)
  })
  it('다른 식물의 기록 편집 주소는 거절한다', async () => {
    const other = await context.repos.plants.create({
      name: '다른 식물',
      status: 'healthy',
    })
    const event = await context.repos.careEvents.create({
      plantId: other.id,
      eventType: 'watering',
      occurredAt: new Date().toISOString(),
    })
    renderApp(context.repos, `/plants/${plantId}/care/${event.id}/edit`)
    expect(
      await screen.findByRole('heading', {
        name: '식물 또는 기록을 찾을 수 없습니다',
      }),
    ).toBeInTheDocument()
  })
  it('변경한 식물 폼에서 이탈 취소·확인과 새로고침 방지를 제공한다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos, '/plants/new')
    await screen.findByRole('form')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/식물 이름/), '작성 중')
    const before = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(before)
    expect(before.defaultPrevented).toBe(true)
    await user.click(
      screen.getByRole('link', { name: '이전 화면으로 돌아가기' }),
    )
    await user.click(screen.getByRole('button', { name: '계속 작성' }))
    expect(screen.getByLabelText(/식물 이름/)).toHaveValue('작성 중')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '나가기' }))
    expect(
      await screen.findByRole('heading', { name: '나의 작은 정원' }),
    ).toBeInTheDocument()
    expect(await context.repos.plants.list()).toHaveLength(1)
  })
  it('변경 없는 수정 화면은 확인 없이 닫힌다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos, `/plants/${plantId}/edit`)
    await screen.findByRole('form')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '초록이' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

it('삭제 실패 시 이벤트와 통계를 유지하고 재시도한다', async () => {
  const user = userEvent.setup()
  await context.repos.careEvents.create({
    plantId,
    eventType: 'watering',
    occurredAt: new Date().toISOString(),
  })
  renderApp(context.repos, `/plants/${plantId}`)
  await user.click(
    await screen.findByRole('button', { name: '물주기 완료 기록 삭제' }),
  )
  vi.spyOn(context.repos.careEvents, 'delete').mockRejectedValueOnce(
    new Error('unavailable'),
  )
  await user.click(screen.getByRole('button', { name: '기록 삭제' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '삭제하지 못했어요',
  )
  expect(await context.repos.careEvents.listByPlant(plantId)).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '기록 삭제' }))
  expect(await screen.findByText('아직 기록이 없어요.')).toBeInTheDocument()
})
