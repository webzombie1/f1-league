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
    return <div className="flex justify-center py-20"><p className="text-[#8892A8] text-sm">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#E8ECF4]">Constructor Standings</h1>
        <Link to="/standings" className="text-sm text-[#7ED321] hover:underline">
          ← Drivers
        </Link>
      </div>

      <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A3458] text-[#8892A8] text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4 w-12">Pos</th>
              <th className="text-left py-3 px-2">Constructor</th>
              <th className="text-center py-3 px-2">Pts</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Wins</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Podiums</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => (
              <tr key={t.id} className="border-b border-[#2A3458]/50 hover:bg-[#253052] transition-colors">
                <td className="py-3 px-4 font-medium text-[#8892A8]">{i + 1}</td>
                <td className="py-3 px-2">
                  <Link to={`/teams/${t.id}`} className="flex items-center gap-2 hover:text-[#7ED321]">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: t.color || '#555' }}
                    />
                    <span className="font-medium text-[#E8ECF4]">{t.name}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-center font-semibold text-[#7ED321]">{t.points}</td>
                <td className="py-3 px-2 text-center text-[#8892A8] hidden sm:table-cell">{t.wins}</td>
                <td className="py-3 px-2 text-center text-[#8892A8] hidden sm:table-cell">{t.podiums}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {standings.length === 0 && (
          <p className="text-center text-[#555F78] text-sm py-8">No standings data yet.</p>
        )}
      </div>
    </div>
  )
}
