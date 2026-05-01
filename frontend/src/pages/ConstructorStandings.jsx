import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import StandingsChart from '../components/StandingsChart'

export default function ConstructorStandings() {
  const [standings, setStandings] = useState([])
  const [timeline, setTimeline] = useState({ races: [], teams: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get('/standings/constructors'),
      get('/standings/constructors/timeline').catch(() => ({ races: [], teams: [] })),
    ])
      .then(([s, t]) => { setStandings(s); setTimeline(t || { races: [], teams: [] }) })
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
          className="px-5 py-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-t-lg bg-[#191919] text-[#7ED321] hover:bg-[#222222]"
        >Drivers</Link>
        <Link
          to="/standings/constructors"
          className="px-5 py-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-t-lg bg-[#7ED321] text-[#0D1117] font-black"
        >Constructors</Link>
      </div>

      <div className="-mt-6">
        <StandingsChart races={timeline.races} items={timeline.teams} mode="constructors" />
      </div>

      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4 w-12">Pos</th>
              <th className="text-left py-3 px-2">Constructor</th>
              <th className="text-center py-3 px-2">Pts</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Wins</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Podiums</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => (
              <tr key={t.id} className="border-b border-[#1F1F1F]/50 hover:bg-[#1F1F1F] transition-colors">
                <td className="py-3 px-4 font-medium text-[#999999]">{i + 1}</td>
                <td className="py-3 px-2">
                  <Link to={`/teams/${t.id}`} className="flex items-center gap-3 hover:text-[#7ED321]">
                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: t.color ? `${t.color}80` : 'rgba(85,85,85,0.5)' }}>
                      {t.logo_url ? (
                        <img src={t.logo_url} alt="" className="w-5 h-5 object-contain" />
                      ) : null}
                    </div>
                    <span className="font-medium text-[#E8ECF4]">{t.name}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-center font-semibold text-[#7ED321]">{t.points}</td>
                <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell">{t.wins}</td>
                <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell">{t.podiums}</td>
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
