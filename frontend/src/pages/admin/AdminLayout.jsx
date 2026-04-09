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
    return <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center"><p className="text-stone-400 text-sm">Loading...</p></div>
  }

  if (!authed) return null

  return (
    <div className="min-h-screen bg-[#F9F7F4] text-stone-800">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-semibold tracking-tight text-[#B5764B]">
            F1 League <span className="text-stone-400 text-sm font-normal">Admin</span>
          </NavLink>
          <nav className="flex gap-1 flex-wrap">
            {ADMIN_NAV.map(link => (
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
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
