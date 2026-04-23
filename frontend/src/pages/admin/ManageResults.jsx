import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'

export default function ManageResults() {
  const [races, setRaces] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedRace, setSelectedRace] = useState(null)
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)

  // Manual entry state
  const [manualMode, setManualMode] = useState(false)
  const [manualRows, setManualRows] = useState([])

  const inputCls = "bg-[#111111] border border-[#1F1F1F] rounded px-2 py-1 text-sm text-[#E8ECF4] focus:outline-none focus:border-[#7ED321]"
  const btnPrimary = "cursor-pointer bg-gradient-to-b from-[#7ED321] to-[#5BA318] border border-[#8EE835] text-[#0D1117] font-bold uppercase text-xs tracking-wider px-4 py-2 rounded transition-all"
  const btnDanger = "cursor-pointer bg-gradient-to-b from-red-500 to-red-700 border border-red-400 text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded transition-all"
  const btnSecondary = "cursor-pointer bg-gradient-to-b from-[#1F1F1F] to-[#191919] border border-[#383838] text-[#999999] font-bold uppercase text-xs tracking-wider px-4 py-2 rounded hover:text-[#E8ECF4] hover:border-[#777777] transition-all"

  useEffect(() => {
    get('/races').then(setRaces).catch(() => {})
    get('/drivers').then(setDrivers).catch(() => {})
  }, [])

  const loadResults = async (raceId) => {
    const race = await get(`/races/${raceId}`)
    setSelectedRace(race)
    setResults(race.results || [])
    setManualMode(false)
  }

  const updateResult = async (resultId, updates) => {
    await put(`/admin/results/${resultId}`, updates)
    if (selectedRace) loadResults(selectedRace.id)
  }

  const clearResults = async (raceId) => {
    if (!confirm('Clear all results for this race? This cannot be undone.')) return
    await del(`/admin/races/${raceId}/results`)
    setSelectedRace(null)
    setResults([])
    get('/races').then(setRaces).catch(() => {})
  }

  // Start manual entry — prefill with all drivers
  const startManualEntry = () => {
    setManualMode(true)
    setManualRows(drivers.map(d => ({
      driver_id: d.id,
      driver_name: d.name,
      team_name: d.team_name,
      position: '',
      grid_position: '',
      quali_time: '',
      best_lap_time: '',
      status: 'finished',
      fastest_lap: false,
      points_awarded: '',
    })))
  }

  const updateManualRow = (idx, field, value) => {
    setManualRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const submitManualResults = async () => {
    if (!selectedRace) return
    setSaving(true)

    // Parse time string "1:23.456" to milliseconds
    const parseTime = (t) => {
      if (!t) return null
      const parts = t.match(/^(\d+):(\d+)\.(\d+)$/)
      if (!parts) return null
      return (parseInt(parts[1]) * 60 + parseInt(parts[2])) * 1000 + parseInt(parts[3].padEnd(3, '0').slice(0, 3))
    }

    const resultsPayload = manualRows
      .filter(r => r.position || r.status !== 'finished')
      .map(r => ({
        driver_name: r.driver_name,
        position: r.status === 'finished' && r.position ? parseInt(r.position) : null,
        grid_position: r.grid_position ? parseInt(r.grid_position) : null,
        status: r.status,
        fastest_lap: r.fastest_lap,
        best_lap_time_ms: parseTime(r.best_lap_time),
        quali_time_ms: parseTime(r.quali_time),
        laps_completed: 0,
        num_pit_stops: 0,
        gap_to_leader: '',
      }))

    if (resultsPayload.length === 0) {
      alert('No results to submit. Enter at least one position.')
      setSaving(false)
      return
    }

    try {
      await post(`/admin/races/${selectedRace.id}/results`, { results: resultsPayload })
      await loadResults(selectedRace.id)
      setManualMode(false)
      // Refresh race list to update status
      get('/races').then(setRaces).catch(() => {})
    } catch (err) {
      alert('Failed to submit: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Loading overlay */}
      {saving && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D1117]/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[#1F1F1F] border-t-[#7ED321] rounded-full animate-spin" />
            <p className="text-sm text-[#999999]">Saving...</p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold">Manage Results</h1>

      {/* Race selector */}
      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-5">
        <label className="block text-xs text-[#999999] uppercase tracking-wider mb-2">Select Race</label>
        <select
          value={selectedRace?.id || ''}
          onChange={e => e.target.value && loadResults(parseInt(e.target.value))}
          className="w-full bg-[#111111] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] focus:outline-none focus:border-[#7ED321]"
        >
          <option value="">Choose a race...</option>
          {races.map(r => (
            <option key={r.id} value={r.id}>
              R{r.round_number}: {r.track_name} {r.status === 'completed' ? '✓' : '(upcoming)'}
            </option>
          ))}
        </select>
      </div>

      {/* Selected race — existing results or manual entry */}
      {selectedRace && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[#E8ECF4]">
              Round {selectedRace.round_number}: {selectedRace.track_name}
            </h2>
            <div className="flex gap-2">
              {!manualMode && (
                <button onClick={startManualEntry} className={btnSecondary}>
                  {results.length > 0 ? 'Re-enter Results' : 'Enter Results Manually'}
                </button>
              )}
              {results.length > 0 && !manualMode && (
                <button onClick={() => clearResults(selectedRace.id)} className={btnDanger}>Clear All</button>
              )}
            </div>
          </div>

          {/* Manual entry mode */}
          {manualMode && (
            <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-3">Driver</th>
                    <th className="text-center py-3 px-2 w-16">Qual</th>
                    <th className="text-center py-3 px-2 w-24">Quali Time</th>
                    <th className="text-center py-3 px-2 w-16">Pos</th>
                    <th className="text-center py-3 px-2 w-24">Best Lap</th>
                    <th className="text-center py-3 px-2 w-28">Status</th>
                    <th className="text-center py-3 px-2 w-12">FL</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((r, i) => (
                    <tr key={i} className="border-b border-[#1F1F1F]/50">
                      <td className="py-2 px-3">
                        <span className="font-medium text-[#E8ECF4]">{r.driver_name}</span>
                        <span className="text-[#777777] text-xs ml-2">{r.team_name}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1" max="22"
                          value={r.grid_position}
                          onChange={e => updateManualRow(i, 'grid_position', e.target.value)}
                          placeholder="-"
                          className={`${inputCls} w-14 text-center`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          value={r.quali_time}
                          onChange={e => updateManualRow(i, 'quali_time', e.target.value)}
                          placeholder="1:23.456"
                          className={`${inputCls} w-22 text-center font-mono text-xs`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1" max="22"
                          value={r.position}
                          onChange={e => updateManualRow(i, 'position', e.target.value)}
                          placeholder="-"
                          className={`${inputCls} w-14 text-center`}
                          disabled={r.status !== 'finished'}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          value={r.best_lap_time}
                          onChange={e => updateManualRow(i, 'best_lap_time', e.target.value)}
                          placeholder="1:23.456"
                          className={`${inputCls} w-22 text-center font-mono text-xs`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <select
                          value={r.status}
                          onChange={e => updateManualRow(i, 'status', e.target.value)}
                          className={`${inputCls} w-24`}
                        >
                          <option value="finished">Finished</option>
                          <option value="dnf">DNF</option>
                          <option value="dsq">DSQ</option>
                          <option value="dns">DNS</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={r.fastest_lap}
                          onChange={e => {
                            // Only one driver can have fastest lap
                            setManualRows(prev => prev.map((row, j) => ({
                              ...row,
                              fastest_lap: j === i ? e.target.checked : false,
                            })))
                          }}
                          className="accent-[#7ED321]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex gap-3">
                <button onClick={submitManualResults} className={btnPrimary}>Submit Results</button>
                <button onClick={() => setManualMode(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {/* Existing results — edit mode */}
          {!manualMode && results.length > 0 && (
            <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
                    <th className="text-center py-3 px-2 w-16">Pos</th>
                    <th className="text-left py-3 px-2">Driver</th>
                    <th className="text-center py-3 px-2 w-16">Grid</th>
                    <th className="text-center py-3 px-2 w-24">Quali Time</th>
                    <th className="text-center py-3 px-2 w-24">Best Lap</th>
                    <th className="text-center py-3 px-2 w-28">Status</th>
                    <th className="text-center py-3 px-2 w-16">Pts</th>
                    <th className="text-center py-3 px-2 w-12">FL</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id} className="border-b border-[#1F1F1F]/50">
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1" max="22"
                          value={r.position || ''}
                          onChange={e => updateResult(r.id, { position: parseInt(e.target.value) || null })}
                          className={`${inputCls} w-14 text-center`}
                        />
                      </td>
                      <td className="py-2 px-2 font-medium text-[#E8ECF4]">{r.driver_name || r.driver_name_raw}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1" max="22"
                          value={r.grid_position || ''}
                          onChange={e => updateResult(r.id, { grid_position: parseInt(e.target.value) || null })}
                          className={`${inputCls} w-14 text-center`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          defaultValue={r.quali_time_ms ? `${Math.floor(r.quali_time_ms/60000)}:${String(Math.floor((r.quali_time_ms%60000)/1000)).padStart(2,'0')}.${String(r.quali_time_ms%1000).padStart(3,'0')}` : ''}
                          placeholder="1:23.456"
                          onBlur={e => {
                            const t = e.target.value.match(/^(\d+):(\d+)\.(\d+)$/)
                            if (t) updateResult(r.id, { quali_time_ms: (parseInt(t[1])*60+parseInt(t[2]))*1000+parseInt(t[3].padEnd(3,'0').slice(0,3)) })
                          }}
                          className={`${inputCls} w-22 text-center font-mono text-xs`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          defaultValue={r.best_lap_time_ms ? `${Math.floor(r.best_lap_time_ms/60000)}:${String(Math.floor((r.best_lap_time_ms%60000)/1000)).padStart(2,'0')}.${String(r.best_lap_time_ms%1000).padStart(3,'0')}` : ''}
                          placeholder="1:23.456"
                          onBlur={e => {
                            const t = e.target.value.match(/^(\d+):(\d+)\.(\d+)$/)
                            if (t) updateResult(r.id, { best_lap_time_ms: (parseInt(t[1])*60+parseInt(t[2]))*1000+parseInt(t[3].padEnd(3,'0').slice(0,3)) })
                          }}
                          className={`${inputCls} w-22 text-center font-mono text-xs`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <select
                          value={r.status}
                          onChange={e => updateResult(r.id, { status: e.target.value })}
                          className={`${inputCls} w-24`}
                        >
                          <option value="finished">Finished</option>
                          <option value="dnf">DNF</option>
                          <option value="dsq">DSQ</option>
                          <option value="dns">DNS</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={r.points_awarded}
                          onChange={e => updateResult(r.id, { points_awarded: parseInt(e.target.value) || 0 })}
                          className={`${inputCls} w-14 text-center`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!r.fastest_lap}
                          onChange={e => updateResult(r.id, { fastest_lap: e.target.checked ? 1 : 0 })}
                          className="accent-[#7ED321]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* No results yet */}
          {!manualMode && results.length === 0 && (
            <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-8 text-center">
              <p className="text-[#777777] mb-4">No results for this race yet.</p>
              <button onClick={startManualEntry} className={btnPrimary}>Enter Results Manually</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
