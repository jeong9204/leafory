import { useLayoutEffect, useMemo, useRef } from 'react'
import type { MouseEvent, RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { internalPath } from '../lib/navigation'
import {
  readDetailPosition,
  saveDetailPosition,
  validScrollY,
} from '../lib/plant-detail-position'
import type { DetailPosition } from '../lib/plant-detail-position'

/** Own restoration only for plant-detail history entries, after repository rendering. */
export function usePlantDetailScroll(
  ready: boolean,
  root: RefObject<HTMLDivElement | null>,
  warm = false,
) {
  const location = useLocation()
  const type = useNavigationType()
  const href = location.pathname + location.search + location.hash
  const saved = useMemo(
    () => (type === 'POP' ? readDetailPosition(location.key, href) : undefined),
    [type, location.key, href],
  )
  const capture = useRef<(() => void) | undefined>(undefined)
  const leaving = useRef(false)
  const nativeMode = useRef<'auto' | 'manual'>('auto')

  useLayoutEffect(() => {
    leaving.current = false
    // scrollRestoration belongs to a history entry. Leave detail entries manual so
    // POP cannot restore against the short loading DOM. Restore the destination's
    // previous mode on exit; records and all other pages keep their existing policy.
    const supported = typeof history.scrollRestoration === 'string'
    nativeMode.current =
      saved?.nativeMode ??
      (history.scrollRestoration === 'manual' ? 'manual' : 'auto')
    if (supported) history.scrollRestoration = 'manual'
    return () => {
      if (supported) history.scrollRestoration = nativeMode.current
    }
  }, [location.key, saved])

  useLayoutEffect(() => {
    if (!ready || !root.current) return
    let last: DetailPosition = saved ?? {
      href,
      y: window.scrollY,
      tab: 'timeline',
      nativeMode: nativeMode.current,
    }
    let pending = Boolean(saved)
    let frame: number | undefined
    let cancelled = false
    let pendingTarget = saved
    const layoutObserver = new MutationObserver(() => {
      if (pending && pendingTarget && !cancelled) restore(pendingTarget)
    })
    const remember = () => {
      if (leaving.current || pending) return
      last = {
        href,
        y: Math.max(0, window.scrollY),
        tab:
          root.current?.querySelector('[role="tab"][aria-selected="true"]')
            ?.id === 'detail-tab-photos'
            ? 'photos'
            : 'timeline',
        nativeMode: nativeMode.current,
      }
      saveDetailPosition(location.key, last)
    }
    const restore = (position: DetailPosition) => {
      if (cancelled) return
      pending = true
      pendingTarget = position
      if (root.current)
        layoutObserver.observe(root.current, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-layout-pending'],
        })
      if (frame !== undefined) cancelAnimationFrame(frame)
      if (root.current?.querySelector('[data-layout-pending="true"]')) return
      const apply = () => {
        if (
          cancelled ||
          !root.current ||
          root.current.querySelector('[data-layout-pending="true"]')
        )
          return
        root.current.getBoundingClientRect()
        const scrolling = document.scrollingElement ?? document.documentElement
        window.scrollTo({
          top: validScrollY(
            position.y,
            scrolling.scrollHeight,
            scrolling.clientHeight || window.innerHeight,
          ),
          left: 0,
          behavior: 'instant',
        })
        pending = false
        layoutObserver.disconnect()
        remember()
      }
      // A warm view already has its content and timer geometry. Restore in this
      // layout effect, before painting the old entry at the diary's scrollY.
      if (warm) apply()
      else
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(apply)
        })
    }

    const userIntent = () => {
      if (!pending) return
      cancelled = true
      layoutObserver.disconnect()
      pending = false
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        cancelled = false
        restore(last)
      }
    }
    capture.current = () => {
      cancelled = true
      layoutObserver.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
      pending = false
      remember()
    }
    window.addEventListener('scroll', remember, { passive: true })
    window.addEventListener('pagehide', remember)
    window.addEventListener('pageshow', pageShow)
    window.addEventListener('touchstart', userIntent, { passive: true })
    window.addEventListener('wheel', userIntent, { passive: true })
    window.addEventListener('pointerdown', userIntent)
    window.addEventListener('keydown', userIntent)
    if (saved) restore(saved)
    else remember()
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      capture.current = undefined
      layoutObserver.disconnect()
      window.removeEventListener('scroll', remember)
      window.removeEventListener('pagehide', remember)
      window.removeEventListener('pageshow', pageShow)
      window.removeEventListener('touchstart', userIntent)
      window.removeEventListener('wheel', userIntent)
      window.removeEventListener('pointerdown', userIntent)
      window.removeEventListener('keydown', userIntent)
      // Cleanup can run after the page has shrunk: never sample scrollY here.
      if (!leaving.current) saveDetailPosition(location.key, last)
    }
  }, [ready, saved, root, href, location.key, warm])

  function beforeLink(event: MouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    const link = (event.target as Element).closest?.('a[href]')
    if (
      !link ||
      (link.getAttribute('target') &&
        link.getAttribute('target') !== '_self') ||
      !internalPath(link.getAttribute('href'))
    )
      return
    capture.current?.()
    leaving.current = true
  }
  return { beforeLink, restoring: Boolean(saved), initialTab: saved?.tab }
}
