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
    return <div className="flex justify-center py-20"><p className="text-stone-400 text-sm">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Driver Standings</h1>
        <Link to="/standings/constructors" className="text-sm text-[#B5764B] hover:underline">
          Constructors →
        </Link>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-stone-400 text-xs uppercase tracking-wider">
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
              <tr key={d.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                <td className="py-3 px-4 font-medium text-stone-400">{i + 1}</td>
                <td className="py-3 px-2">
                  <Link to={`/driver/${d.id}`} className="flex items-center gap-2 hover:text-[#B5764B]">
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: d.team_color || '#ccc' }}
                    />
                    <span className="font-medium">{d.name}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-stone-500 hidden md:table-cell">{d.team_name}</td>
                <td className="py-3 px-2 text-center font-semibold">{d.points}</td>
                <td className="py-3 px-2 text-center text-stone-500 hidden sm:table-cell">{d.wins}</td>
                <td className="py-3 px-2 text-center text-stone-500 hidden sm:table-cell">{d.podiums}</td>
                <td className="py-3 px-2 text-center text-stone-500 hidden sm:table-cell">{d.dnfs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {standings.length === 0 && (
          <p className="text-center text-stone-400 text-sm py-8">No standings data yet.</p>
        )}
      </div>
    </div>
  )
}
