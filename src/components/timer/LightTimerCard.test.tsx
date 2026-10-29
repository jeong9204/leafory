import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fixtureIds,
  renderApp,
  seedPlants,
  testDatabase,
} from '../../test/render-app'
import { RepositoryError } from '../../domain/errors'

let context: ReturnType<typeof testDatabase>
const initial = new Date('2026-10-27T03:00:00Z').getTime()
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(initial)
  context = testDatabase()
  await seedPlants(context.repos)
})
afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await context.db.delete()
  vi.useRealTimers()
})
function open(id = fixtureIds[0]) {
  return renderApp(context.repos, `/plants/${id}`)
}
async function click(name: string) {
  fireEvent.click(await screen.findByRole('button', { name }))
}
async function start() {
  await click('타이머 시작')
  await screen.findByRole('button', { name: '일시정지' })
}
async function confirmEnd() {
  await click('종료')
  return screen.findByRole('dialog', { name: '식물등 사용 시간을 기록할까요?' })
}

describe('식물등 타이머 실제 Repository 화면 연결', () => {
  it('시작·일시정지·재개·확인 종료 후 통계와 타임라인을 갱신한다', async () => {
    open()
    await start()
    vi.setSystemTime(initial + 90345)
    fireEvent.focus(window)
    await waitFor(() =>
      expect(screen.getByLabelText('식물등 누적 사용 시간')).toHaveTextContent(
        '00:01:30',
      ),
    )
    await click('일시정지')
    await screen.findByRole('button', { name: '재개' })
    vi.setSystemTime(initial + 3600000)
    fireEvent.focus(window)
    expect(screen.getByLabelText('식물등 누적 사용 시간')).toHaveTextContent(
      '00:01:30',
    )
    expect(await context.repos.queries.totalRecordCount(fixtureIds[0])).toBe(0)
    await click('재개')
    await screen.findByRole('button', { name: '일시정지' })
    vi.setSystemTime(initial + 3631555)
    const dialog = await confirmEnd()
    expect(within(dialog).getByText('00:02:01')).toBeVisible()
    await click('기록하고 종료')
    await screen.findByText('식물등 2분을 기록했어요.')
    expect(await context.repos.lightTimer.get()).toBeUndefined()
    const summary = screen.getByRole('region', {
      name: '괴마옥 현재 상태와 관리 요약',
    })
    await waitFor(() => expect(within(summary).getByText('2분')).toBeVisible())
    expect(within(summary).getByText('1개')).toBeVisible()
    expect(await screen.findByText(/식물등 타이머 자동 기록/)).toBeVisible()
  })
  it('화면을 다시 열면 실행 시간을 복구하고 종료 확인을 닫으면 일시정지로 남긴다', async () => {
    const view = open()
    await start()
    view.unmount()
    vi.setSystemTime(initial + 125000)
    open()
    await screen.findByRole('button', { name: '일시정지' })
    expect(screen.getByLabelText('식물등 누적 사용 시간')).toHaveTextContent(
      '00:02:05',
    )
    await confirmEnd()
    await click('돌아가기')
    await screen.findByRole('button', { name: '재개' })
    expect((await context.repos.lightTimer.get())?.status).toBe('paused')
    expect(await context.repos.queries.totalRecordCount(fixtureIds[0])).toBe(0)
  })
  it('1분 미만 종료와 기록 없이 취소는 확인을 거쳐 타이머만 정리한다', async () => {
    open()
    await start()
    await confirmEnd()
    await click('기록 없이 종료')
    await screen.findByText('기록 없이 타이머를 종료했어요.')
    await start()
    await click('기록 없이 취소')
    await screen.findByRole('dialog', { name: '기록 없이 취소할까요?' })
    await click('기록 없이 종료')
    await waitFor(async () =>
      expect(await context.repos.lightTimer.get()).toBeUndefined(),
    )
    expect(await context.repos.queries.totalRecordCount(fixtureIds[0])).toBe(0)
  })
  it('다른 식물의 타이머가 있으면 소유 식물로 이동해 종료할 수 있다', async () => {
    await context.repos.lightTimer.start(fixtureIds[0])
    open(fixtureIds[1])
    const link = await screen.findByRole('link', { name: '타이머 식물로 이동' })
    expect(
      screen.queryByRole('button', { name: '타이머 시작' }),
    ).not.toBeInTheDocument()
    fireEvent.click(link)
    await screen.findByRole('button', { name: '기록 없이 취소' })
    await click('기록 없이 취소')
    await click('기록 없이 종료')
    await screen.findByText('기록 없이 타이머를 종료했어요.')
  })
  it('중복 시작 클릭을 잠그고 실패 후 다시 시작할 수 있다', async () => {
    let reject!: (reason: unknown) => void
    const spy = vi
      .spyOn(context.repos.lightTimer, 'start')
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail
          }),
      )
    open()
    const button = await screen.findByRole('button', { name: '타이머 시작' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(spy).toHaveBeenCalledTimes(1)
    reject(new RepositoryError('STORAGE', 'disk full'))
    await screen.findByRole('alert')
    await start()
    expect(spy).toHaveBeenCalledTimes(2)
  })
  it('종료 저장 실패 시 정지 상태와 확인 내용을 보존하고 중복 없이 재시도한다', async () => {
    open()
    await start()
    vi.setSystemTime(initial + 120000)
    await confirmEnd()
    let reject!: (reason: unknown) => void
    const spy = vi
      .spyOn(context.repos.lightTimer, 'finish')
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail
          }),
      )
    const button = screen.getByRole('button', { name: '기록하고 종료' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(spy).toHaveBeenCalledTimes(1)
    reject(new RepositoryError('STORAGE', 'disk full'))
    await screen.findByRole('alert')
    expect((await context.repos.lightTimer.get())?.status).toBe('paused')
    expect(await context.repos.queries.totalRecordCount(fixtureIds[0])).toBe(0)
    await click('기록하고 종료')
    await screen.findByText('식물등 2분을 기록했어요.')
    expect(await context.repos.queries.totalRecordCount(fixtureIds[0])).toBe(1)
  })
  it('식물 삭제 차단 후 타이머 취소를 거쳐 삭제를 재시도한다', async () => {
    open()
    await start()
    await click('식물 관리 메뉴')
    await click('식물 삭제')
    await click('삭제할게요')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '타이머를 종료하거나 취소',
    )
    await click('취소')
    await click('기록 없이 취소')
    await click('기록 없이 종료')
    await screen.findByText('기록 없이 타이머를 종료했어요.')
    await click('식물 관리 메뉴')
    await click('식물 삭제')
    await click('삭제할게요')
    await screen.findByRole('heading', { name: '나의 작은 정원' })
    expect(await context.repos.plants.getById(fixtureIds[0])).toBeUndefined()
  })
})
