import { NavLink, Outlet } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/teams', label: 'Teams' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#141A2E] text-[#E8ECF4]">
      <header className="border-b border-[#2A3458] bg-[#1A2240]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold tracking-tight text-[#7ED321]">
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
                      ? 'bg-[#7ED321]/15 text-[#7ED321]'
                      : 'text-[#8892A8] hover:text-[#E8ECF4] hover:bg-[#1E2642]'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink
              to="/admin"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#555F78] hover:text-[#8892A8] hover:bg-[#1E2642] transition-colors"
            >
              Admin
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
