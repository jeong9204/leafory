import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('기본 라우팅', () => {
  it.each([
    ['/', '홈'],
    ['/plants/new', '식물 등록'],
    ['/plants/plant-1', '식물 상세'],
    ['/plants/plant-1/diary/new', '일기 작성'],
    ['/records', '기록 목록'],
    ['/unknown', '페이지를 찾을 수 없습니다'],
  ])('%s 경로에 맞는 화면을 표시한다', (path, title) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
  })

  it('탐색 링크로 기록 목록과 홈 사이를 이동한다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: '기록 목록' }))
    expect(
      screen.getByRole('heading', { name: '기록 목록' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '홈' }))
    expect(screen.getByRole('heading', { name: '홈' })).toBeInTheDocument()
  })
})
