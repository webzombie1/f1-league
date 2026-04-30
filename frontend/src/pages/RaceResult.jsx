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
  const [view, setView] = useState('race')

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

  // Qualifying view: sort by grid position ascending; rows without one go last.
  const qualiRows = [...results].sort((a, b) => {
    const ag = a.grid_position == null ? Infinity : a.grid_position
    const bg = b.grid_position == null ? Infinity : b.grid_position
    return ag - bg
  })
  // Pole time, used for gap-to-pole on each row.
  const poleTime = qualiRows.find(r => r.quali_time_ms)?.quali_time_ms
  const formatGap = (ms) => {
    if (!ms || !poleTime || ms === poleTime) return '-'
    const diff = (ms - poleTime) / 1000
    return `+${diff.toFixed(3)}`
  }

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

      {/* Race / Qualifying tab switcher — same style as the home page standings tabs */}
      <div className="relative flex gap-1 pb-0 border-b-2 border-[#7ED321]">
        <button
          onClick={() => setView('race')}
          className={`px-5 py-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-t-lg ${
            view === 'race'
              ? 'bg-[#7ED321] text-[#0D1117] font-black'
              : 'bg-[#191919] text-[#7ED321] hover:bg-[#222222]'
          }`}
        >Race Results</button>
        <button
          onClick={() => setView('qualifying')}
          className={`px-5 py-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-t-lg ${
            view === 'qualifying'
              ? 'bg-[#7ED321] text-[#0D1117] font-black'
              : 'bg-[#191919] text-[#7ED321] hover:bg-[#222222]'
          }`}
        >Qualifying Results</button>
      </div>

      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-x-auto -mt-6">
        {view === 'race' ? (
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
                      {r.driver_photo ? (
                        <div
                          className="w-8 h-8 rounded shrink-0 overflow-hidden"
                          style={{ backgroundColor: r.team_color || '#1F1F1F' }}
                        >
                          <img src={r.driver_photo} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div
                          className="w-8 h-8 rounded shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: r.team_color || '#1F1F1F' }}
                        >
                          <svg className="w-5 h-5 text-[#777777]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>
                      )}
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
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4 w-12">Pos</th>
                <th className="text-left py-3 px-2">Driver</th>
                <th className="text-left py-3 px-2 hidden md:table-cell">Team</th>
                <th className="text-center py-3 px-2">Quali Time</th>
                <th className="text-center py-3 px-2 hidden sm:table-cell">Gap</th>
              </tr>
            </thead>
            <tbody>
              {qualiRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[#1F1F1F]/50 hover:bg-[#1F1F1F] transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-[#999999]">
                    {r.grid_position || '-'}
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
                      {r.driver_photo ? (
                        <div
                          className="w-8 h-8 rounded shrink-0 overflow-hidden"
                          style={{ backgroundColor: r.team_color || '#1F1F1F' }}
                        >
                          <img src={r.driver_photo} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div
                          className="w-8 h-8 rounded shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: r.team_color || '#1F1F1F' }}
                        >
                          <svg className="w-5 h-5 text-[#777777]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>
                      )}
                      <span className="font-medium text-[#E8ECF4]">{r.driver_name || r.driver_name_raw}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-[#999999] hidden md:table-cell">{r.team_name || '-'}</td>
                  <td className="py-3 px-2 text-center text-[#E8ECF4] font-mono">
                    {formatTime(r.quali_time_ms)}
                  </td>
                  <td className="py-3 px-2 text-center text-[#999999] hidden sm:table-cell font-mono">
                    {formatGap(r.quali_time_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {results.length === 0 && (
          <p className="text-center text-[#777777] text-sm py-8">No results yet.</p>
        )}
      </div>
    </div>
  )
}
