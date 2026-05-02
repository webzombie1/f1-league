import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api'
import StatBadge from '../components/StatBadge'

export default function DriverProfile() {
  const { driverId } = useParams()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/drivers/${driverId}`)
      .then(setDriver)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [driverId])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  if (!driver || driver.detail) {
    return <p className="text-center text-[#777777] py-8">Driver not found.</p>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <Link to="/standings" className="text-sm text-[#7ED321] hover:underline">← Standings</Link>
            <div className="flex items-center gap-3 mt-2">
              <div
                className="w-2 h-8 rounded-full"
                style={{ backgroundColor: driver.team_color || '#555' }}
              />
              <div>
                <h1 className="text-2xl font-bold text-[#E8ECF4]">{driver.name}</h1>
                <p className="text-sm text-[#999999]">
                  #{driver.number || '?'} — {driver.team_name || 'No team'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-8 items-start">
            <StatBadge label="Points" value={driver.total_points} />
            <StatBadge label="Wins" value={driver.wins} />
            <StatBadge label="Podiums" value={driver.podiums} />
            <StatBadge label="Best" value={driver.best_finish ? `P${driver.best_finish}` : '-'} />
            <StatBadge label="DNFs" value={driver.dnfs} />
          </div>
        </div>
        {driver.photo_standing && (
          <img
            src={driver.photo_standing}
            alt={driver.name}
            className="self-end -mb-6 h-80 object-contain object-bottom pointer-events-none"
          />
        )}
      </div>

      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4 w-12">Rnd</th>
              <th className="text-left py-3 px-2">Track</th>
              <th className="text-center py-3 px-2">Grid</th>
              <th className="text-center py-3 px-2">Pos</th>
              <th className="text-center py-3 px-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {(driver.results || []).map(r => (
              <tr key={r.id} className="border-b border-[#1F1F1F]/50 hover:bg-[#1F1F1F] transition-colors">
                <td className="py-3 px-4 text-[#999999]">{r.round_number}</td>
                <td className="py-3 px-2">
                  <Link to={`/race/${r.race_id}`} className="text-[#E8ECF4] hover:text-[#7ED321]">
                    {r.track_name}
                  </Link>
                </td>
                <td className="py-3 px-2 text-center text-[#999999]">{r.grid_position || '-'}</td>
                <td className="py-3 px-2 text-center">
                  {r.status === 'finished' ? (
                    <span className={r.position <= 3 ? 'font-semibold text-[#7ED321]' : 'text-[#E8ECF4]'}>
                      P{r.position}
                    </span>
                  ) : (
                    <span className="text-[#777777]">{r.status?.toUpperCase()}</span>
                  )}
                </td>
                <td className="py-3 px-2 text-center font-medium text-[#7ED321]">{r.points_awarded || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!driver.results || driver.results.length === 0) && (
          <p className="text-center text-[#777777] text-sm py-8">No race results yet.</p>
        )}
      </div>
    </div>
  )
}
