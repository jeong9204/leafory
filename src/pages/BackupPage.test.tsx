/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'
import { exportBackup, prepareBackup } from '../app/backup-service'
import { snapshotCounts } from '../domain/backup'
import type { PreparedBackup } from '../app/backup-service'
vi.mock('../app/backup-service', async (original) => ({
  ...(await original<typeof import('../app/backup-service')>()),
  exportBackup: vi.fn(),
  prepareBackup: vi.fn(),
}))
let context: ReturnType<typeof testDatabase>, backup: PreparedBackup
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  context = testDatabase()
  await context.repos.plants.create({ name: '백업 식물', status: 'healthy' })
  const data = await context.repos.backup.snapshot()
  backup = {
    data,
    counts: snapshotCounts(data),
    createdAt: '2026-10-26T01:00:00Z',
    sizeBytes: 1024,
  }
  await context.repos.plants.create({ name: '현재 기록', status: 'healthy' })
  vi.mocked(prepareBackup).mockResolvedValue(backup)
  vi.mocked(exportBackup).mockResolvedValue({
    blob: new Blob(['zip'], { type: 'application/zip' }),
    filename: 'leafory-backup-test.zip',
    counts: backup.counts,
  })
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await context.db.delete()
})
async function select() {
  const user = userEvent.setup()
  renderApp(context.repos, '/backup')
  await screen.findByRole('heading', { name: '데이터 백업' })
  await user.upload(
    screen.getByLabelText('복원할 백업 ZIP 선택'),
    new File(['zip'], 'leafory.zip', { type: 'application/zip' }),
  )
  await screen.findByRole('heading', { name: '검증 완료' })
  return user
}
describe('백업 관리 UI', () => {
  it('홈의 백업 진입 링크와 내보내기·가져오기를 구분한다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos)
    await user.click(
      await screen.findByRole('link', { name: '데이터 백업·복원' }),
    )
    expect(
      await screen.findByRole('heading', { name: '내보내기' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '가져오기' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/백업은 암호화되지/)).toBeInTheDocument()
  })
  it('검증된 파일도 명시적 확인과 동의 없이 복원하지 않는다', async () => {
    const user = await select()
    expect(await context.repos.plants.list()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '복원 내용 확인' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/모두 삭제되고/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: '전체 교체 복원' }),
    ).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(await context.repos.plants.list()).toHaveLength(2)
  })
  it('동의 후 전체 교체하고 중복 복원을 막으며 통계를 갱신한다', async () => {
    const user = await select()
    await user.click(screen.getByRole('button', { name: '복원 내용 확인' }))
    await screen.findByRole('dialog')
    await user.click(await screen.findByRole('checkbox'))
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const original = context.repos.backup.replace
    const spy = vi
      .spyOn(context.repos.backup, 'replace')
      .mockImplementation(async (data) => {
        await gate
        return original(data)
      })
    const replace = screen.getByRole('button', { name: '전체 교체 복원' })
    fireEvent.click(replace)
    fireEvent.click(replace)
    expect(spy).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '복원 중…' })).toBeDisabled()
    await act(async () => release())
    expect(await screen.findByText(/복원을 완료했어요/)).toBeInTheDocument()
    expect((await context.repos.plants.list()).map((p) => p.name)).toEqual([
      '백업 식물',
    ])
  })
  it('검증 실패는 원본을 유지하고 복원 버튼을 표시하지 않는다', async () => {
    const user = userEvent.setup()
    vi.mocked(prepareBackup).mockRejectedValueOnce(new Error('corrupt'))
    renderApp(context.repos, '/backup')
    await screen.findByRole('heading', { name: '데이터 백업' })
    await user.upload(
      screen.getByLabelText('복원할 백업 ZIP 선택'),
      new File(['bad'], 'bad.zip', { type: 'application/zip' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '작업을 완료하지 못했어요',
    )
    expect(
      screen.queryByRole('button', { name: '복원 내용 확인' }),
    ).not.toBeInTheDocument()
    expect(await context.repos.plants.list()).toHaveLength(2)
  })
  it('공간 부족 실패 시 원본 보존을 안내하고 재시도할 수 있다', async () => {
    const user = await select()
    vi.spyOn(context.repos.backup, 'replace').mockRejectedValueOnce(
      new DOMException('quota', 'QuotaExceededError'),
    )
    await user.click(screen.getByRole('button', { name: '복원 내용 확인' }))
    await screen.findByRole('dialog')
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '전체 교체 복원' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장 공간이 부족',
    )
    expect(await context.repos.plants.list()).toHaveLength(2)
    expect(screen.getByRole('button', { name: '복원 내용 확인' })).toBeEnabled()
  })
  it('내보내기 중 반복 실행을 막고 다운로드 URL을 해제한다', async () => {
    const user = userEvent.setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.mocked(exportBackup).mockImplementationOnce(async () => {
      await gate
      return {
        blob: new Blob(['zip']),
        filename: 'leafory-backup.zip',
        counts: backup.counts,
      }
    })
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const view = renderApp(context.repos, '/backup')
    const button = await screen.findByRole('button', {
      name: '백업 파일 만들기',
    })
    await user.click(button)
    fireEvent.click(button)
    expect(exportBackup).toHaveBeenCalledOnce()
    await act(async () => release())
    expect(
      await screen.findByRole('link', { name: 'ZIP 다운로드' }),
    ).toHaveAttribute('download', 'leafory-backup.zip')
    view.unmount()
    expect(revoke).toHaveBeenCalled()
  })
  it('타이머가 있으면 복원을 차단하고 소유 식물의 종료·취소 화면으로 이동한다', async () => {
    const plant = (await context.repos.plants.list())[0]
    await context.repos.lightTimer.start(plant.id)
    const user = await select()
    await user.click(screen.getByRole('button', { name: '복원 내용 확인' }))
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '전체 교체 복원' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '타이머를 종료하거나 취소',
    )
    expect(await context.repos.plants.list()).toHaveLength(2)
    await user.click(screen.getByRole('link', { name: '타이머 식물로 이동' }))
    await user.click(
      await screen.findByRole('button', { name: '기록 없이 취소' }),
    )
    await user.click(
      await screen.findByRole('button', { name: '기록 없이 종료' }),
    )
    await screen.findByText('기록 없이 타이머를 종료했어요.')
    expect(await context.repos.lightTimer.get()).toBeUndefined()
  })
})
