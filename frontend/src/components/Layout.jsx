import { NavLink, Outlet } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/teams', label: 'Teams' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#F9F7F4] text-stone-800">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-semibold tracking-tight text-[#B5764B]">
            F1 League
          </NavLink>
          <nav className="flex gap-1">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#B5764B]/15 text-[#B5764B]'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink
              to="/admin"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Admin
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
