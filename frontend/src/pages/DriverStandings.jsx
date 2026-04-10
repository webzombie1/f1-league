import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

export default function DriverStandings() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/standings/drivers')
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
        <h1 className="text-2xl font-bold text-[#E8ECF4]">Driver Standings</h1>
        <Link to="/standings/constructors" className="text-sm text-[#7ED321] hover:underline">
          Constructors →
        </Link>
      </div>

      <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A3458] text-[#8892A8] text-xs uppercase tracking-wider">
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
              <tr key={d.id} className="border-b border-[#2A3458]/50 hover:bg-[#253052] transition-colors">
                <td className="py-3 px-4 font-medium text-[#8892A8]">{i + 1}</td>
                <td className="py-3 px-2">
                  <Link to={`/driver/${d.id}`} className="flex items-center gap-2 hover:text-[#7ED321]">
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: d.team_color || '#555' }}
                    />
                    <span className="font-medium text-[#E8ECF4]">{d.name}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-[#8892A8] hidden md:table-cell">{d.team_name}</td>
                <td className="py-3 px-2 text-center font-semibold text-[#7ED321]">{d.points}</td>
                <td className="py-3 px-2 text-center text-[#8892A8] hidden sm:table-cell">{d.wins}</td>
                <td className="py-3 px-2 text-center text-[#8892A8] hidden sm:table-cell">{d.podiums}</td>
                <td className="py-3 px-2 text-center text-[#8892A8] hidden sm:table-cell">{d.dnfs}</td>
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
