import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { InstallPage } from './InstallPage'
describe('홈 화면 설치 안내', () => {
  it('Safari·Chrome 안내와 오프라인 제한 및 백업 이동을 제공한다', () => {
    render(
      <MemoryRouter>
        <InstallPage />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'iPhone · iPad' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Android' })).toBeInTheDocument()
    expect(screen.getByText(/처음에는 온라인에서 앱을 열고/)).toHaveTextContent(
      '앱 파일(캐시)이 남아 있고',
    )
    expect(screen.getByText(/계정과 클라우드 동기화/)).toBeInTheDocument()
    expect(screen.getByText(/브라우저가 정리한 경우/)).toBeInTheDocument()
    expect(
      screen.getByText(/외부 출처 보기와 새 버전 다운로드/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '데이터 백업·복원' }),
    ).toHaveAttribute('href', '/backup')
  })
})
