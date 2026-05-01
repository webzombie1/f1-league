import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import StandingsChart from '../components/StandingsChart'

export default function DriverStandings() {
  const [standings, setStandings] = useState([])
  const [timeline, setTimeline] = useState({ races: [], drivers: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get('/standings/drivers'),
      get('/standings/drivers/timeline').catch(() => ({ races: [], drivers: [] })),
    ])
      .then(([s, t]) => { setStandings(s); setTimeline(t || { races: [], drivers: [] }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#E8ECF4]">Standings</h1>

      {/* Drivers / Constructors tab switcher — same style as the home page */}
      <div className="relative flex gap-1 pb-0 border-b-2 border-[#7ED321]">
        <Link
          to="/standings"
          className="px-5 py-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-t-lg bg-[#7ED321] text-[#0D1117] font-black"
        >Drivers</Link>
        <Link
          to="/standings/constructors"
          className="px-5 py-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-t-lg bg-[#191919] text-[#7ED321] hover:bg-[#222222]"
        >Constructors</Link>
      </div>

      <div className="-mt-6">
        <StandingsChart races={timeline.races} items={timeline.drivers} mode="drivers" />
      </div>

      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4 w-12">Pos</th>
              <th className="text-left py-3 px-2">Driver</th>
              <th className="text-left py-3 px-2 hidden md:table-cell">Team</th>
              <th className="text-center py-3 px-2">Pts</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">W</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Pod</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">DNF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((d, i) => (
              <tr key={d.id} className="border-b border-[#1F1F1F]/50 hover:bg-[#1F1F1F] transition-colors">
                <td className="py-3 px-4 font-medium text-[#999999]">{i + 1}</td>
                <td className="py-3 px-2">
                  <Link to={`/driver/${d.id}`} className="flex items-center gap-2 hover:text-[#7ED321]">
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: d.team_color || '#555' }}
                    />
                    {d.photo_url ? (
                      <div
                        className="w-8 h-8 rounded shrink-0 overflow-hidden"
                        style={{ backgroundColor: d.team_color || '#1F1F1F' }}
                      >
                        <img src={d.photo_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: d.team_color || '#1F1F1F' }}
                      >
                        <svg className="w-5 h-5 text-[#777777]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      </div>
                    )}
                    <span className="font-medium text-[#E8ECF4]">{d.name}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-[#999999] hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: d.team_color ? `${d.team_color}80` : 'rgba(85,85,85,0.5)' }}
                    >
                      {d.team_logo ? (
                        <img src={d.team_logo} alt="" className="w-4 h-4 object-contain" />
                      ) : null}
                    </div>
                    <span>{d.team_name}</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center font-semibold text-[#7ED321]">{d.points}</td>
                <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell">{d.wins}</td>
                <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell">{d.podiums}</td>
                <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell">{d.dnfs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {standings.length === 0 && (
          <p className="text-center text-[#777777] text-sm py-8">No standings data yet.</p>
        )}
      </div>
    </div>
  )
}
