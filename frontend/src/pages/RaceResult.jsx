import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api'
import TyreChip from '../components/TyreChip'

function formatTime(ms) {
  if (!ms) return '-'
  const totalSec = ms / 1000
  const min = Math.floor(totalSec / 60)
  const sec = (totalSec % 60).toFixed(3)
  return `${min}:${sec.padStart(6, '0')}`
}

export default function RaceResult() {
  const { raceId } = useParams()
  const [race, setRace] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/races/${raceId}`)
      .then(setRace)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [raceId])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-stone-400 text-sm">Loading...</p></div>
  }

  if (!race || race.detail) {
    return <p className="text-center text-stone-400 py-8">Race not found.</p>
  }

  const results = race.results || []

  return (
    <div className="space-y-6">
      <div>
        <Link to="/schedule" className="text-sm text-[#B5764B] hover:underline">← Schedule</Link>
        <h1 className="text-2xl font-bold text-stone-800 mt-2">
          Round {race.round_number}: {race.track_name}
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          {race.country}{race.date ? ` — ${race.date}` : ''}
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-stone-400 text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4 w-12">Pos</th>
              <th className="text-left py-3 px-2">Driver</th>
              <th className="text-left py-3 px-2 hidden md:table-cell">Team</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Grid</th>
              <th className="text-center py-3 px-2">Gap</th>
              <th className="text-center py-3 px-2 hidden sm:table-cell">Best Lap</th>
              <th className="text-center py-3 px-2 hidden md:table-cell">Pits</th>
              <th className="text-left py-3 px-2 hidden lg:table-cell">Tyres</th>
              <th className="text-center py-3 px-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${
                  r.fastest_lap ? 'bg-purple-50/50' : ''
                }`}
              >
                <td className="py-3 px-4 font-medium text-stone-400">
                  {r.status === 'finished' ? r.position : r.status?.toUpperCase()}
                </td>
                <td className="py-3 px-2">
                  <Link
                    to={r.driver_id ? `/driver/${r.driver_id}` : '#'}
                    className="flex items-center gap-2 hover:text-[#B5764B]"
                  >
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: r.team_color || '#ccc' }}
                    />
                    <span className="font-medium">{r.driver_name || r.driver_name_raw}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-stone-500 hidden md:table-cell">{r.team_name || '-'}</td>
                <td className="py-3 px-2 text-center text-stone-500 hidden sm:table-cell">{r.grid_position || '-'}</td>
                <td className="py-3 px-2 text-center text-stone-500">
                  {r.position === 1 ? formatTime(r.best_lap_time_ms ? r.total_time_s * 1000 : null) || '-' : r.gap_to_leader || '-'}
                </td>
                <td className="py-3 px-2 text-center hidden sm:table-cell">
                  <span className={r.fastest_lap ? 'text-purple-600 font-medium' : 'text-stone-500'}>
                    {formatTime(r.best_lap_time_ms)}
                  </span>
                </td>
                <td className="py-3 px-2 text-center text-stone-500 hidden md:table-cell">{r.num_pit_stops}</td>
                <td className="py-3 px-2 hidden lg:table-cell">
                  <div className="flex gap-1">
                    {(r.tyre_stints || []).map((s, i) => (
                      <TyreChip key={i} compound={s.compound} laps={s.laps} />
                    ))}
                  </div>
                </td>
                <td className="py-3 px-2 text-center font-semibold">
                  {r.points_awarded || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <p className="text-center text-stone-400 text-sm py-8">No results yet.</p>
        )}
      </div>
    </div>
  )
}
