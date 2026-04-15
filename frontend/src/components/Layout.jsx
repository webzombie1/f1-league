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
      <header className="border-b border-[#2A3458] sticky top-0 z-50 relative overflow-hidden">
        {/* Diagonal stripe background */}
        <div className="absolute inset-0 bg-[#141A2E]" />
        <div className="absolute inset-0" style={{
          background: `repeating-linear-gradient(
            -70deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.03) 40px,
            rgba(255,255,255,0.03) 80px
          )`
        }} />
        <div className="absolute inset-0" style={{
          background: `repeating-linear-gradient(
            -70deg,
            transparent,
            transparent 120px,
            rgba(255,255,255,0.02) 120px,
            rgba(255,255,255,0.02) 200px
          )`
        }} />
        <div className="relative max-w-6xl mx-auto px-4 flex items-center justify-center h-14">
          {/* Left nav */}
          <nav className="flex items-center gap-1">
            {LEFT_NAV.map(link => <NavItem key={link.to} {...link} />)}
          </nav>

          {/* Center logo with trophy background */}
          <NavLink to="/" className="mx-8 flex items-center gap-2 relative">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl opacity-40 select-none pointer-events-none">🏆</span>
            <span className="relative text-xl font-black tracking-tight text-[#7ED321]">GDR</span>
            <span className="relative text-xl font-light tracking-tight text-[#E8ECF4]">LEAGUE</span>
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
