const SESSION_KEY = 'leafory.navigation.session.v1'
let memorySession: string | undefined

/** Only navigation UI metadata uses sessionStorage; never records, photos or DB state. */
export function navigationSession() {
  if (memorySession) return memorySession
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved && /^[a-f0-9-]{36}$/i.test(saved)) return (memorySession = saved)
  } catch {
    /* Private/storage-restricted browsers still support in-memory returns. */
  }
  memorySession = crypto.randomUUID()
  try {
    sessionStorage.setItem(SESSION_KEY, memorySession)
  } catch {
    /* Optional persistence. */
  }
  return memorySession
}
export function internalPath(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    Array.from(value).some((char) => char === '\\' || char.charCodeAt(0) <= 32)
  )
    return
  const url = new URL(value, 'https://leafory.invalid')
  if (
    url.origin !== 'https://leafory.invalid' ||
    value !== url.pathname + url.search + url.hash
  )
    return
  if (
    /^\/(?:records|calendar|backup|install)?$/.test(url.pathname) ||
    /^\/plants\/(?:new|[a-f0-9-]{36}(?:\/(?:edit|compare|care\/(?:new|[a-f0-9-]{36}\/edit)|diary\/(?:new|[a-f0-9-]{36}(?:\/edit)?)))?)$/i.test(
      url.pathname,
    )
  )
    return value
}
export interface NavigationOrigin {
  version: 1
  session: string
  href: string
  key: string
  index?: number
}
export function browserHistoryIndex(): number | undefined {
  const index: unknown = window.history.state?.idx
  return Number.isSafeInteger(index) && Number(index) >= 0
    ? Number(index)
    : undefined
}
export function returnOrigin(
  state: unknown,
  session: string,
  current: { href: string; key: string; index?: number },
): NavigationOrigin | undefined {
  if (!state || typeof state !== 'object' || !('leaforyNavigation' in state))
    return
  const raw = state.leaforyNavigation
  if (!raw || typeof raw !== 'object') return
  const origin = raw as NavigationOrigin
  if (
    origin.version !== 1 ||
    origin.session !== session ||
    !internalPath(origin.href) ||
    typeof origin.key !== 'string' ||
    !origin.key ||
    origin.key === current.key ||
    origin.href === current.href
  )
    return
  // A genuine BrowserRouter entry must immediately follow the source. New tabs/direct
  // entries have idx 0 and cannot use a copied source to leave the app. MemoryRouter
  // has no native idx and uses the same-session Link provenance instead.
  if (
    current.index !== undefined &&
    (!Number.isSafeInteger(origin.index) ||
      origin.index! < 0 ||
      current.index !== origin.index! + 1)
  )
    return
  return origin
}
