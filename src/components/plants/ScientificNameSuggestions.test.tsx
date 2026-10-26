import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScientificNameSuggestions } from './ScientificNameSuggestions'

describe('간결한 학명 추천 UI', () => {
  it('여러 후보는 이름과 학명만 표시하고 설명과 출처는 기본적으로 숨긴다', () => {
    render(<ScientificNameSuggestions query="스투키" onSelect={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('2개 후보')
    expect(screen.getAllByRole('button', { name: /학명 선택$/ })).toHaveLength(
      2,
    )
    expect(screen.getByText('Dracaena angolensis')).toBeVisible()
    expect(screen.getByText('Dracaena stuckyi')).toBeVisible()
    for (const button of screen.getAllByRole('button', {
      name: /자세히 보기/,
    })) {
      expect(button).toHaveAttribute('aria-expanded', 'false')
      const panel = document.getElementById(
        button.getAttribute('aria-controls')!,
      )
      expect(panel).not.toBeVisible()
    }
    expect(
      screen.queryByRole('link', { name: /Kew 분류 출처/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('이 학명 선택')).not.toBeInTheDocument()
  })
  it('키보드로 자세히 보기를 펼치고 닫을 수 있으며 학명을 선택하거나 제출하지 않는다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSubmit = vi.fn((event) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <ScientificNameSuggestions query="스투키" onSelect={onSelect} />
      </form>,
    )
    const toggle = screen.getByRole('button', {
      name: '자세히 보기 · Dracaena angolensis',
    })
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/stuckyi와 다른 종/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Kew 분류 출처.*Dracaena angolensis/ }),
    ).toHaveAttribute(
      'href',
      'https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:77182375-1',
    )
    expect(
      screen.getByRole('button', { name: '자세히 보기 · Dracaena stuckyi' }),
    ).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('link', { name: /Kew 분류 출처/ }),
    ).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
  it('이름·학명 영역을 선택하면 학명만 전달하고 설명은 자동으로 펼치지 않는다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ScientificNameSuggestions query="스투키" onSelect={onSelect} />)
    await user.click(
      screen.getByRole('button', { name: /Dracaena stuckyi 학명 선택/ }),
    )
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Dracaena stuckyi')
    expect(
      screen.queryByRole('link', { name: /Kew 분류 출처/ }),
    ).not.toBeInTheDocument()
  })
  it('다른 검색 결과로 바뀌면 이전 후보의 펼침 상태가 새 후보로 넘어가지 않는다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { rerender } = render(
      <ScientificNameSuggestions query="스투키" onSelect={onSelect} />,
    )
    await user.click(
      screen.getByRole('button', { name: '자세히 보기 · Dracaena angolensis' }),
    )
    rerender(<ScientificNameSuggestions query="극락조" onSelect={onSelect} />)
    expect(screen.getAllByRole('button', { name: /학명 선택$/ })).toHaveLength(
      2,
    )
    for (const toggle of screen.getAllByRole('button', { name: /자세히 보기/ }))
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('link', { name: /Kew 분류 출처/ }),
    ).not.toBeInTheDocument()
  })
})
