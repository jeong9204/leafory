import { CalendarDays, House, NotebookText } from 'lucide-react'
import { NavLink } from 'react-router'

export function BottomNavigation() {
  return (
    <nav aria-label="하단 탐색" className="bottom-navigation">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive ? 'bottom-nav-item active' : 'bottom-nav-item'
        }
      >
        <House aria-hidden="true" />
        <span>홈</span>
      </NavLink>
      <NavLink
        to="/records"
        aria-label="기록 목록"
        className={({ isActive }) =>
          isActive ? 'bottom-nav-item active' : 'bottom-nav-item'
        }
      >
        <NotebookText aria-hidden="true" />
        <span>기록</span>
      </NavLink>
      <NavLink
        to="/calendar"
        className={({ isActive }) =>
          isActive ? 'bottom-nav-item active' : 'bottom-nav-item'
        }
      >
        <CalendarDays aria-hidden="true" />
        <span>캘린더</span>
      </NavLink>
    </nav>
  )
}
