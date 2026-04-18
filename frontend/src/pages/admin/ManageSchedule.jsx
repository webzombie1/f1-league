import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'

const F125_TRACKS = [
  { name: 'Albert Park Circuit', gp: 'Australian Grand Prix', city: 'Melbourne', country: 'Australia', image: 'australia' },
  { name: 'Shanghai International Circuit', gp: 'Chinese Grand Prix', city: 'Shanghai', country: 'China', image: 'china' },
  { name: 'Suzuka International Racing Course', gp: 'Japanese Grand Prix', city: 'Suzuka', country: 'Japan', image: 'japan' },
  { name: 'Miami International Autodrome', gp: 'Miami Grand Prix', city: 'Miami', country: 'United States', image: 'miami' },
  { name: 'Circuit Gilles Villeneuve', gp: 'Canadian Grand Prix', city: 'Montreal', country: 'Canada', image: 'canada' },
  { name: 'Circuit de Monaco', gp: 'Monaco Grand Prix', city: 'Monte Carlo', country: 'Monaco', image: 'monaco' },
  { name: 'Circuit de Barcelona-Catalunya', gp: 'Spanish Grand Prix', city: 'Barcelona', country: 'Spain', image: 'spain' },
  { name: 'Red Bull Ring', gp: 'Austrian Grand Prix', city: 'Spielberg', country: 'Austria', image: 'austria' },
  { name: 'Silverstone Circuit', gp: 'British Grand Prix', city: 'Silverstone', country: 'Great Britain', image: 'great-britain' },
  { name: 'Circuit de Spa-Francorchamps', gp: 'Belgian Grand Prix', city: 'Spa', country: 'Belgium', image: 'belgium' },
  { name: 'Hungaroring', gp: 'Hungarian Grand Prix', city: 'Budapest', country: 'Hungary', image: 'hungary' },
  { name: 'Circuit Zandvoort', gp: 'Dutch Grand Prix', city: 'Zandvoort', country: 'Netherlands', image: 'netherlands' },
  { name: 'Autodromo Nazionale Monza', gp: 'Italian Grand Prix', city: 'Monza', country: 'Italy', image: 'italy' },
  { name: 'Baku City Circuit', gp: 'Azerbaijan Grand Prix', city: 'Baku', country: 'Azerbaijan', image: 'azerbaijan' },
  { name: 'Marina Bay Street Circuit', gp: 'Singapore Grand Prix', city: 'Singapore', country: 'Singapore', image: 'singapore' },
  { name: 'Circuit of the Americas', gp: 'United States Grand Prix', city: 'Austin', country: 'United States', image: 'united-states' },
  { name: 'Autodromo Hermanos Rodriguez', gp: 'Mexico City Grand Prix', city: 'Mexico City', country: 'Mexico', image: 'mexico' },
  { name: 'Interlagos', gp: 'Brazilian Grand Prix', city: 'São Paulo', country: 'Brazil', image: 'brazil' },
  { name: 'Las Vegas Strip Circuit', gp: 'Las Vegas Grand Prix', city: 'Las Vegas', country: 'United States', image: 'las-vegas' },
  { name: 'Lusail International Circuit', gp: 'Qatar Grand Prix', city: 'Lusail', country: 'Qatar', image: 'qatar' },
  { name: 'Yas Marina Circuit', gp: 'Abu Dhabi Grand Prix', city: 'Abu Dhabi', country: 'Abu Dhabi', image: 'abu-dhabi' },
  { name: 'Bahrain International Circuit', gp: 'Bahrain Grand Prix', city: 'Sakhir', country: 'Bahrain', image: 'bahrain' },
  { name: 'Jeddah Corniche Circuit', gp: 'Saudi Arabian Grand Prix', city: 'Jeddah', country: 'Saudi Arabia', image: 'saudi-arabia' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getNextDayOfWeek(fromDate, dayIndex) {
  const d = new Date(fromDate)
  const diff = (dayIndex - d.getDay() + 7) % 7
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff))
  return d
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

export default function ManageSchedule() {
  const [races, setRaces] = useState([])
  const [seasonId, setSeasonId] = useState(null)

  // Season schedule settings
  const [seasonStart, setSeasonStart] = useState('')
  const [raceDay, setRaceDay] = useState(3) // Wednesday
  const [raceTime, setRaceTime] = useState('20:00')

  // Drag state
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // Loading overlay
  const [saving, setSaving] = useState(false)

  // Date edit state
  const [editingDateId, setEditingDateId] = useState(null)
  const [editingDateValue, setEditingDateValue] = useState('')

  const setRaceDate = async (raceId, newDate) => {
    setSaving(true)
    try {
      await put(`/admin/races/${raceId}`, { date: newDate })
      setEditingDateId(null)
      if (seasonId) setRaces(await get(`/races?season_id=${seasonId}`))
    } finally { setSaving(false) }
  }

  // Add race form
  const [track, setTrack] = useState('')
  const [trackSearch, setTrackSearch] = useState('')
  const [trackOpen, setTrackOpen] = useState(false)
  const [trackHighlight, setTrackHighlight] = useState(-1)
  const [country, setCountry] = useState('')

  const filteredTracks = F125_TRACKS.filter(t => {
    const q = trackSearch.toLowerCase()
    return t.name.toLowerCase().includes(q) ||
      t.country.toLowerCase().includes(q) ||
      t.gp.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q)
  })

  const handleTrackSelect = (t) => {
    setTrack(t.name)
    setCountry(t.country)
    setTrackSearch(t.name)
    setTrackOpen(false)
  }

  // Off weeks
  const [offWeeks, setOffWeeks] = useState([])
  const [offWeekOpen, setOffWeekOpen] = useState(false)
  const [offWeekDate, setOffWeekDate] = useState('')
  const [offWeekReason, setOffWeekReason] = useState('')

  const offWeekDates = new Set(offWeeks.map(o => o.date))

  // Get next valid race date, skipping off weeks
  const getNextValidDate = (afterDate) => {
    let d = new Date(afterDate)
    d.setDate(d.getDate() + 7) // next week
    while (offWeekDates.has(formatDate(d))) {
      d.setDate(d.getDate() + 7) // skip off weeks
    }
    return d
  }

  // Calculate next race date based on settings
  const getNextRaceDate = () => {
    if (!seasonStart) return ''
    if (races.length === 0) {
      const start = new Date(seasonStart + 'T00:00:00')
      let first = new Date(start)
      if (first.getDay() !== raceDay) {
        const diff = (raceDay - first.getDay() + 7) % 7
        first.setDate(first.getDate() + diff)
      }
      // Skip if it's an off week
      while (offWeekDates.has(formatDate(first))) {
        first.setDate(first.getDate() + 7)
      }
      return formatDate(first)
    }
    const dates = races.filter(r => r.date).map(r => new Date(r.date + 'T00:00:00'))
    if (dates.length === 0) return ''
    const latest = new Date(Math.max(...dates))
    return formatDate(getNextValidDate(latest))
  }

  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) {
        setSeasonId(s.id)
        if (s.season_start) setSeasonStart(s.season_start)
        if (s.race_day !== undefined) setRaceDay(s.race_day)
        if (s.race_time) setRaceTime(s.race_time)
        get(`/races?season_id=${s.id}`).then(setRaces)
        fetch(`/api/off-weeks?season_id=${s.id}`, { credentials: 'include' })
          .then(r => r.json())
          .then(d => setOffWeeks(Array.isArray(d) ? d : []))
          .catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const loadOffWeeks = () => {
    if (seasonId) get(`/admin/off-weeks?season_id=${seasonId}`).then(setOffWeeks).catch(() => {})
  }

  const addOffWeek = async () => {
    if (!offWeekDate || !seasonId) return
    await post('/admin/off-weeks', { season_id: seasonId, date: offWeekDate, reason: offWeekReason })
    setOffWeekDate('')
    setOffWeekReason('')
    setOffWeekOpen(false)

    // Reload off weeks
    const res = await fetch(`/api/off-weeks?season_id=${seasonId}`, { credentials: 'include' })
    const updatedOffWeeks = await res.json()
    setOffWeeks(updatedOffWeeks)

    // Recalculate all race dates respecting the new off week
    if (seasonStart && races.length > 0) {
      const offDates = new Set(updatedOffWeeks.map(o => o.date))
      const newDates = []
      const start = new Date(seasonStart + 'T00:00:00')
      let d = new Date(start)
      if (d.getDay() !== raceDay) {
        const diff = (raceDay - d.getDay() + 7) % 7
        d.setDate(d.getDate() + diff)
      }
      // Skip off weeks for first slot
      while (offDates.has(formatDate(d))) d.setDate(d.getDate() + 7)

      for (let i = 0; i < races.length; i++) {
        newDates.push(formatDate(d))
        d.setDate(d.getDate() + 7)
        while (offDates.has(formatDate(d))) d.setDate(d.getDate() + 7)
      }

      // Update any races whose dates changed
      const sorted = [...races].sort((a, b) => a.round_number - b.round_number)
      const bulkUpdates = sorted.map((r, i) => ({ id: r.id, date: newDates[i] })).filter((u, i) => sorted[i].date !== u.date)
      if (bulkUpdates.length) await put('/admin/races/bulk-update', { updates: bulkUpdates })
      load()
    }
  }

  const removeOffWeek = async (id) => {
    await del(`/admin/off-weeks/${id}`)

    // Reload off weeks
    const res = await fetch(`/api/off-weeks?season_id=${seasonId}`, { credentials: 'include' })
    const updatedOffWeeks = await res.json()
    setOffWeeks(updatedOffWeeks)

    // Recalculate all race dates — races may move earlier now
    if (seasonStart && races.length > 0) {
      const offDates = new Set(updatedOffWeeks.map(o => o.date))
      const newDates = []
      const start = new Date(seasonStart + 'T00:00:00')
      let d = new Date(start)
      if (d.getDay() !== raceDay) {
        const diff = (raceDay - d.getDay() + 7) % 7
        d.setDate(d.getDate() + diff)
      }
      while (offDates.has(formatDate(d))) d.setDate(d.getDate() + 7)

      for (let i = 0; i < races.length; i++) {
        newDates.push(formatDate(d))
        d.setDate(d.getDate() + 7)
        while (offDates.has(formatDate(d))) d.setDate(d.getDate() + 7)
      }

      const sorted = [...races].sort((a, b) => a.round_number - b.round_number)
      const bulkUpdates = sorted.map((r, i) => ({ id: r.id, date: newDates[i] })).filter((u, i) => sorted[i].date !== u.date)
      if (bulkUpdates.length) await put('/admin/races/bulk-update', { updates: bulkUpdates })
      load()
    }
  }

  const saveSettings = async () => {
    if (!seasonId) return
    await put(`/admin/seasons/${seasonId}`, { season_start: seasonStart, race_day: raceDay, race_time: raceTime })
    setSettingsOpen(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const load = async () => { if (seasonId) { const r = await get(`/races?season_id=${seasonId}`); setRaces(r) } }

  // Calculate date for a given round index (0-based), skipping off weeks
  const dateForRound = (roundIndex) => {
    if (!seasonStart) return ''
    const start = new Date(seasonStart + 'T00:00:00')
    let d = new Date(start)
    if (d.getDay() !== raceDay) {
      const diff = (raceDay - d.getDay() + 7) % 7
      d.setDate(d.getDate() + diff)
    }
    // Skip off weeks for the first slot
    while (offWeekDates.has(formatDate(d))) {
      d.setDate(d.getDate() + 7)
    }
    // Advance through rounds, skipping off weeks
    for (let i = 0; i < roundIndex; i++) {
      d.setDate(d.getDate() + 7)
      while (offWeekDates.has(formatDate(d))) {
        d.setDate(d.getDate() + 7)
      }
    }
    return formatDate(d)
  }

  const handleDrop = async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    setSaving(true)
    try {
    const reordered = [...races]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    // Update round numbers and dates for all races
    const updates = reordered.map((r, i) => ({
      id: r.id,
      round_number: i + 1,
      date: dateForRound(i),
    }))

    // Optimistic update
    setRaces(updates.map((u, i) => ({ ...reordered[i], round_number: u.round_number, date: u.date })))

    await put('/admin/races/bulk-update', { updates: updates.map(u => ({ ...u, time: raceTime })) })
    if (seasonId) setRaces(await get(`/races?season_id=${seasonId}`))
    } finally { setSaving(false) }
  }

  const create = async (e) => {
    e.preventDefault()
    if (!track.trim() || !seasonId) return
    const nextRound = races.length > 0 ? Math.max(...races.map(r => r.round_number)) + 1 : 1
    const nextDate = getNextRaceDate()
    const selectedTrack = F125_TRACKS.find(t => t.name === track)
    const trackImage = selectedTrack
      ? `https://media.formula1.com/image/upload/c_lfill,w_720/q_auto/v1740000001/fom-website/static-assets/2026/races/card/${selectedTrack.image}.webp`
      : ''
    try {
      setSaving(true)
      setTrack(''); setTrackSearch(''); setCountry('')
      const result = await post('/admin/races', { season_id: seasonId, round_number: nextRound, track_name: track, country, date: nextDate || '', time: raceTime || '', track_image: trackImage })
      if (result.error) alert(result.error)
      if (seasonId) setRaces(await get(`/races?season_id=${seasonId}`))
      setSaving(false)
    } catch (err) {
      alert('Failed to add race: ' + err.message)
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this race?')) return
    setSaving(true)
    try {
      setRaces(prev => prev.filter(r => r.id !== id))
      await del(`/admin/races/${id}`)
      if (seasonId) setRaces(await get(`/races?season_id=${seasonId}`))
    } finally { setSaving(false) }
  }

  const markCompleted = async (id) => {
    await put(`/admin/races/${id}`, { status: 'completed' })
    load()
  }

  const inputCls = "w-full bg-[#141A2E] border border-[#2A3458] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#555F78] focus:outline-none focus:border-[#7ED321]"
  const btnBase = "cursor-pointer font-bold uppercase text-xs tracking-wider px-4 py-2 rounded transition-all inline-flex items-center justify-center h-8"
  const btnPrimary = `${btnBase} bg-gradient-to-b from-[#7ED321] to-[#5BA318] border border-[#8EE835] text-[#0D1117] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-[#8EE835] hover:to-[#6BC11A] disabled:from-[#2A3458] disabled:to-[#1E2642] disabled:border-[#2A3458] disabled:text-[#555F78] disabled:shadow-none disabled:cursor-not-allowed`
  const btnDanger = `${btnBase} bg-gradient-to-b from-red-500 to-red-700 border border-red-400 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-red-400 hover:to-red-600`
  const btnSecondary = `${btnBase} bg-gradient-to-b from-[#2A3458] to-[#1E2642] border border-[#3A4468] text-[#8892A8] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:text-[#E8ECF4] hover:border-[#555F78]`

  const formatRaceDate = (dateStr) => {
    if (!dateStr) return 'No date'
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  }

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay */}
      {saving && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D1117]/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[#2A3458] border-t-[#7ED321] rounded-full animate-spin" />
            <p className="text-sm text-[#8892A8]">Saving...</p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold">Manage Schedule</h1>

      {/* Season Schedule Settings — summary bar */}
      <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between">
          {seasonStart ? (
            <p className="text-sm text-[#8892A8]">
              Races on <span className="text-[#E8ECF4] font-medium">{DAYS[raceDay]}s</span> at <span className="text-[#E8ECF4] font-medium">{raceTime}</span>, starting <span className="text-[#E8ECF4] font-medium">{seasonStart}</span>
              {settingsSaved && <span className="text-[#7ED321] ml-2">Saved!</span>}
            </p>
          ) : (
            <p className="text-sm text-[#555F78]">No schedule settings configured yet.</p>
          )}
          <div className="flex gap-3 items-center shrink-0">
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Push this week's race and all following races back one week?")) return
                const today = new Date()
                const nextWeek = new Date(today)
                nextWeek.setDate(today.getDate() + 7)
                const cutoff = formatDate(nextWeek)
                const todayStr = formatDate(today)

                const sorted = [...races].sort((a, b) => a.round_number - b.round_number)
                const targetIdx = sorted.findIndex(r => r.date && r.date <= cutoff && r.date >= todayStr && r.status === 'upcoming')

                if (targetIdx === -1) {
                  alert('No upcoming race found within the next 7 days.')
                  return
                }

                const bulkUpdates = []
                for (let i = targetIdx; i < sorted.length; i++) {
                  if (sorted[i].date && sorted[i].status === 'upcoming') {
                    const d = new Date(sorted[i].date + 'T00:00:00')
                    d.setDate(d.getDate() + 7)
                    bulkUpdates.push({ id: sorted[i].id, date: formatDate(d) })
                  }
                }
                if (bulkUpdates.length) await put('/admin/races/bulk-update', { updates: bulkUpdates })
                load()
              }}
              className={btnSecondary}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                Push This Week's Race
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={btnSecondary}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Settings
              </span>
            </button>
          </div>
        </div>

        {/* Off Weeks */}
        {(offWeeks.length > 0 || seasonStart) && (
          <div className="mt-3 pt-3 border-t border-[#2A3458]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8892A8]">Weeks Off</h3>
              <button
                type="button"
                onClick={() => setOffWeekOpen(true)}
                className={btnSecondary}
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Add Week Off
                </span>
              </button>
            </div>
            {offWeeks.length > 0 ? (
              <div className="space-y-1">
                {offWeeks.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#E8ECF4]">
                      {o.date}
                      {o.reason && <span className="text-[#555F78] ml-2">— {o.reason}</span>}
                    </span>
                    <button onClick={() => removeOffWeek(o.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#555F78]">No weeks off scheduled.</p>
            )}
          </div>
        )}
      </div>

      {/* Add Off Week Modal */}
      {offWeekOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOffWeekOpen(false)}>
          <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#E8ECF4] mb-4">Add Week Off</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Date</label>
                <input type="date" value={offWeekDate} onChange={e => setOffWeekDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Reason (optional)</label>
                <input value={offWeekReason} onChange={e => setOffWeekReason(e.target.value)} placeholder="Holiday, vacation, etc." className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={addOffWeek}
                disabled={!offWeekDate}
                className={btnPrimary}
              >
                Add Week Off
              </button>
              <button
                type="button"
                onClick={() => setOffWeekOpen(false)}
                className="text-sm text-[#8892A8] hover:text-[#E8ECF4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSettingsOpen(false)}>
          <div className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#E8ECF4] mb-4">Season Schedule Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Season Start Date</label>
                <input type="date" value={seasonStart} onChange={e => setSeasonStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Race Day</label>
                <select value={raceDay} onChange={e => setRaceDay(parseInt(e.target.value))} className={inputCls}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Race Time</label>
                <input type="time" value={raceTime} onChange={e => setRaceTime(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={saveSettings}
                className={btnPrimary}
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-sm text-[#8892A8] hover:text-[#E8ECF4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Race */}
      <form onSubmit={create} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#8892A8] mb-3">Add Race</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <div className="relative">
            <input
              value={trackSearch}
              onChange={e => { setTrackSearch(e.target.value); setTrackOpen(true); setTrack(''); setTrackHighlight(-1) }}
              onFocus={() => setTrackOpen(true)}
              onKeyDown={e => {
                if (!trackOpen) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setTrackHighlight(prev => Math.min(prev + 1, filteredTracks.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setTrackHighlight(prev => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter' && trackHighlight >= 0 && filteredTracks[trackHighlight]) {
                  e.preventDefault()
                  handleTrackSelect(filteredTracks[trackHighlight])
                } else if (e.key === 'Escape') {
                  setTrackOpen(false)
                }
              }}
              placeholder="Search tracks..."
              className={`${inputCls} pr-8`}
            />
            {trackSearch && (
              <button
                type="button"
                onClick={() => { setTrackSearch(''); setTrack(''); setCountry(''); setTrackOpen(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555F78] hover:text-[#E8ECF4] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            </div>
            {trackOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1E2642] border border-[#2A3458] rounded-lg max-h-52 overflow-y-auto shadow-xl">
                {filteredTracks.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleTrackSelect(t)}
                    onMouseEnter={() => setTrackHighlight(i)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      i === trackHighlight ? 'bg-[#253052]' : 'hover:bg-[#253052]/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-[#E8ECF4]">{t.gp}</p>
                    <p className="text-xs text-[#555F78]">{t.name} · {t.city}, {t.country}</p>
                  </button>
                ))}
                {filteredTracks.length === 0 && (
                  <p className="px-3 py-2 text-sm text-[#555F78]">No tracks found</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={!track} className={btnPrimary}>Add Race</button>
          </div>
        </div>
        {track && (
          <p className="text-xs text-[#8892A8]">
            {seasonStart ? (
              <>Will be scheduled for <span className="text-[#7ED321] font-medium">{DAYS[raceDay]}, {getNextRaceDate()} at {raceTime}</span> as</>
            ) : (
              <>Will be added as</>
            )} Round {races.length > 0 ? Math.max(...races.map(r => r.round_number)) + 1 : 1}
            {!seasonStart && <span className="text-[#555F78]"> (set season start to auto-date)</span>}
          </p>
        )}
      </form>

      {/* Race list — draggable */}
      <div className="space-y-1">
        {races.map((r, i) => (
          <div
            key={r.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => { e.preventDefault(); setDragOverIndex(i) }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={e => { e.preventDefault(); handleDrop(dragIndex, i); setDragIndex(null); setDragOverIndex(null) }}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
            className={`bg-[#1E2642] border rounded-xl p-4 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
              dragOverIndex === i ? 'border-[#7ED321] scale-[1.01]' : 'border-[#2A3458]'
            } ${dragIndex === i ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              {/* Drag handle */}
              <svg className="w-4 h-4 text-[#555F78] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/>
              </svg>
              <div className="flex items-center">
                <div className="text-center mr-3 w-12 shrink-0">
                  <span className="text-[8px] uppercase tracking-wider text-[#8892A8] block leading-none">Round</span>
                  <span className="text-xl font-black text-[#7ED321] leading-none">{i + 1}</span>
                </div>
                <div>
                  <span className="font-medium text-[#E8ECF4]">{r.track_name}</span>
                  <span className="text-[#8892A8] text-sm ml-2">{r.country}</span>
                  <p className="text-[10px] text-[#555F78] font-mono">Race ID: {r.id}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {editingDateId === r.id ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="date"
                    value={editingDateValue}
                    onChange={e => setEditingDateValue(e.target.value)}
                    className="bg-[#141A2E] border border-[#7ED321] rounded px-2 py-0.5 text-xs text-[#E8ECF4] focus:outline-none"
                  />
                  <button onClick={() => setRaceDate(r.id, editingDateValue)} className={btnPrimary}>Save</button>
                  <button onClick={() => setEditingDateId(null)} className={btnSecondary}>Cancel</button>
                </span>
              ) : (
                <>
                  <span className="text-[#8892A8] text-xs shrink-0">
                    {formatRaceDate(r.date)}{r.time ? ` · ${(() => { const [h,m] = r.time.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}` })()}` : ''}
                  </span>
                  <button
                    onClick={() => { setEditingDateId(r.id); setEditingDateValue(r.date || '') }}
                    className={btnSecondary}
                  >✎</button>
                </>
              )}
              {r.status === 'upcoming' && (
                <button onClick={() => markCompleted(r.id)} className={btnPrimary}>Mark Completed</button>
              )}
              {r.status === 'completed' && (
                <span className="text-xs bg-[#7ED321]/15 text-[#7ED321] px-2 py-1 rounded-md">Completed</span>
              )}
              <button onClick={() => remove(r.id)} className={btnDanger}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
