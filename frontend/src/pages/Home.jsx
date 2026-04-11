import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

const DEFAULT_HERO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1600&h=600&fit=crop&q=80'

export default function Home() {
  const [season, setSeason] = useState(null)
  const [races, setRaces] = useState([])
  const [topDrivers, setTopDrivers] = useState([])
  const [lastRaceData, setLastRaceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  const scroll = (direction) => {
    if (!scrollRef.current) return
    const amount = 360 // ~2 tiles
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  useEffect(() => {
    Promise.all([
      get('/seasons/active'),
      get('/races'),
      get('/standings/drivers'),
    ]).then(async ([s, r, d]) => {
      setSeason(s)
      setRaces(r)
      setTopDrivers(d.slice(0, 5))

      // Fetch full results for the last completed race
      const lastCompleted = [...r].reverse().find(x => x.status === 'completed')
      if (lastCompleted) {
        try {
          const raceDetail = await get(`/races/${lastCompleted.id}`)
          setLastRaceData(raceDetail)
        } catch {}
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#8892A8] text-sm">Loading...</p></div>
  }

  const nextRace = races.find(r => r.status === 'upcoming')
  const lastRace = lastRaceData || [...races].reverse().find(r => r.status === 'completed')
  const heroImage = lastRace?.hero_image || nextRace?.hero_image || DEFAULT_HERO
  const heroRace = lastRace || nextRace
  const results = lastRaceData?.results || []

  return (
    <div>
      {/* ── Hero Section ── */}
      <div className="relative w-full h-[420px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/80 to-transparent" />

        <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col justify-end pb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7ED321] mb-3">
            {lastRace ? `Round ${lastRace.round_number} · ${lastRace.country}` : 'Up Next'}
          </p>
          {lastRace && lastRace.hero_headline ? (
            <>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight max-w-3xl">
                {lastRace.hero_headline}
              </h1>
              {lastRace.hero_subtitle && (
                <p className="text-lg text-[#8892A8] mt-3 max-w-2xl leading-relaxed">
                  {lastRace.hero_subtitle}
                </p>
              )}
              <Link
                to={`/race/${lastRace.id}`}
                className="inline-flex items-center mt-5 bg-[#7ED321] hover:bg-[#6BC11A] text-[#0D1117] font-bold uppercase text-sm tracking-wider px-6 py-3 rounded transition-colors w-fit"
              >
                Full Results
              </Link>
            </>
          ) : heroRace ? (
            <>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight">
                {heroRace.track_name}
              </h1>
              <p className="text-lg text-[#8892A8] mt-3">
                Round {heroRace.round_number} · {heroRace.country}
                {heroRace.date ? ` · ${heroRace.date}` : ''}
              </p>
              {lastRace && (
                <Link
                  to={`/race/${lastRace.id}`}
                  className="inline-flex items-center mt-5 bg-[#7ED321] hover:bg-[#6BC11A] text-[#0D1117] font-bold uppercase text-sm tracking-wider px-6 py-3 rounded transition-colors w-fit"
                >
                  View Results
                </Link>
              )}
            </>
          ) : (
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
              {season?.name || 'GDR League'}
            </h1>
          )}
        </div>
      </div>

      {/* ── Race Results Scroll Bar ── */}
      {results.length > 0 && (
        <div className="bg-[#111827] border-y border-[#2A3458]">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8892A8]">Race Results</h2>
              <span className="text-xs text-[#555F78]">—</span>
              <span className="text-xs text-[#555F78]">{lastRace?.track_name}</span>
            </div>
            <div className="relative flex items-center">
              {/* Left arrow */}
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#1E2642] border border-[#2A3458] text-[#8892A8] hover:text-[#E8ECF4] hover:bg-[#253052] transition-colors -ml-4 shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Scrollable area */}
              <div ref={scrollRef} className="overflow-x-auto scrollbar-hide mx-6" style={{ scrollbarWidth: 'none' }}>
                <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
                {results.map((r) => {
                  const pos = r.status === 'finished' ? r.position : null
                  const isTop3 = pos && pos <= 3
                  const isDNF = r.status !== 'finished'

                  return (
                    <div
                      key={r.id}
                      className="flex-shrink-0 w-[170px] rounded-lg bg-[#141A2E] border border-[#2A3458] overflow-hidden hover:bg-[#1E2642] transition-colors"
                    >
                      {/* Position overlapping the team color bar */}
                      <div className="relative">
                        {/* Team color diagonal bar — full width background */}
                        <div className="h-7 overflow-hidden">
                          <div
                            className="w-[120%] h-full origin-top-left -skew-x-12 -ml-2"
                            style={{ backgroundColor: r.team_color || '#555' }}
                          />
                        </div>
                        {/* Position text on top */}
                        <span className={`absolute top-0.5 left-2 text-sm font-black drop-shadow-md ${
                          isDNF ? 'text-white' : 'text-white'
                        }`}>
                          {isDNF ? r.status?.toUpperCase() : `P${pos}`}
                        </span>
                        {r.fastest_lap ? (
                          <span className="absolute top-1 right-2 text-[9px] font-bold text-purple-300 drop-shadow-md">FL</span>
                        ) : null}
                      </div>

                      {/* Content below */}
                      <div className="p-2 pt-1.5 flex items-center gap-2">
                        {/* Driver photo placeholder */}
                        <div className="w-12 h-12 rounded bg-[#2A3458] shrink-0 flex items-center justify-center">
                          <svg className="w-7 h-7 text-[#555F78]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>

                        {/* Name + points */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#E8ECF4] truncate">
                            {r.driver_name || r.driver_name_raw || 'Unknown'}
                          </p>
                          {r.points_awarded > 0 && (
                            <p className="text-xs font-bold text-[#7ED321] mt-0.5">
                              +{r.points_awarded} <span className="text-[10px] font-normal text-[#555F78]">pts</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>

              {/* Right arrow */}
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#1E2642] border border-[#2A3458] text-[#8892A8] hover:text-[#E8ECF4] hover:bg-[#253052] transition-colors -mr-4 shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content below ── */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Driver Standings */}
          <div className="lg:col-span-2 bg-[#141A2E] border border-[#2A3458] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A3458]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#E8ECF4]">Driver Standings</h2>
              <Link to="/standings" className="text-xs text-[#7ED321] hover:underline uppercase tracking-wider">View All →</Link>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {topDrivers.map((d, i) => (
                  <tr key={d.id} className="border-b border-[#2A3458]/50 hover:bg-[#1E2642] transition-colors">
                    <td className="py-3 px-5 w-10">
                      <span className={`text-lg font-black ${i === 0 ? 'text-[#7ED321]' : 'text-[#555F78]'}`}>{i + 1}</span>
                    </td>
                    <td className="py-3 px-2">
                      <Link to={`/driver/${d.id}`} className="flex items-center gap-3 hover:text-[#7ED321]">
                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: d.team_color || '#555' }} />
                        <div>
                          <p className="font-semibold text-[#E8ECF4]">{d.name}</p>
                          <p className="text-xs text-[#555F78]">{d.team_name}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-center text-xs text-[#8892A8]">{d.wins}W</td>
                    <td className="py-3 px-5 text-right">
                      <span className="font-bold text-[#7ED321]">{d.points}</span>
                      <span className="text-[#555F78] text-xs ml-1">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topDrivers.length === 0 && (
              <p className="text-center text-[#555F78] text-sm py-8">No standings yet.</p>
            )}
          </div>

          {/* Next Race card */}
          <div className="bg-[#141A2E] border border-[#2A3458] rounded-xl p-6 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#E8ECF4] mb-4">Next Race</h2>
            {nextRace ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-2xl font-black text-[#E8ECF4] uppercase">{nextRace.track_name}</p>
                  <p className="text-sm text-[#8892A8] mt-1">
                    Round {nextRace.round_number} · {nextRace.country}
                  </p>
                  {nextRace.date && (
                    <p className="text-sm text-[#8892A8] mt-1">
                      {nextRace.date}{nextRace.time ? ` at ${nextRace.time}` : ''}
                    </p>
                  )}
                </div>
                <Link
                  to="/schedule"
                  className="mt-6 text-xs text-[#7ED321] hover:underline uppercase tracking-wider"
                >
                  Full Schedule →
                </Link>
              </div>
            ) : (
              <p className="text-[#555F78] text-sm italic">Season complete.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
