import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'
import { preparePlantPhoto } from '../lib/plant-photo'
vi.mock('../lib/plant-photo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/plant-photo')>()),
  preparePlantPhoto: vi.fn(),
}))
let context: ReturnType<typeof testDatabase>
beforeEach(() => {
  context = testDatabase()
  vi.mocked(preparePlantPhoto).mockResolvedValue({
    blob: new Blob(['photo'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    capturedAt: new Date().toISOString(),
  })
})
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
async function editor() {
  renderApp(context.repos, '/plants/new')
  await screen.findByRole('form', { name: '식물 등록 폼' })
}
describe('식물 등록과 관리 UI', () => {
  it('필수 이름만으로 저장하고 실제 ID 상세와 홈 수를 갱신한다', async () => {
    const user = userEvent.setup()
    await editor()
    await user.type(screen.getByLabelText(/식물 이름/), '처음 만난 식물')
    fireEvent.input(screen.getByLabelText(/데려온 날짜/), {
      target: { value: '2026-10-24' },
    })
    await user.click(screen.getByRole('button', { name: '식물 등록' }))
    expect(
      await screen.findByRole('heading', { name: '처음 만난 식물' }),
    ).toBeInTheDocument()
    expect(await context.repos.plants.list()).toHaveLength(1)
    expect((await context.repos.plants.list())[0].acquiredAt).toBe('2026-10-24')
    await user.click(screen.getByRole('link', { name: '홈' }))
    expect(
      await screen.findByRole('link', { name: '함께하는 식물 1' }),
    ).toBeInTheDocument()
  })
  it('공백 이름과 저장 실패를 안내하고 입력과 사진을 유지한다', async () => {
    const user = userEvent.setup()
    await editor()
    await user.type(screen.getByLabelText(/식물 이름/), '   ')
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('이름')
    expect(await context.repos.plants.list()).toEqual([])
    await user.clear(screen.getByLabelText(/식물 이름/))
    await user.type(screen.getByLabelText(/식물 이름/), '기억할 이름')
    await user.type(screen.getByLabelText(/식물 메모/), '잊지 않을 메모')
    await user.upload(
      screen.getByLabelText('갤러리에서 대표 사진 선택'),
      new File(['jpg'], 'test.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByRole('img', { name: '대표 사진 미리보기' })
    vi.spyOn(context.repos, 'runInTransaction').mockRejectedValueOnce(
      new Error('quota'),
    )
    await user.click(screen.getByRole('button', { name: '식물 등록' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '입력 내용을 유지',
    )
    expect(screen.getByLabelText(/식물 이름/)).toHaveValue('기억할 이름')
    expect(screen.getByLabelText(/식물 메모/)).toHaveValue('잊지 않을 메모')
    expect(
      screen.getByRole('img', { name: '대표 사진 미리보기' }),
    ).toBeInTheDocument()
  })
  it('저장 중 제출이 반복되어도 저장은 한 번만 실행한다', async () => {
    const user = userEvent.setup()
    await editor()
    await user.type(screen.getByLabelText(/식물 이름/), '하나만 등록')
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const original = context.repos.runInTransaction
    const spy = vi
      .spyOn(context.repos, 'runInTransaction')
      .mockImplementation(async (work) => {
        await gate
        return original(work)
      })
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    expect(spy).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled()
    await act(async () => release())
    await screen.findByRole('heading', { name: '하나만 등록' })
    expect(await context.repos.plants.list()).toHaveLength(1)
  })
  it('카메라·갤러리 선택 경로를 제공하고 잘못된 사진은 안내한다', async () => {
    const user = userEvent.setup()
    await editor()
    expect(screen.getByLabelText('카메라로 대표 사진 선택')).toHaveAttribute(
      'capture',
      'environment',
    )
    expect(
      screen.getByLabelText('갤러리에서 대표 사진 선택'),
    ).not.toHaveAttribute('capture')
    vi.mocked(preparePlantPhoto).mockRejectedValueOnce(
      new Error('사진 파일이 올바르지 않아요.'),
    )
    await user.upload(
      screen.getByLabelText('갤러리에서 대표 사진 선택'),
      new File(['x'], 'x.jpg', { type: 'image/jpeg' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('사진 파일')
    expect(
      screen.getByRole('img', { name: '대표 사진 미리보기 (사진 없음)' }),
    ).toBeInTheDocument()
  })
  it('정보 수정 저장과 삭제 확인/취소 후 삭제를 지원한다', async () => {
    const user = userEvent.setup()
    const p = await context.repos.plants.create({
      name: '기존 이름',
      status: 'healthy',
    })
    renderApp(context.repos, `/plants/${p.id}/edit`)
    const name = await screen.findByLabelText(/식물 이름/)
    await user.clear(name)
    await user.type(name, '바뀐 이름')
    await user.selectOptions(screen.getByLabelText('식물 상태'), 'concern')
    await user.click(screen.getByRole('button', { name: '수정 저장' }))
    await screen.findByRole('heading', { name: '바뀐 이름' })
    expect((await context.repos.plants.getById(p.id))?.status).toBe('concern')
    await user.click(screen.getByRole('button', { name: '식물 관리 메뉴' }))
    await user.click(screen.getByRole('button', { name: '식물 삭제' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(await context.repos.plants.getById(p.id)).toBeDefined()
    await user.click(screen.getByRole('button', { name: '식물 관리 메뉴' }))
    await user.click(screen.getByRole('button', { name: '식물 삭제' }))
    vi.spyOn(context.repos.plants, 'delete').mockRejectedValueOnce(
      new Error('delete blocked'),
    )
    await user.click(screen.getByRole('button', { name: '삭제할게요' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '삭제하지 못했어요',
    )
    expect(await context.repos.plants.getById(p.id)).toBeDefined()
    await user.click(screen.getByRole('button', { name: '삭제할게요' }))
    expect(
      await screen.findByText('첫 초록 친구를 만나 보세요'),
    ).toBeInTheDocument()
    expect(await context.repos.plants.getById(p.id)).toBeUndefined()
  })
  it('편집 폼에서 포커스를 되찾아도 작성 중 입력을 초기화하지 않는다', async () => {
    const user = userEvent.setup()
    await editor()
    await user.type(screen.getByLabelText(/식물 이름/), '작성 중')
    fireEvent.focus(window)
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() =>
      expect(screen.getByLabelText(/식물 이름/)).toHaveValue('작성 중'),
    )
  })
})
