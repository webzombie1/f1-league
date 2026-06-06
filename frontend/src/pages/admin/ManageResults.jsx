import { useState, useEffect, useRef } from 'react'
import { get, post, put, del } from '../../api'

// Tiny CSV parser. Handles quoted fields (with embedded commas + escaped
// quotes via "") and \r\n / \n line endings. We avoid pulling a library
// since the schema is fixed and this stays trivial to audit.
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { cell += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(cell); cell = '' }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else if (ch === '\r') { /* skip — handled via \n */ }
      else { cell += ch }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c && c.trim() !== ''))
}

const CSV_HEADERS = ['driver', 'position', 'grid', 'status', 'fastest_lap', 'best_lap_time', 'quali_time']
const CSV_TEMPLATE = `${CSV_HEADERS.join(',')}\nLewis Hamilton,1,3,finished,true,1:24.123,1:23.456\nMax Verstappen,2,1,finished,false,1:23.567,1:22.987\nGeorge Russell,,,dnf,false,,\n`

const parseTimeMs = (t) => {
  if (!t) return null
  const parts = String(t).trim().match(/^(\d+):(\d+)\.(\d+)$/)
  if (!parts) return null
  return (parseInt(parts[1]) * 60 + parseInt(parts[2])) * 1000 + parseInt(parts[3].padEnd(3, '0').slice(0, 3))
}

