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
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  if (!race || race.detail) {
    return <p className="text-center text-[#777777] py-8">Race not found.</p>
  }

  const results = race.results || []

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link to="/schedule" className="text-sm text-[#7ED321] hover:underline">← Schedule</Link>
        <h1 className="text-2xl font-bold text-[#E8ECF4] mt-2">
          Round {race.round_number}: {race.track_name}
        </h1>
        <p className="text-[#999999] text-sm mt-1">
          {race.country}{race.date ? ` — ${race.date}` : ''}
        </p>
      </div>

      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
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
                className={`border-b border-[#1F1F1F]/50 hover:bg-[#1F1F1F] transition-colors ${
                  r.fastest_lap ? 'bg-purple-500/10' : ''
                }`}
              >
                <td className="py-3 px-4 font-medium text-[#999999]">
                  {r.status === 'finished' ? r.position : r.status?.toUpperCase()}
                </td>
                <td className="py-3 px-2">
                  <Link
                    to={r.driver_id ? `/driver/${r.driver_id}` : '#'}
                    className="flex items-center gap-2 hover:text-[#7ED321]"
                  >
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: r.team_color || '#555' }}
                    />
                    <span className="font-medium text-[#E8ECF4]">{r.driver_name || r.driver_name_raw}</span>
                  </Link>
                </td>
                <td className="py-3 px-2 text-[#999999] hidden md:table-cell">{r.team_name || '-'}</td>
                <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell">{r.grid_position || '-'}</td>
                <td className="py-3 px-2 text-center text-[#999999]">
                  {r.position === 1 ? '-' : r.gap_to_leader || '-'}
                </td>
                <td className="py-3 px-2 text-center hidden sm:table-cell">
                  <span className={r.fastest_lap ? 'text-purple-400 font-medium' : 'text-[#999999]'}>
                    {formatTime(r.best_lap_time_ms)}
                  </span>
                </td>
                <td className="py-3 px-2 text-center text-[#999999] hidden md:table-cell">{r.num_pit_stops}</td>
                <td className="py-3 px-2 hidden lg:table-cell">
                  <div className="flex gap-1">
                    {(r.tyre_stints || []).map((s, i) => (
                      <TyreChip key={i} compound={s.compound} laps={s.laps} />
                    ))}
                  </div>
                </td>
                <td className="py-3 px-2 text-center font-semibold text-[#7ED321]">
                  {r.points_awarded || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <p className="text-center text-[#777777] text-sm py-8">No results yet.</p>
        )}
      </div>
    </div>
  )
}
