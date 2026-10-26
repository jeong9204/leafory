/// <reference types="node" />
// fake-indexeddb uses Node structuredClone; jsdom Blob is not cloneable by it.
import { Blob as NodeBlob } from 'node:buffer'
import { act, fireEvent, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'
import { preparePlantPhoto } from '../lib/plant-photo'
vi.mock('../lib/plant-photo', async (original) => ({
  ...(await original<typeof import('../lib/plant-photo')>()),
  preparePlantPhoto: vi.fn(),
}))
let context: ReturnType<typeof testDatabase>
let plantId: string
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({
      name: '일기 초록이',
      status: 'healthy',
    })
  ).id
  vi.mocked(preparePlantPhoto).mockImplementation(async (file) => ({
    blob: new Blob([file.name], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    capturedAt: new Date().toISOString(),
  }))
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await context.db.delete()
})
const file = (name = 'one.jpg') =>
  new File(['image'], name, { type: 'image/jpeg' })
async function editor() {
  renderApp(context.repos, `/plants/${plantId}/diary/new`)
  await screen.findByRole('form', { name: '사진 일기 폼' })
}
describe('사진 일기 UI', () => {
  it('사진 여러 장과 과거 날짜를 저장하고 상세·타임라인·총 기록 수를 갱신한다', async () => {
    const user = userEvent.setup()
    await editor()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    fireEvent.input(screen.getByLabelText('일기 날짜'), {
      target: { value: '2025-01-02' },
    })
    await user.selectOptions(screen.getByLabelText('오늘의 식물 상태'), 'good')
    await user.type(screen.getByLabelText(/제목/), '첫 새잎')
    await user.type(screen.getByLabelText(/관찰 메모/), '잎을 관찰했어요.')
    await user.upload(screen.getByLabelText('일기 사진 여러 장 선택'), [
      file(),
      file('two.jpg'),
    ])
    await screen.findByRole('img', { name: '첨부 사진 2' })
    await user.click(screen.getByRole('button', { name: '사진 2 앞으로 이동' }))
    await user.click(screen.getByRole('button', { name: '일기 저장' }))
    await screen.findByRole('heading', { name: '첫 새잎' })
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('상태 · 좋음')).toBeInTheDocument()
    const entry = (await context.repos.diaries.listByPlant(plantId))[0]
    expect(entry.entryDate).toBe('2025-01-02')
    const photos = await context.repos.photos.listByPlant(plantId)
    expect(photos.map((p) => p.sortOrder)).toEqual([0, 1])
    expect(await Promise.all(photos.map((p) => p.blob.text()))).toEqual([
      'two.jpg',
      'one.jpg',
    ])
    await user.click(screen.getByRole('link', { name: '식물 상세로 돌아가기' }))
    await screen.findByRole('heading', { name: '일기 초록이' })
    expect(screen.getByText('1개')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '첫 새잎 일기 보기' }),
    ).toBeInTheDocument()
  })
  it('기존 일기의 사진 순서 변경·삭제와 제목 수정을 저장한다', async () => {
    const user = userEvent.setup()
    const entry = await context.repos.diaries.create({
      plantId,
      entryDate: '2025-01-02',
      condition: 'normal',
      title: '원본',
    })
    for (let i = 0; i < 2; i++)
      await context.repos.photos.create({
        plantId,
        entryId: entry.id,
        blob: new Blob([`photo${i}`], { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
        capturedAt: new Date().toISOString(),
        sortOrder: i,
      })
    renderApp(context.repos, `/plants/${plantId}/diary/${entry.id}/edit`)
    await screen.findByRole('img', { name: '첨부 사진 2' })
    await user.click(screen.getByRole('button', { name: '사진 2 앞으로 이동' }))
    await user.click(screen.getByRole('button', { name: '사진 2 삭제' }))
    await user.clear(screen.getByLabelText(/제목/))
    await user.type(screen.getByLabelText(/제목/), '수정 일기')
    await user.click(screen.getByRole('button', { name: '일기 저장' }))
    await screen.findByRole('heading', { name: '수정 일기' })
    const remaining = await context.repos.photos.listByPlant(plantId)
    expect(remaining).toHaveLength(1)
    expect(await remaining[0].blob.text()).toBe('photo1')
    expect((await context.repos.diaries.getById(entry.id))?.title).toBe(
      '수정 일기',
    )
  })
  it('저장 실패 시 입력과 사진을 유지하며 반복 제출을 막는다', async () => {
    const user = userEvent.setup()
    await editor()
    await user.type(screen.getByLabelText(/제목/), '유지할 일기')
    await user.upload(screen.getByLabelText('일기 사진 여러 장 선택'), [
      file(),
      file('two.jpg'),
    ])
    await screen.findByRole('img', { name: '첨부 사진 2' })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const spy = vi
      .spyOn(context.repos, 'runInTransaction')
      .mockImplementationOnce(async () => {
        await gate
        throw new Error('quota')
      })
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    expect(spy).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled()
    await act(async () => release())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '입력 내용과 사진을 유지',
    )
    expect(screen.getByLabelText(/제목/)).toHaveValue('유지할 일기')
    expect(screen.getByRole('img', { name: '첨부 사진 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '일기 저장' }))
    await screen.findByRole('heading', { name: '유지할 일기' })
    expect(await context.repos.diaries.listByPlant(plantId)).toHaveLength(1)
  })
  it('삭제 실패는 재시도할 수 있고 삭제 후 관리 이벤트는 유지한다', async () => {
    const user = userEvent.setup()
    const entry = await context.repos.diaries.create({
      plantId,
      entryDate: '2025-01-02',
      condition: 'normal',
    })
    await context.repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date().toISOString(),
    })
    renderApp(context.repos, `/plants/${plantId}/diary/${entry.id}`)
    await user.click(await screen.findByRole('button', { name: '일기 삭제' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }),
    )
    expect(await context.repos.diaries.getById(entry.id)).toBeDefined()
    await user.click(screen.getByRole('button', { name: '일기 삭제' }))
    vi.spyOn(context.repos.diaries, 'delete').mockRejectedValueOnce(
      new Error('blocked'),
    )
    await user.click(screen.getByRole('button', { name: '삭제할게요' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '삭제하지 못했어요',
    )
    await user.click(screen.getByRole('button', { name: '삭제할게요' }))
    await screen.findByRole('heading', { name: '물주기 완료' })
    expect(screen.getByText('1개')).toBeInTheDocument()
    expect(await context.repos.careEvents.listByPlant(plantId)).toHaveLength(1)
  })
  it('사진 제거 시 Blob URL을 해제하고 이탈 취소 시 입력을 유지한다', async () => {
    const user = userEvent.setup()
    await editor()
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    await user.upload(screen.getByLabelText('일기 사진 여러 장 선택'), file())
    await screen.findByRole('img', { name: '첨부 사진 1' })
    await user.click(screen.getByRole('button', { name: '사진 1 삭제' }))
    expect(revoke).toHaveBeenCalled()
    await user.type(screen.getByLabelText(/제목/), '작성 중')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '계속 작성' }))
    expect(screen.getByLabelText(/제목/)).toHaveValue('작성 중')
    fireEvent.focus(window)
    await waitFor(() =>
      expect(screen.getByLabelText(/제목/)).toHaveValue('작성 중'),
    )
  })
  it('잘못된 이미지와 장수 제한을 안내하고 기존 사진은 유지한다', async () => {
    const user = userEvent.setup()
    await editor()
    await user.upload(screen.getByLabelText('일기 사진 여러 장 선택'), file())
    await screen.findByRole('img', { name: '첨부 사진 1' })
    vi.mocked(preparePlantPhoto).mockRejectedValueOnce(
      new Error('파일 내용과 사진 형식이 일치하지 않습니다.'),
    )
    await user.upload(
      screen.getByLabelText('일기 사진 여러 장 선택'),
      file('broken.jpg'),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('사진 형식')
    expect(screen.getByRole('img', { name: '첨부 사진 1' })).toBeInTheDocument()
    await user.upload(
      screen.getByLabelText('일기 사진 여러 장 선택'),
      Array.from({ length: 10 }, (_, i) => file(`${i}.jpg`)),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('최대 10장')
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
  it('없는 일기와 다른 식물 소속의 주소를 안내한다', async () => {
    const other = await context.repos.plants.create({
      name: '다른 식물',
      status: 'healthy',
    })
    const entry = await context.repos.diaries.create({
      plantId: other.id,
      entryDate: '2025-01-02',
      condition: 'normal',
    })
    renderApp(context.repos, `/plants/${plantId}/diary/${entry.id}/edit`)
    expect(
      await screen.findByRole('heading', {
        name: '식물 또는 일기를 찾을 수 없습니다',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})
