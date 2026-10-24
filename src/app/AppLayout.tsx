import { Leaf } from 'lucide-react'
import { Link, Outlet } from 'react-router'

export function AppLayout() {
  return (
    <div className="mx-auto max-w-lg px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-forest"
        >
          <Leaf size={22} aria-hidden="true" />
          Leafory
        </Link>
        <nav
          aria-label="기본 탐색"
          className="mt-4 flex flex-wrap gap-x-5 gap-y-2"
        >
          <Link to="/" className="inline-flex min-h-11 items-center underline">
            홈
          </Link>
          <Link
            to="/plants/new"
            className="inline-flex min-h-11 items-center underline"
          >
            식물 등록
          </Link>
          <Link
            to="/records"
            className="inline-flex min-h-11 items-center underline"
          >
            기록 목록
          </Link>
        </nav>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
