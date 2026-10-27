import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaStatus } from './PwaStatus'
let container: EventTarget & {
  register: ReturnType<typeof vi.fn>
  ready: Promise<unknown>
  controller: object
}
let postMessage: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('PROD', true)
  vi.stubGlobal('isSecureContext', true)
  postMessage = vi.fn()
  const registration = Object.assign(new EventTarget(), {
    waiting: { postMessage },
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  })
  container = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: container,
    configurable: true,
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})
describe('PWA 연결 및 안전한 업데이트 안내', () => {
  it('작성 화면에서는 업데이트 적용을 막아 작성 중인 내용을 보호한다', async () => {
    render(<PwaStatus canUpdate={false} />)
    expect(
      await screen.findByRole('button', { name: '업데이트 적용' }),
    ).toBeDisabled()
    expect(screen.getByText(/작성 내용을 저장/)).toBeInTheDocument()
    expect(postMessage).not.toHaveBeenCalled()
  })
  it('사용자가 요청할 때만 활성화를 요청하고 여러 창 안내 후 다시 시도할 수 있다', async () => {
    const user = userEvent.setup()
    render(<PwaStatus canUpdate />)
    await user.click(
      await screen.findByRole('button', { name: '업데이트 적용' }),
    )
    expect(postMessage).toHaveBeenCalledWith({ type: 'ACTIVATE_UPDATE' })
    act(() => {
      container.dispatchEvent(
        new MessageEvent('message', { data: { type: 'UPDATE_BLOCKED' } }),
      )
    })
    expect(screen.getByRole('alert')).toHaveTextContent('다른 Leafory 창')
    expect(screen.getByRole('button', { name: '업데이트 적용' })).toBeEnabled()
  })
  it('오프라인에서는 로컬 기능과 외부 출처·업데이트 제한을 안내한다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<PwaStatus canUpdate />)
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '필요한 앱 파일이 저장돼 있으면',
      ),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '외부 출처와 업데이트는 연결 후',
    )
  })
})
