import { Link, Outlet, useLocation, useMatch } from 'react-router'
import { BottomNavigation } from '../components/BottomNavigation'

export function AppLayout() {
  const pathname = useLocation().pathname
  const isHome = pathname === '/'
  const isDetail =
    Boolean(useMatch('/plants/:id')) && pathname !== '/plants/new'
  const isEdit = Boolean(useMatch('/plants/:id/edit'))
  const isCare = Boolean(useMatch('/plants/:id/care/*'))
  const isDiary = Boolean(useMatch('/plants/:id/diary/*'))
  const isForm = isEdit || pathname === '/plants/new' || isCare || isDiary
  const hasOwnHeader = isHome || isDetail || isForm || pathname === '/backup'
  return (
    <div className={`app-shell ${isForm ? 'form-shell' : ''}`}>
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      {!hasOwnHeader && (
        <header className="px-5 pt-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center font-semibold text-forest"
          >
            ← Leafory
          </Link>
          <Link to="/plants/new" className="ml-6 underline">
            식물 등록
          </Link>
        </header>
      )}
      <main id="main-content" className={hasOwnHeader ? '' : 'px-5 py-6'}>
        <Outlet />
      </main>
      {!isForm && <BottomNavigation />}
    </div>
  )
}