const parseBool = (v) => {
  const s = String(v || '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

// Inline driver picker for a results row. Lets admin reassign a row to
// any driver in the season — the long-term backup when the auto-upload
// matcher in admin.submit_results gets the wrong driver. Underneath the
// select we keep the raw uploaded name (driver_name_raw) when it
// disagrees with the selected driver, so the audit trail is visible.
function DriverCell({ row, drivers, updateResult, inputCls }) {
  const raw = (row.driver_name_raw || '').trim()
  const canonical = (row.driver_name || '').trim()
  const showRaw = raw && raw.toLowerCase() !== canonical.toLowerCase()
  const sorted = [...drivers].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="flex flex-col gap-0.5 min-w-[180px]">
      <select
        value={row.driver_id || ''}
        onChange={e => {
          const v = e.target.value
          updateResult(row.id, { driver_id: v ? parseInt(v) : null })
        }}
        className={`${inputCls} font-medium text-[#E8ECF4]`}
      >
        <option value="">— unassigned —</option>
        {sorted.map(d => (
          <option key={d.id} value={d.id}>
            {d.name}{d.team_name ? ` · ${d.team_name}` : ''}
          </option>
        ))}
      </select>
      {showRaw && (
        <span className="text-[10px] text-amber-500/80 italic pl-1">
          uploaded as: {raw}
        </span>
      )}
    </div>
  )
}

export default function ManageResults() {
  const [races, setRaces] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedRace, setSelectedRace] = useState(null)
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)

  // Which view of the results to show — race outcome or qualifying.
  const [view, setView] = useState('race')

  // Manual entry state
  const [manualMode, setManualMode] = useState(false)
  const [manualRows, setManualRows] = useState([])

  // CSV upload state — parsed preview rows + driver-match info, shown
  // before submission so the admin can spot unmatched names.
  const [csvPreview, setCsvPreview] = useState(null)  // { rows: [{...}, ...], errors: [string] }
  const fileInputRef = useRef(null)

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

  const deleteResult = async (resultId) => {
    if (!confirm('Remove this driver from the results? This cannot be undone.')) return
    await del(`/admin/results/${resultId}`)
    if (selectedRace) loadResults(selectedRace.id)
  }

  // Swap the ordering field with the adjacent row in the sorted list.
  // Race view orders by position; qualifying view orders by grid_position.
  const swapOrder = async (rowId, dir) => {
    const field = view === 'qualifying' ? 'grid_position' : 'position'
    const ordered = orderedRows()
    const target = ordered.findIndex(r => r.id === rowId)
    const otherIdx = dir === 'up' ? target - 1 : target + 1
    if (target < 0 || otherIdx < 0 || otherIdx >= ordered.length) return
    const a = ordered[target]
    const b = ordered[otherIdx]
    await put(`/admin/results/${a.id}`, { [field]: b[field] })
    await put(`/admin/results/${b.id}`, { [field]: a[field] })
    if (selectedRace) loadResults(selectedRace.id)
  }

  // The rows in current view's order. Race: by position (finished first).
  // Qualifying: by grid_position ascending, rows without one go to the end.
  const orderedRows = () => {
    if (view === 'qualifying') {
      return [...results].sort((a, b) => {
        const ag = a.grid_position == null ? Infinity : a.grid_position
        const bg = b.grid_position == null ? Infinity : b.grid_position
        return ag - bg
      })
    }
    return results
  }

  // Format a millisecond duration as m:ss.mmm.
  const fmtMs = (ms) => ms
    ? `${Math.floor(ms/60000)}:${String(Math.floor((ms%60000)/1000)).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`
    : ''
  const parseMs = (v) => {
    const t = v.match(/^(\d+):(\d+)\.(\d+)$/)
    return t ? (parseInt(t[1])*60 + parseInt(t[2]))*1000 + parseInt(t[3].padEnd(3,'0').slice(0,3)) : null
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

  // CSV import: read file, parse, normalise headers, match drivers by
  // case-insensitive name (with EA tag fallback), surface any errors so
  // the admin can fix the CSV before we POST anything.
  const handleCsvFile = async (file) => {
    if (!file) return
    let text
    try { text = await file.text() }
    catch { setCsvPreview({ rows: [], errors: [`Could not read ${file.name}`] }); return }
    const rows = parseCsv(text)
    if (rows.length < 2) {
      setCsvPreview({ rows: [], errors: ['CSV is empty or missing data rows.'] })
      return
    }
    const header = rows[0].map(h => h.trim().toLowerCase())
    const idx = Object.fromEntries(CSV_HEADERS.map(h => [h, header.indexOf(h)]))
    if (idx.driver < 0) {
      setCsvPreview({ rows: [], errors: ['Missing required column: driver. Download the template for the expected format.'] })
      return
    }
    const errors = []
    const driversByName = new Map(drivers.map(d => [d.name.trim().toLowerCase(), d]))
    const driversByTag = new Map(drivers.filter(d => d.ea_tag).map(d => [d.ea_tag.trim().toLowerCase(), d]))
    const parsed = rows.slice(1).map((r, lineIdx) => {
      const get = (key) => idx[key] >= 0 ? (r[idx[key]] || '').trim() : ''
      const rawName = get('driver')
      const match = driversByName.get(rawName.toLowerCase()) || driversByTag.get(rawName.toLowerCase()) || null
      if (!match && rawName) errors.push(`Row ${lineIdx + 2}: no driver matched "${rawName}".`)
      const status = (get('status') || 'finished').toLowerCase()
      if (!['finished', 'dnf', 'dsq', 'dns'].includes(status)) {
        errors.push(`Row ${lineIdx + 2}: invalid status "${get('status')}" (use finished/dnf/dsq/dns).`)
      }
      return {
        driver_id: match?.id,
        driver_name: match?.name || rawName,
        team_name: match?.team_name || '',
        matched: !!match,
        position: get('position'),
        grid_position: get('grid'),
        status,
        fastest_lap: parseBool(get('fastest_lap')),
        best_lap_time: get('best_lap_time'),
        quali_time: get('quali_time'),
      }
    })
    // Only one driver can be marked fastest_lap.
    let flSeen = false
    for (const p of parsed) {
      if (p.fastest_lap) {
        if (flSeen) { p.fastest_lap = false }
        else { flSeen = true }
      }
    }
    setCsvPreview({ rows: parsed, errors })
  }

  const submitCsvResults = async () => {
    if (!selectedRace || !csvPreview) return
    setSaving(true)
    try {
      const payload = csvPreview.rows
        .filter(r => r.matched && (r.position || r.status !== 'finished'))
        .map(r => ({
          driver_name: r.driver_name,
          position: r.status === 'finished' && r.position ? parseInt(r.position) : null,
          grid_position: r.grid_position ? parseInt(r.grid_position) : null,
          status: r.status,
          fastest_lap: r.fastest_lap,
          best_lap_time_ms: parseTimeMs(r.best_lap_time),
          quali_time_ms: parseTimeMs(r.quali_time),
          laps_completed: 0,
          num_pit_stops: 0,
          gap_to_leader: '',
        }))
      if (payload.length === 0) {
        alert('Nothing to submit — every row was either unmatched or empty.')
        setSaving(false)
        return
      }
      await post(`/admin/races/${selectedRace.id}/results`, { results: payload })
      await loadResults(selectedRace.id)
      setCsvPreview(null)
      get('/races').then(setRaces).catch(() => {})
    } catch (err) {
      alert('Failed to submit: ' + err.message)
    }
    setSaving(false)
  }

  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'race-results-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
            <div className="flex gap-2 flex-wrap">
              {!manualMode && !csvPreview && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className={btnSecondary}>
                    Upload CSV
                  </button>
                  <button onClick={downloadCsvTemplate} className={btnSecondary}>
                    Template
                  </button>
                  <button onClick={startManualEntry} className={btnSecondary}>
                    {results.length > 0 ? 'Re-enter Results' : 'Enter Results Manually'}
                  </button>
                </>
              )}
              {results.length > 0 && !manualMode && !csvPreview && (
                <button onClick={() => clearResults(selectedRace.id)} className={btnDanger}>Clear All</button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                handleCsvFile(f)
                e.target.value = ''  // allow re-uploading the same file
              }}
            />
          </div>

          {/* CSV preview — review parsed rows before submitting */}
          {csvPreview && (
            <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-x-auto">
              <div className="p-4 flex items-center justify-between border-b border-[#1F1F1F]">
                <p className="text-sm text-[#999999]">
                  Parsed {csvPreview.rows.length} {csvPreview.rows.length === 1 ? 'row' : 'rows'} ·{' '}
                  <span className={csvPreview.rows.filter(r => !r.matched).length ? 'text-red-400' : 'text-[#7ED321]'}>
                    {csvPreview.rows.filter(r => r.matched).length} matched
                  </span>
                  {csvPreview.rows.filter(r => !r.matched).length > 0 && (
                    <>, <span className="text-red-400">{csvPreview.rows.filter(r => !r.matched).length} unmatched</span></>
                  )}
                </p>
              </div>
              {csvPreview.errors.length > 0 && (
                <div className="p-4 bg-red-900/20 border-b border-red-900/40">
                  <p className="text-xs text-red-300 font-bold uppercase tracking-wider mb-2">Issues</p>
                  <ul className="text-xs text-red-200 space-y-0.5 list-disc list-inside">
                    {csvPreview.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-3">Driver</th>
                    <th className="text-center py-3 px-2 w-16">Grid</th>
                    <th className="text-center py-3 px-2 w-24">Quali</th>
                    <th className="text-center py-3 px-2 w-16">Pos</th>
                    <th className="text-center py-3 px-2 w-24">Best Lap</th>
                    <th className="text-center py-3 px-2 w-24">Status</th>
                    <th className="text-center py-3 px-2 w-12">FL</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.map((r, i) => (
                    <tr key={i} className={`border-b border-[#1F1F1F]/50 ${!r.matched ? 'bg-red-900/10' : ''}`}>
                      <td className="py-2 px-3">
                        <span className={`font-medium ${r.matched ? 'text-[#E8ECF4]' : 'text-red-300'}`}>
                          {r.driver_name}
                        </span>
                        {r.matched
                          ? <span className="text-[#777777] text-xs ml-2">{r.team_name}</span>
                          : <span className="text-red-400 text-xs ml-2">no match</span>
                        }
                      </td>
                      <td className="py-2 px-2 text-center text-[#E8ECF4]">{r.grid_position || '—'}</td>
                      <td className="py-2 px-2 text-center text-[#E8ECF4] font-mono text-xs">{r.quali_time || '—'}</td>
                      <td className="py-2 px-2 text-center text-[#E8ECF4]">{r.position || '—'}</td>
                      <td className="py-2 px-2 text-center text-[#E8ECF4] font-mono text-xs">{r.best_lap_time || '—'}</td>
                      <td className="py-2 px-2 text-center text-[#E8ECF4] uppercase text-xs">{r.status}</td>
                      <td className="py-2 px-2 text-center">{r.fastest_lap ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex gap-3">
                <button
                  onClick={submitCsvResults}
                  disabled={!csvPreview.rows.some(r => r.matched)}
                  className={`${btnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}
                >Submit Matched Rows</button>
                <button onClick={() => setCsvPreview(null)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

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
          {!manualMode && results.length > 0 && (() => {
            const rows = orderedRows()
            const reorderable = rows.filter(r =>
              view === 'qualifying' ? r.grid_position != null : (r.status === 'finished' && r.position != null)
            )
            const reorderIdxOf = (id) => reorderable.findIndex(x => x.id === id)
            return (
            <div className="space-y-0">
              {/* Tab switcher — same style as the home page standings tabs */}
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

              <div className="bg-[#191919] border border-t-0 border-[#1F1F1F] rounded-b-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    {view === 'race' ? (
                      <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
                        <th className="text-center py-3 px-1 w-10"></th>
                        <th className="text-center py-3 px-2 w-16">Pos</th>
                        <th className="text-left py-3 px-2">Driver</th>
                        <th className="text-center py-3 px-2 w-24">Best Lap</th>
                        <th className="text-center py-3 px-2 w-24">Total Time</th>
                        <th className="text-center py-3 px-2 w-28">Status</th>
                        <th className="text-center py-3 px-2 w-16">Pts</th>
                        <th className="text-center py-3 px-2 w-12">FL</th>
                        <th className="text-center py-3 px-1 w-10"></th>
                      </tr>
                    ) : (
                      <tr className="border-b border-[#1F1F1F] text-[#999999] text-xs uppercase tracking-wider">
                        <th className="text-center py-3 px-1 w-10"></th>
                        <th className="text-center py-3 px-2 w-16">Grid</th>
                        <th className="text-left py-3 px-2">Driver</th>
                        <th className="text-center py-3 px-2 w-24">Quali Time</th>
                        <th className="text-center py-3 px-1 w-10"></th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const idx = reorderIdxOf(r.id)
                      const canMoveUp = idx > 0
                      const canMoveDown = idx >= 0 && idx < reorderable.length - 1
                      const unmatched = !r.driver_id
                      return (
                        <tr
                          key={r.id}
                          className={`border-b border-[#1F1F1F]/50 ${
                            unmatched ? 'bg-amber-500/[0.06] border-l-2 border-l-amber-500' : ''
                          }`}
                        >
                          <td className="py-2 px-1 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => swapOrder(r.id, 'up')}
                                disabled={!canMoveUp}
                                className="text-[#777777] hover:text-[#E8ECF4] disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none cursor-pointer"
                                title="Move up"
                              >▲</button>
                              <button
                                onClick={() => swapOrder(r.id, 'down')}
                                disabled={!canMoveDown}
                                className="text-[#777777] hover:text-[#E8ECF4] disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none cursor-pointer"
                                title="Move down"
                              >▼</button>
                            </div>
                          </td>
                          {view === 'race' ? (
                            <>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="1" max="22"
                                  value={r.position || ''}
                                  onChange={e => updateResult(r.id, { position: parseInt(e.target.value) || null })}
                                  className={`${inputCls} w-14 text-center`}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <DriverCell row={r} drivers={drivers} updateResult={updateResult} inputCls={inputCls} />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  defaultValue={fmtMs(r.best_lap_time_ms)}
                                  placeholder="1:23.456"
                                  onBlur={e => {
                                    const ms = parseMs(e.target.value)
                                    if (ms != null) updateResult(r.id, { best_lap_time_ms: ms })
                                  }}
                                  className={`${inputCls} w-22 text-center font-mono text-xs`}
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  defaultValue={r.total_time_s != null ? (() => {
                                    const total = Math.round(r.total_time_s * 1000)
                                    const h = Math.floor(total / 3600000)
                                    const m = Math.floor((total % 3600000) / 60000)
                                    const s = Math.floor((total % 60000) / 1000)
                                    const ms = total % 1000
                                    return h > 0
                                      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
                                      : `${m}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
                                  })() : ''}
                                  placeholder="1:23:45.678"
                                  onBlur={e => {
                                    const v = e.target.value.trim()
                                    if (!v) {
                                      updateResult(r.id, { total_time_s: null })
                                      return
                                    }
                                    const t = v.match(/^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/)
                                    if (t) {
                                      const h = parseInt(t[1] || '0')
                                      const m = parseInt(t[2])
                                      const s = parseInt(t[3])
                                      const ms = t[4] ? parseInt(t[4].padEnd(3,'0').slice(0,3)) : 0
                                      updateResult(r.id, { total_time_s: h*3600 + m*60 + s + ms/1000 })
                                    }
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
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="1" max="22"
                                  value={r.grid_position || ''}
                                  onChange={e => updateResult(r.id, { grid_position: parseInt(e.target.value) || null })}
                                  className={`${inputCls} w-14 text-center`}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <DriverCell row={r} drivers={drivers} updateResult={updateResult} inputCls={inputCls} />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  defaultValue={fmtMs(r.quali_time_ms)}
                                  placeholder="1:23.456"
                                  onBlur={e => {
                                    const ms = parseMs(e.target.value)
                                    if (ms != null) updateResult(r.id, { quali_time_ms: ms })
                                  }}
                                  className={`${inputCls} w-22 text-center font-mono text-xs`}
                                />
                              </td>
                            </>
                          )}
                          <td className="py-2 px-1 text-center">
                            <button
                              onClick={() => deleteResult(r.id)}
                              className="text-[#777777] hover:text-red-400 cursor-pointer text-base leading-none"
                              title="Remove from results"
                            >×</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )
          })()}

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
