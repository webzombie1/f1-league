import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

export default function ConstructorStandings() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/standings/constructors')
      .then(setStandings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#E8ECF4]">Constructor Standings</h1>
        <Link to="/standings" className="text-sm text-[#7ED321] hover:underline">
          ← Drivers
        </Link>
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
                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: t.color || '#555' }}>
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
