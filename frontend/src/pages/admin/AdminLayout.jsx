import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { get } from '../../api'

const ADMIN_NAV = [
  { to: '/admin/seasons', label: 'Seasons' },
  { to: '/admin/teams', label: 'Teams' },
  { to: '/admin/drivers', label: 'Drivers' },
  { to: '/admin/schedule', label: 'Schedule' },
  { to: '/admin/results', label: 'Results' },
  { to: '/admin/points', label: 'Points' },
]

export default function AdminLayout() {
  const [authed, setAuthed] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    get('/auth/check')
      .then(() => setAuthed(true))
      .catch(() => {
        setAuthed(false)
        navigate('/admin')
      })
  }, [navigate])

  if (authed === null) {
    return <div className="min-h-screen bg-[#141A2E] flex items-center justify-center"><p className="text-[#8892A8] text-sm">Loading...</p></div>
  }

  if (!authed) return null

  return (
    <div className="min-h-screen bg-[#141A2E] text-[#E8ECF4]">
      <header className="border-b border-[#2A3458] bg-[#1A2240]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold tracking-tight text-[#7ED321]">
            F1 League <span className="text-[#555F78] text-sm font-normal">Admin</span>
          </NavLink>
          <nav className="flex gap-1 flex-wrap">
            {ADMIN_NAV.map(link => (
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
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
