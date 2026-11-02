import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useRef, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BackLink,
  NavigationLink,
} from '../components/navigation/NavigationLink'
import { usePlantDetailScroll } from './usePlantDetailScroll'
import {
  readDetailPosition,
  saveDetailPosition,
  validScrollY,
} from '../lib/plant-detail-position'
const plant = '/plants/c13d892e-140d-491a-8087-a8bcd80bab01'
const diary = `${plant}/diary/c13d892e-140d-491a-8087-a8bcd80bab02`
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let height: number
let initialReady: boolean
let initialTimerReady: boolean
let setTimerReady: (value: boolean) => void
let setReady: (value: boolean) => void
const originalMode = Object.getOwnPropertyDescriptor(
  history,
  'scrollRestoration',
)
const originalHeight = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'scrollHeight',
)
const originalClientHeight = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'clientHeight',
)
const originalY = Object.getOwnPropertyDescriptor(window, 'scrollY')
function Detail() {
  const [ready, update] = useState(initialReady)
  const [timerReady, updateTimer] = useState(initialTimerReady)
  useEffect(() => {
    setReady = update
    setTimerReady = updateTimer
  }, [])
  const root = useRef<HTMLDivElement>(null)
  const scroll = usePlantDetailScroll(ready, root)
  const [tab, setTab] = useState(scroll.initialTab ?? 'timeline')
  if (!ready) return <p role="status">로딩 중</p>
  return (
    <div ref={root} onClickCapture={scroll.beforeLink}>
      <h1>식물 상세</h1>
      <section data-layout-pending={!timerReady || undefined}>타이머</section>
      <button
        role="tab"
        id="detail-tab-timeline"
        aria-selected={tab === 'timeline'}
        onClick={() => setTab('timeline')}
      >
        타임라인
      </button>
      <button
        role="tab"
        id="detail-tab-photos"
        aria-selected={tab === 'photos'}
        onClick={() => setTab('photos')}
      >
        사진
      </button>
      <img src="blob:pending-photo" width="240" height="280" alt="느린 사진" />
      <NavigationLink to={diary}>일기 보기</NavigationLink>
    </div>
  )
}
function open() {
  const router = createMemoryRouter(
    [
      { path: plant, element: <Detail /> },
      {
        path: diary,
        element: (
          <>
            <h1>일기 상세</h1>
            <BackLink fallback={plant}>상단 뒤로</BackLink>
          </>
        ),
      },
    ],
    { initialEntries: [{ pathname: plant, key: crypto.randomUUID() }] },
  )
  render(<RouterProvider router={router} />)
  return router
}
function y(value: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value })
}
function flushFrame() {
  act(() => {
    const batch = [...frames]
    frames.clear()
    for (const [, callback] of batch) callback(0)
  })
}
async function leave(offset = 1200) {
  y(offset)
  fireEvent.scroll(window)
  await userEvent.setup().click(screen.getByRole('link', { name: '일기 보기' }))
  height = 844
  y(0)
  await screen.findByRole('heading', { name: '일기 상세' })
}
beforeEach(() => {
  frames = new Map()
  nextFrame = 0
  height = 4000
  initialReady = true
  initialTimerReady = true
  Object.defineProperty(history, 'scrollRestoration', {
    configurable: true,
    writable: true,
    value: 'auto',
  })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => height,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 844,
  })
  y(0)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.spyOn(window, 'scrollTo').mockImplementation((options: unknown) => {
    if (options && typeof options === 'object' && 'top' in options)
      y(Number(options.top ?? 0))
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const [target, name, descriptor] of [
    [history, 'scrollRestoration', originalMode],
    [document.documentElement, 'scrollHeight', originalHeight],
    [document.documentElement, 'clientHeight', originalClientHeight],
    [window, 'scrollY', originalY],
  ] as const) {
    if (descriptor) Object.defineProperty(target, name, descriptor)
    else Reflect.deleteProperty(target, name)
  }
})
describe('plant-detail POP scroll coordination', () => {
  it.each(['arrow', 'browser'] as const)(
    'waits for asynchronous content and two layout frames after %s back',
    async (method) => {
      const router = open()
      await leave(1200)
      expect(history.scrollRestoration).toBe('auto')
      initialReady = false
      if (method === 'arrow')
        await userEvent.setup().click(screen.getByText('상단 뒤로'))
      else await act(() => router.navigate(-1))
      expect(screen.getByRole('status')).toHaveTextContent('로딩 중')
      expect(history.scrollRestoration).toBe('manual')
      flushFrame()
      expect(window.scrollTo).not.toHaveBeenCalled()
      height = 4000
      act(() => setReady(true))
      flushFrame()
      expect(window.scrollTo).not.toHaveBeenCalled()
      flushFrame()
      expect(window.scrollY).toBe(1200)
      expect(window.scrollTo).toHaveBeenLastCalledWith({
        top: 1200,
        left: 0,
        behavior: 'instant',
      })
    },
  )
  it.each([0, 900, 2800])(
    'keeps valid original position %i instead of forcing the top',
    async (offset) => {
      const router = open()
      await leave(offset)
      height = 4000
      await act(() => router.navigate(-1))
      flushFrame()
      flushFrame()
      expect(window.scrollY).toBe(offset)
    },
  )
  it('clamps once against new content height after records have shortened the page', async () => {
    const router = open()
    await leave(2800)
    height = 1200
    await act(() => router.navigate(-1))
    flushFrame()
    flushFrame()
    expect(window.scrollY).toBe(356)
    expect(readDetailPosition(router.state.location.key, plant)?.y).toBe(356)
  })
  it('waits for the nested timer layout before clamping, avoiding the 143px late expansion', async () => {
    const router = open()
    await leave(669)
    initialTimerReady = false
    height = 1370
    await act(() => router.navigate(-1))
    flushFrame()
    flushFrame()
    expect(window.scrollTo).not.toHaveBeenCalled()
    height = 1513
    await act(async () => setTimerReady(true))
    flushFrame()
    flushFrame()
    expect(window.scrollY).toBe(669)
  })
  it('does not reset a new/direct entry, and leaves unrelated pages on their native policy', async () => {
    const router = open()
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(history.scrollRestoration).toBe('manual')
    await leave()
    expect(history.scrollRestoration).toBe('auto')
    expect(router.state.location.pathname).toBe(diary)
  })
  it('restores the photo tab, while slow Blob load does not change reserved boxes or trigger another jump', async () => {
    const router = open()
    await userEvent.setup().click(screen.getByRole('tab', { name: '사진' }))
    await leave(900)
    height = 4000
    await act(() => router.navigate(-1))
    flushFrame()
    flushFrame()
    expect(screen.getByRole('tab', { name: '사진' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const calls = vi.mocked(window.scrollTo).mock.calls.length
    fireEvent.load(screen.getByRole('img', { name: '느린 사진' }))
    flushFrame()
    expect(window.scrollY).toBe(900)
    expect(window.scrollTo).toHaveBeenCalledTimes(calls)
  })
  it('cancels pending restoration when the user starts scrolling', async () => {
    const router = open()
    await leave(900)
    height = 4000
    await act(() => router.navigate(-1))
    fireEvent.touchStart(window)
    y(200)
    fireEvent.scroll(window)
    flushFrame()
    flushFrame()
    expect(window.scrollY).toBe(200)
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
  it('restores the latest position on persisted pageshow and saves before pagehide', () => {
    const router = open()
    y(1100)
    fireEvent.scroll(window)
    fireEvent(window, new Event('pagehide'))
    expect(readDetailPosition(router.state.location.key, plant)?.y).toBe(1100)
    y(0)
    const event = new Event('pageshow')
    Object.defineProperty(event, 'persisted', { value: true })
    fireEvent(window, event)
    flushFrame()
    flushFrame()
    expect(window.scrollY).toBe(1100)
  })
  it('reads same-tab metadata with a new module instance, without reading records or Blobs', async () => {
    const key = crypto.randomUUID()
    saveDetailPosition(key, {
      href: plant,
      y: 750,
      tab: 'photos',
      nativeMode: 'auto',
    })
    vi.resetModules()
    const fresh = await import('../lib/plant-detail-position')
    expect(fresh.readDetailPosition(key, plant)).toEqual({
      href: plant,
      y: 750,
      tab: 'photos',
      nativeMode: 'auto',
    })
    expect(fresh.readDetailPosition(key, `${plant}?other=true`)).toBeUndefined()
  })
  it('uses a safe zero bound only when the document has no scrollable area', () => {
    expect(validScrollY(1200, 600, 844)).toBe(0)
    expect(validScrollY(1200, 4000, 844)).toBe(1200)
  })
})
