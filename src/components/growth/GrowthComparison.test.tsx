import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GrowthPhoto } from '../../app/growth-service'
import { GrowthComparison } from './GrowthComparison'
const photos: GrowthPhoto[] = [1, 2, 3].map((n) => ({
  id: `p${n}`,
  entryId: `e${n}`,
  date: `2026-0${n}-01`,
  title: `관찰 ${n}`,
  blob: new Blob([String(n)], { type: 'image/png' }),
}))

describe('사진 선택과 성장 비교', () => {
  it.each([0, 1])(
    '%i장일 때 안내하고 비교와 빠른 선택을 비활성화한다',
    (count) => {
      render(<GrowthComparison photos={photos.slice(0, count)} />)
      expect(screen.getByText(/두 장 이상 필요/)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '선택한 사진 비교' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: '처음·최근 사진 선택' }),
      ).toBeDisabled()
    },
  )
  it('두 장만 선택할 수 있고 해제하면 다른 사진을 고를 수 있다', async () => {
    const user = userEvent.setup()
    render(<GrowthComparison photos={photos} />)
    const boxes = screen.getAllByRole('checkbox')
    await user.click(boxes[0])
    await user.click(boxes[1])
    expect(boxes[2]).toBeDisabled()
    await user.click(boxes[0])
    await user.click(boxes[2])
    expect(boxes[0]).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: '선택한 사진 비교' }))
    const pair = screen.getByRole('group', { name: '선택한 사진 두 장' })
    expect(within(pair).getAllByRole('img')).toHaveLength(2)
    expect(within(pair).getByText('관찰 2')).toBeVisible()
    expect(within(pair).getByText('관찰 3')).toBeVisible()
  })
  it('처음·최근 선택과 재선택을 지원하고 각 일기 날짜를 표시한다', async () => {
    const user = userEvent.setup()
    render(<GrowthComparison photos={photos} />)
    await user.click(
      screen.getByRole('button', { name: '처음·최근 사진 선택' }),
    )
    await user.click(screen.getByRole('button', { name: '선택한 사진 비교' }))
    const pair = screen.getByRole('group', { name: '선택한 사진 두 장' })
    expect(pair.querySelectorAll('time')[0]).toHaveAttribute(
      'datetime',
      '2026-01-01',
    )
    expect(pair.querySelectorAll('time')[1]).toHaveAttribute(
      'datetime',
      '2026-03-01',
    )
    await user.click(screen.getByRole('button', { name: '사진 다시 선택' }))
    expect(
      screen
        .getAllByRole('checkbox')
        .filter((el) => (el as HTMLInputElement).checked),
    ).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '선택 초기화' }))
    expect(
      screen
        .getAllByRole('checkbox')
        .every((el) => !(el as HTMLInputElement).checked),
    ).toBe(true)
  })
  it('비교 중 사진이 없어지면 남은 선택만 유지하고 재선택을 안내한다', async () => {
    const user = userEvent.setup()
    const view = render(<GrowthComparison photos={photos} />)
    await user.click(
      screen.getByRole('button', { name: '처음·최근 사진 선택' }),
    )
    await user.click(screen.getByRole('button', { name: '선택한 사진 비교' }))
    view.rerender(<GrowthComparison photos={photos.slice(1)} />)
    expect(screen.getByText(/삭제되었거나 일기에서 제외/)).toBeVisible()
    expect(
      screen.queryByRole('group', { name: '선택한 사진 두 장' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '선택한 사진 비교' }),
    ).toBeDisabled()
    await user.click(screen.getAllByRole('checkbox')[0])
    expect(
      screen.getByRole('heading', { name: '비교할 사진 선택' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: '선택한 사진 비교' }),
    ).toBeEnabled()
  })
  it('선택/비교 전환과 언마운트에서 생성한 Blob URL을 모두 해제한다', async () => {
    const user = userEvent.setup()
    const create = vi.spyOn(URL, 'createObjectURL')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    try {
      const view = render(<GrowthComparison photos={photos} />)
      await user.click(
        screen.getByRole('button', { name: '처음·최근 사진 선택' }),
      )
      await user.click(screen.getByRole('button', { name: '선택한 사진 비교' }))
      view.unmount()
      for (const value of create.mock.results)
        expect(revoke).toHaveBeenCalledWith(value.value)
    } finally {
      create.mockRestore()
      revoke.mockRestore()
    }
  })
})
