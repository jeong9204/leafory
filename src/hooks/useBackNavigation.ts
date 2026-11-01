import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  browserHistoryIndex,
  internalPath,
  navigationSession,
  returnOrigin,
} from '../lib/navigation'

export function useNavigationOrigin() {
  const location = useLocation()
  const [session] = useState(navigationSession)
  const href = location.pathname + location.search + location.hash
  return internalPath(href)
    ? {
        version: 1 as const,
        session,
        href,
        key: location.key,
        index: browserHistoryIndex(),
      }
    : undefined
}
export function useBackNavigation(fallback: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const [session] = useState(navigationSession)
  const safeFallback = internalPath(fallback) ?? '/'
  const origin = returnOrigin(location.state, session, {
    href: location.pathname + location.search + location.hash,
    key: location.key,
    index: browserHistoryIndex(),
  })
  return {
    href: origin?.href ?? safeFallback,
    hasOrigin: Boolean(origin),
    replacementState: origin ? { leaforyNavigation: origin } : undefined,
    back: () =>
      origin ? navigate(-1) : navigate(safeFallback, { replace: true }),
  }
}
