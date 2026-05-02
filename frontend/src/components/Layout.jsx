import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const ALL_NAV = [
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/teams', label: 'Teams' },
  { to: '/admin', label: 'Admin' },
]

function NavItem({ to, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-colors border-b-2 ${
          isActive
            ? 'text-[#7ED321] border-[#7ED321]'
            : 'text-[#999999] border-transparent hover:text-[#E8ECF4]'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  // GDR pennant + tyre + trophy lockup — same on mobile and desktop.
  const gdrLogo = (
    <NavLink to="/" className="relative mx-4 inline-block" style={{ zIndex: 60 }}>
      <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-[150px] pointer-events-none" style={{ height: '72px' }}>
        <div className="w-full bg-[#2a2a2a]" style={{ height: '60px', padding: '0 4px' }}>
          <div className="w-full h-full bg-gradient-to-b from-[#1a1a1a] to-[#111111]" />
        </div>
        <div className="w-0 h-0 mx-auto" style={{
          borderLeft: '75px solid #2a2a2a',
          borderRight: '75px solid #2a2a2a',
          borderBottom: '14px solid transparent',
        }} />
        <div className="w-0 h-0 mx-auto absolute" style={{
          borderLeft: '71px solid #111111',
          borderRight: '71px solid #111111',
          borderBottom: '12px solid transparent',
          bottom: '0', left: '50%', transform: 'translateX(-50%)',
        }} />
      </div>
      <div className="relative flex items-center gap-2 h-14 justify-center overflow-hidden" style={{ width: '150px' }}>
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 select-none pointer-events-none opacity-70" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="95" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="2" />
          <circle cx="100" cy="100" r="95" fill="none" stroke="#222" strokeWidth="24" />
          {[...Array(20)].map((_, i) => {
            const angle = (i * 18) * Math.PI / 180
            const x1 = 100 + Math.cos(angle) * 82
            const y1 = 100 + Math.sin(angle) * 82
            const x2 = 100 + Math.cos(angle + 0.12) * 96
            const y2 = 100 + Math.sin(angle + 0.12) * 96
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111" strokeWidth="3" />
          })}
          <circle cx="100" cy="100" r="70" fill="#111" stroke="#2a2a2a" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="58" fill="#191919" stroke="#333" strokeWidth="2" />
          {[...Array(10)].map((_, i) => {
            const angle = (i * 36) * Math.PI / 180
            const x1 = 100 + Math.cos(angle) * 18
            const y1 = 100 + Math.sin(angle) * 18
            const x2 = 100 + Math.cos(angle) * 54
            const y2 = 100 + Math.sin(angle) * 54
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a2a2a" strokeWidth="5" strokeLinecap="round" />
          })}
          {[...Array(10)].map((_, i) => {
            const angle = ((i * 36) + 18) * Math.PI / 180
            const x = 100 + Math.cos(angle) * 38
            const y = 100 + Math.sin(angle) * 38
            return <circle key={i} cx={x} cy={y} r="7" fill="#111" />
          })}
          <circle cx="100" cy="100" r="16" fill="#1a1a1a" stroke="#333" strokeWidth="2" />
          <circle cx="100" cy="100" r="7" fill="#222" stroke="#333" strokeWidth="1" />
          <circle cx="100" cy="100" r="3" fill="#2a2a2a" />
        </svg>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60 select-none pointer-events-none" style={{ fontSize: '3.15rem' }}>🏆</span>
        <span className="relative bg-[#0a0a0a]/90 px-1 py-0 rounded-sm flex items-center gap-1">
          <span className="text-xl font-black tracking-tight text-[#7ED321]">GDR</span>
          <span className="text-xl font-light tracking-tight text-[#E8ECF4]">LEAGUE</span>
        </span>
      </div>
    </NavLink>
  )

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E8ECF4] relative">
      {/* Background track image */}
      <div className="fixed inset-0 z-0">
        <img src="/background-2.jpeg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#0D1117]/75" />
      </div>

      {/* Top nav bar */}
      <header className="border-b border-[#1a1a1a] sticky top-0 z-50 overflow-visible">
        {/* Diagonal stripe background */}
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        <div className="absolute inset-0" style={{
          background: `repeating-linear-gradient(
            -70deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.015) 40px,
            rgba(255,255,255,0.015) 80px
          )`
        }} />
        <div className="absolute inset-0" style={{
          background: `repeating-linear-gradient(
            -70deg,
            transparent,
            transparent 120px,
            rgba(255,255,255,0.01) 120px,
            rgba(255,255,255,0.01) 200px
          )`
        }} />

        <div className="relative max-w-6xl mx-auto px-4 flex items-center justify-center h-14">
          {/* F1 25 logo — right */}
          <div className="hidden md:flex flex-col items-center shrink-0 absolute right-4">
            <span className="text-[8px] text-white/50 uppercase tracking-wider leading-none mb-0.5">Powered by</span>
            <img src="/logo_f12025.png" alt="F1 25" className="h-5 object-contain" />
          </div>

          {/* Desktop nav — centered with logo in middle */}
          <div className="hidden md:flex items-center">
            <nav className="flex items-center gap-1">
              {ALL_NAV.slice(0, 2).map(link => <NavItem key={link.to} {...link} />)}
            </nav>

            {/* GDR League logo with pennant banner */}
            {gdrLogo}

            <nav className="flex items-center gap-1">
              {ALL_NAV.slice(2).map(link => <NavItem key={link.to} {...link} />)}
            </nav>
          </div>

          {/* Mobile — same logo treatment as desktop, centered + hamburger right */}
          <div className="md:hidden">
            {gdrLogo}
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden absolute right-4 text-[#999999] hover:text-[#E8ECF4] transition-colors z-10"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0a0a0a] border-b border-[#1a1a1a] shadow-xl shadow-black/50 z-50">
            <nav className="flex flex-col py-2">
              {ALL_NAV.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                      isActive ? 'text-[#7ED321] bg-[#111111]' : 'text-[#999999] hover:text-[#E8ECF4] hover:bg-[#111111]'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="relative z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1a1a1a] mt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-black text-[#7ED321]">GDR</span>
                <span className="text-lg font-light text-[#E8ECF4]">LEAGUE</span>
              </div>
              <p className="text-sm text-[#777777] leading-relaxed">
                An F1 25 esports racing league. Compete, climb the standings, and prove you're the fastest on the grid.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#999999] mb-3">Quick Links</h3>
              <div className="space-y-2">
                <NavLink to="/standings" className="block text-sm text-[#777777] hover:text-[#7ED321] transition-colors">Standings</NavLink>
                <NavLink to="/schedule" className="block text-sm text-[#777777] hover:text-[#7ED321] transition-colors">Schedule</NavLink>
                <NavLink to="/teams" className="block text-sm text-[#777777] hover:text-[#7ED321] transition-colors">Teams</NavLink>
              </div>
            </div>

            {/* Community */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#999999] mb-3">Community</h3>
              <div className="space-y-2">
                <a href="#" className="flex items-center gap-2 text-sm text-[#777777] hover:text-[#7ED321] transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
                  Discord
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-[#1a1a1a] mt-8 pt-6 flex items-center justify-between">
            <p className="text-xs text-[#777777]">© 2026 GDR League. Powered by F1 25.</p>
            <img src="/logo_f12025.png" alt="F1 25" className="h-4 object-contain opacity-40" />
          </div>
        </div>
      </footer>
    </div>
  )
}
