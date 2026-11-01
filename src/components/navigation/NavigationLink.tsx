import { Link } from 'react-router'
import type { LinkProps } from 'react-router'
import {
  useBackNavigation,
  useNavigationOrigin,
} from '../../hooks/useBackNavigation'

/** Keep the same href/push behavior, adding only validated return provenance. */
export function NavigationLink({ state, ...props }: LinkProps) {
  const origin = useNavigationOrigin()
  return (
    <Link
      {...props}
      state={{
        ...(state && typeof state === 'object' ? state : {}),
        leaforyNavigation: origin,
      }}
    />
  )
}
function destinationLabel(href: string, fallback: string) {
  const path = href.split(/[?#]/)[0]
  if (path === '/records') return '나의 기록으로 돌아가기'
  if (path === '/backup') return '데이터 백업으로 돌아가기'
  if (path === '/install') return '설치 안내로 돌아가기'
  if (path === '/') return '내 정원으로 돌아가기'
  if (path === '/calendar') return '캘린더로 돌아가기'
  if (/\/diary\/[^/]+$/.test(path)) return '일기 상세로 돌아가기'
  if (/^\/plants\/[^/]+$/.test(path)) return '식물 상세로 돌아가기'
  return fallback
}
/** Plain clicks pop only a proven internal predecessor; other clicks retain safe hrefs. */
export function BackLink({
  fallback,
  'aria-label': label = '이전 화면으로 돌아가기',
  onClick,
  ...props
}: Omit<LinkProps, 'to' | 'replace' | 'state'> & { fallback: string }) {
  const navigation = useBackNavigation(fallback)
  return (
    <Link
      {...props}
      to={navigation.href}
      replace
      aria-label={
        navigation.hasOrigin && navigation.href !== fallback
          ? destinationLabel(navigation.href, label)
          : label
      }
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== '_self')
        )
          return
        event.preventDefault()
        void navigation.back()
      }}
    />
  )
}
