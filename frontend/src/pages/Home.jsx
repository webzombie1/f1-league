import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

export default function Home() {
  const [season, setSeason] = useState(null)
  const [races, setRaces] = useState([])
  const [topDrivers, setTopDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get('/seasons/active'),
      get('/races'),
      get('/standings/drivers'),
    ]).then(([s, r, d]) => {
      setSeason(s)
      setRaces(r)
      setTopDrivers(d.slice(0, 3))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#8892A8] text-sm">Loading...</p></div>
  }

  const nextRace = races.find(r => r.status === 'upcoming')
  const lastRace = [...races].reverse().find(r => r.status === 'completed')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#E8ECF4]">{season?.name || 'F1 League'}</h1>
        <p className="text-[#8892A8] mt-1">{season?.year} Season</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Race */}
        <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-6">
          <h2 className="text-xs text-[#8892A8] uppercase tracking-wider mb-3">Next Race</h2>
          {nextRace ? (
            <div>
              <p className="text-lg font-semibold text-[#E8ECF4]">
                Round {nextRace.round_number}: {nextRace.track_name}
              </p>
              <p className="text-sm text-[#8892A8] mt-1">
                {nextRace.country}{nextRace.date ? ` — ${nextRace.date}` : ''}
                {nextRace.time ? ` at ${nextRace.time}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-[#555F78] text-sm italic">No upcoming races scheduled.</p>
          )}
        </div>

        {/* Last Result */}
        <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-6">
          <h2 className="text-xs text-[#8892A8] uppercase tracking-wider mb-3">Latest Result</h2>
          {lastRace ? (
            <Link to={`/race/${lastRace.id}`} className="block hover:opacity-80 transition-opacity">
              <p className="text-lg font-semibold text-[#E8ECF4]">
                Round {lastRace.round_number}: {lastRace.track_name}
              </p>
              <p className="text-sm text-[#7ED321] mt-1">View results →</p>
            </Link>
          ) : (
            <p className="text-[#555F78] text-sm italic">No races completed yet.</p>
          )}
        </div>
      </div>

      {/* Top 3 Drivers */}
      {topDrivers.length > 0 && (
        <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-6">
          <h2 className="text-xs text-[#8892A8] uppercase tracking-wider mb-4">Championship Leader</h2>
          <div className="space-y-3">
            {topDrivers.map((d, i) => (
              <Link
                key={d.id}
                to={`/driver/${d.id}`}
                className="flex items-center gap-4 hover:bg-[#253052] -mx-2 px-2 py-1.5 rounded-lg transition-colors"
              >
                <span className="text-lg font-bold text-[#555F78] w-6">{i + 1}</span>
                <div
                  className="w-1 h-8 rounded-full"
                  style={{ backgroundColor: d.team_color || '#555' }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#E8ECF4]">{d.name}</p>
                  <p className="text-xs text-[#8892A8]">{d.team_name}</p>
                </div>
                <span className="text-sm font-semibold text-[#7ED321]">{d.points} pts</span>
              </Link>
            ))}
          </div>
          <Link to="/standings" className="block text-sm text-[#7ED321] mt-4 hover:underline">
            Full standings →
          </Link>
        </div>
      )}
    </div>
  )
}
