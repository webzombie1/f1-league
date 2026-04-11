import { NavLink, Outlet } from 'react-router-dom'

const LEFT_NAV = [
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
]

const RIGHT_NAV = [
  { to: '/teams', label: 'Teams' },
  { to: '/admin', label: 'Admin' },
]

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-colors border-b-2 ${
          isActive
            ? 'text-[#7ED321] border-[#7ED321]'
            : 'text-[#8892A8] border-transparent hover:text-[#E8ECF4]'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E8ECF4]">
      {/* Top nav bar */}
      <header className="bg-[#141A2E] border-b border-[#2A3458] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center h-14">
          {/* Left nav */}
          <nav className="flex items-center gap-1">
            {LEFT_NAV.map(link => <NavItem key={link.to} {...link} />)}
          </nav>

          {/* Center logo */}
          <NavLink to="/" className="mx-8 flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-[#7ED321]">GDR</span>
            <span className="text-xl font-light tracking-tight text-[#E8ECF4]">LEAGUE</span>
          </NavLink>

          {/* Right nav */}
          <nav className="flex items-center gap-1">
            {RIGHT_NAV.map(link => <NavItem key={link.to} {...link} />)}
          </nav>
        </div>
      </header>

      {/* Main content — no padding on top for hero pages */}
      <main>
        <Outlet />
      </main>
    </div>
  )
}
