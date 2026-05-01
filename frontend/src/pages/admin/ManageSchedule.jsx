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

  // Celebration hero modal state
  const [heroModalRace, setHeroModalRace] = useState(null)
  const [heroTemplates, setHeroTemplates] = useState([])
  const [heroTemplateId, setHeroTemplateId] = useState(null)
  const [heroPodiumTag, setHeroPodiumTag] = useState('')
  const [heroCandidates, setHeroCandidates] = useState([])
  const [heroActive, setHeroActive] = useState('')
  const [heroGenerating, setHeroGenerating] = useState(false)
  const [heroError, setHeroError] = useState('')
  const [heroJustGeneratedId, setHeroJustGeneratedId] = useState(null)
  const [heroSelectedId, setHeroSelectedId] = useState(null)
  const [heroModel, setHeroModel] = useState('nano-banana-pro-preview')

  const HERO_MODELS = [
    { id: 'nano-banana-pro-preview', label: 'Nano Banana Pro (best likeness)' },
    { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (alt)' },
    { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash (faster, cheaper)' },
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash (legacy)' },
  ]
  const modelLabel = (id) => HERO_MODELS.find(m => m.id === id)?.label.split(' (')[0] || id

  const refreshCandidates = async (raceId) => {
    const res = await get(`/admin/races/${raceId}/hero-candidates`).catch(() => null)
    if (res) {
      const candidates = res.candidates || []
      setHeroCandidates(candidates)
      setHeroActive(res.active_hero_image || '')
      // If the currently-selected thumbnail was deleted, fall back to active or newest.
      setHeroSelectedId(prev => {
        if (prev && candidates.some(c => c.id === prev)) return prev
        const activeMatch = candidates.find(c => c.image_path === (res.active_hero_image || ''))
        return activeMatch?.id ?? (candidates[0]?.id ?? null)
      })
    }
  }

  const openHeroModal = async (race) => {
    setHeroModalRace(race)
    setHeroError('')
    setHeroCandidates([])
    setHeroActive(race.hero_image || '')
    setHeroJustGeneratedId(null)
    setHeroSelectedId(null)
    const [templates, suggestion] = await Promise.all([
      get('/admin/celebration-templates'),
      get(`/admin/races/${race.id}/celebration-suggestion`).catch(() => null),
    ])
    const active = (templates || []).filter(t => t.is_active && t.image_path)
    setHeroTemplates(active)
    setHeroTemplateId(suggestion?.template_id || (active[0]?.id ?? null))
    setHeroPodiumTag(suggestion?.podium_tag || '')
    refreshCandidates(race.id)
  }

  const closeHeroModal = () => {
    setHeroModalRace(null)
    setHeroError('')
  }

  const generateHero = async () => {
    if (!heroModalRace || !heroTemplateId) return
    setHeroGenerating(true)
    setHeroError('')
    try {
      const res = await post(`/admin/races/${heroModalRace.id}/generate-celebration-hero`, {
        template_id: heroTemplateId,
        model: heroModel,
      })
      if (res.error) {
        setHeroError(res.error)
      } else {
        await refreshCandidates(heroModalRace.id)
        setHeroJustGeneratedId(res.candidate_id || null)
        // Auto-select the new candidate so it shows in the large preview.
        if (res.candidate_id) setHeroSelectedId(res.candidate_id)
      }
    } catch (e) {
      setHeroError(e.message || 'Generation failed.')
    }
    setHeroGenerating(false)
  }

  const useCandidate = async (imagePath) => {
    if (!heroModalRace) return
    await post(`/admin/races/${heroModalRace.id}/hero-image`, { image_path: imagePath })
    setHeroActive(imagePath)
    if (seasonId) setRaces(await get(`/races?season_id=${seasonId}`))
  }

  const deleteCandidate = async (candidateId) => {
    if (!confirm('Delete this generation?')) return
    await del(`/admin/races/hero-candidates/${candidateId}`)
    if (heroModalRace) refreshCandidates(heroModalRace.id)
    if (seasonId) setRaces(await get(`/races?season_id=${seasonId}`))
  }

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

  const inputCls = "w-full bg-[#111111] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#777777] focus:outline-none focus:border-[#7ED321]"
  const btnBase = "cursor-pointer font-bold uppercase text-xs tracking-wider px-4 py-2 rounded transition-all inline-flex items-center justify-center h-8"
  const btnPrimary = `${btnBase} bg-gradient-to-b from-[#7ED321] to-[#5BA318] border border-[#8EE835] text-[#0D1117] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-[#8EE835] hover:to-[#6BC11A] disabled:from-[#1F1F1F] disabled:to-[#191919] disabled:border-[#1F1F1F] disabled:text-[#777777] disabled:shadow-none disabled:cursor-not-allowed`
  const btnDanger = `${btnBase} bg-gradient-to-b from-red-500 to-red-700 border border-red-400 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-red-400 hover:to-red-600`
  const btnSecondary = `${btnBase} bg-gradient-to-b from-[#1F1F1F] to-[#191919] border border-[#383838] text-[#999999] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:text-[#E8ECF4] hover:border-[#777777]`

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
            <div className="w-10 h-10 border-3 border-[#1F1F1F] border-t-[#7ED321] rounded-full animate-spin" />
            <p className="text-sm text-[#999999]">Saving...</p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold">Manage Schedule</h1>

      {/* Season Schedule Settings — summary bar */}
      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between">
          {seasonStart ? (
            <p className="text-sm text-[#999999]">
              Races on <span className="text-[#E8ECF4] font-medium">{DAYS[raceDay]}s</span> at <span className="text-[#E8ECF4] font-medium">{raceTime}</span>, starting <span className="text-[#E8ECF4] font-medium">{seasonStart}</span>
              {settingsSaved && <span className="text-[#7ED321] ml-2">Saved!</span>}
            </p>
          ) : (
            <p className="text-sm text-[#777777]">No schedule settings configured yet.</p>
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
          <div className="mt-3 pt-3 border-t border-[#1F1F1F]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#999999]">Weeks Off</h3>
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
                      {o.reason && <span className="text-[#777777] ml-2">— {o.reason}</span>}
                    </span>
                    <button onClick={() => removeOffWeek(o.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#777777]">No weeks off scheduled.</p>
            )}
          </div>
        )}
      </div>

      {/* Add Off Week Modal */}
      {offWeekOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOffWeekOpen(false)}>
          <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#E8ECF4] mb-4">Add Week Off</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Date</label>
                <input type="date" value={offWeekDate} onChange={e => setOffWeekDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Reason (optional)</label>
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
                className="text-sm text-[#999999] hover:text-[#E8ECF4] transition-colors"
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
          <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#E8ECF4] mb-4">Season Schedule Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Season Start Date</label>
                <input type="date" value={seasonStart} onChange={e => setSeasonStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Race Day</label>
                <select value={raceDay} onChange={e => setRaceDay(parseInt(e.target.value))} className={inputCls}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Race Time</label>
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
                className="text-sm text-[#999999] hover:text-[#E8ECF4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Race */}
      <form onSubmit={create} className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#999999] mb-3">Add Race</h2>
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#E8ECF4] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            </div>
            {trackOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#191919] border border-[#1F1F1F] rounded-lg max-h-52 overflow-y-auto shadow-xl">
                {filteredTracks.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleTrackSelect(t)}
                    onMouseEnter={() => setTrackHighlight(i)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      i === trackHighlight ? 'bg-[#1F1F1F]' : 'hover:bg-[#1F1F1F]/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-[#E8ECF4]">{t.gp}</p>
                    <p className="text-xs text-[#777777]">{t.name} · {t.city}, {t.country}</p>
                  </button>
                ))}
                {filteredTracks.length === 0 && (
                  <p className="px-3 py-2 text-sm text-[#777777]">No tracks found</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={!track} className={btnPrimary}>Add Race</button>
          </div>
        </div>
        {track && (
          <p className="text-xs text-[#999999]">
            {seasonStart ? (
              <>Will be scheduled for <span className="text-[#7ED321] font-medium">{DAYS[raceDay]}, {getNextRaceDate()} at {raceTime}</span> as</>
            ) : (
              <>Will be added as</>
            )} Round {races.length > 0 ? Math.max(...races.map(r => r.round_number)) + 1 : 1}
            {!seasonStart && <span className="text-[#777777]"> (set season start to auto-date)</span>}
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
            className={`bg-[#191919] border rounded-xl p-4 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
              dragOverIndex === i ? 'border-[#7ED321] scale-[1.01]' : 'border-[#1F1F1F]'
            } ${dragIndex === i ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              {/* Drag handle */}
              <svg className="w-4 h-4 text-[#777777] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/>
              </svg>
              <div className="flex items-center">
                <div className="text-center mr-3 w-12 shrink-0">
                  <span className="text-[8px] uppercase tracking-wider text-[#999999] block leading-none">Round</span>
                  <span className="text-xl font-black text-[#7ED321] leading-none">{i + 1}</span>
                </div>
                <div>
                  <span className="font-medium text-[#E8ECF4]">{r.track_name}</span>
                  <span className="text-[#999999] text-sm ml-2">{r.country}</span>
                  <p className="text-[10px] text-[#777777] font-mono">Race ID: {r.id}</p>
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
                    className="bg-[#111111] border border-[#7ED321] rounded px-2 py-0.5 text-xs text-[#E8ECF4] focus:outline-none"
                  />
                  <button onClick={() => setRaceDate(r.id, editingDateValue)} className={btnPrimary}>Save</button>
                  <button onClick={() => setEditingDateId(null)} className={btnSecondary}>Cancel</button>
                </span>
              ) : (
                <>
                  <span className="text-[#999999] text-xs shrink-0">
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
                <>
                  <span className="text-xs bg-[#7ED321]/15 text-[#7ED321] px-2 py-1 rounded-md">Completed</span>
                  <button onClick={() => openHeroModal(r)} className={btnSecondary}>Hero</button>
                </>
              )}
              <button onClick={() => remove(r.id)} className={btnDanger}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Celebration hero modal */}
      {heroModalRace && (() => {
        const selected = heroCandidates.find(c => c.id === heroSelectedId)
        const previewIsActive = selected && heroActive === selected.image_path
        return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 overflow-y-auto" onClick={closeHeroModal}>
          <div className="w-full max-w-5xl my-8 bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#E8ECF4]">Hero candidates</h3>
                <p className="text-xs text-[#777777] mt-0.5">
                  Round {heroModalRace.round_number}: {heroModalRace.track_name} · {heroModalRace.country}
                </p>
              </div>
              <button onClick={closeHeroModal} className="text-[#999999] hover:text-white text-2xl leading-none cursor-pointer">×</button>
            </div>

            <div className="p-5 flex gap-5">
              {/* Left column — controls + large preview */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Celebration template</label>
                    <select
                      value={heroTemplateId || ''}
                      onChange={e => setHeroTemplateId(parseInt(e.target.value) || null)}
                      className="w-full bg-[#0D1117] border border-[#1F1F1F] rounded px-2 py-2 text-sm text-[#E8ECF4]"
                    >
                      {heroTemplates.length === 0 ? (
                        <option value="">No active templates with images</option>
                      ) : (
                        heroTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Model</label>
                    <select
                      value={heroModel}
                      onChange={e => setHeroModel(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#1F1F1F] rounded px-2 py-2 text-sm text-[#E8ECF4]"
                    >
                      {HERO_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  {heroPodiumTag && (
                    <span className="text-[10px] uppercase tracking-wider bg-[#7ED321]/15 text-[#7ED321] px-2 py-1 rounded">
                      Suggested: {heroPodiumTag}
                    </span>
                  )}
                  <button
                    onClick={generateHero}
                    disabled={heroGenerating || !heroTemplateId}
                    className={btnPrimary}
                  >
                    {heroGenerating ? 'Generating…' : '+ Generate'}
                  </button>
                </div>

                {heroError && (
                  <p className="text-xs text-red-400">{heroError}</p>
                )}

                {heroJustGeneratedId && !heroGenerating && (
                  <div className="bg-[#7ED321]/10 border border-[#7ED321]/40 rounded px-3 py-2 text-xs text-[#7ED321] flex items-center justify-between">
                    <span>✓ New candidate ready — click <strong>Use this image</strong> below to set it as the race hero.</span>
                    <button
                      onClick={() => setHeroJustGeneratedId(null)}
                      className="text-[#7ED321] hover:text-white text-base leading-none cursor-pointer ml-3"
                      title="Dismiss"
                    >×</button>
                  </div>
                )}

                {/* Large preview */}
                <div className="aspect-[16/9] bg-[#0D1117] border border-[#1F1F1F] rounded overflow-hidden flex items-center justify-center relative">
                  {heroGenerating ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-3 border-[#1F1F1F] border-t-[#7ED321] rounded-full animate-spin" />
                      <p className="text-sm text-[#999999]">Generating… 20–40s with the pro model.</p>
                    </div>
                  ) : selected ? (
                    <img src={selected.image_path} alt="" className="w-full h-full object-cover" />
                  ) : heroActive ? (
                    <img src={heroActive} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-[#555] text-xs uppercase tracking-wider">
                      Pick a template and click Generate to create your first candidate
                    </p>
                  )}
                </div>

                {/* Preview caption + actions */}
                {selected && !heroGenerating && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#E8ECF4] truncate">
                        {selected.template_name || 'Custom'}
                        {selected.driver_name ? <span className="text-[#777777]"> · {selected.driver_name}</span> : null}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-[#777777] mt-0.5">
                        {selected.model ? modelLabel(selected.model) : 'Unknown model'}
                      </p>
                      {previewIsActive && (
                        <p className="text-[10px] uppercase tracking-wider text-[#7ED321] font-bold mt-0.5">In use as race hero</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => deleteCandidate(selected.id)}
                        className={btnSecondary}
                      >Delete</button>
                      <button
                        onClick={() => useCandidate(selected.image_path)}
                        disabled={previewIsActive}
                        className={`${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {previewIsActive ? 'In use' : 'Use this image'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right column — vertical thumbnail rail */}
              <div className="w-48 shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">Saved</h4>
                  <span className="text-[10px] text-[#777777]">{heroCandidates.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '480px' }}>
                  {heroCandidates.length === 0 ? (
                    <p className="text-[11px] text-[#555] leading-relaxed">
                      No saved generations yet.
                    </p>
                  ) : heroCandidates.map(c => {
                    const isSelected = heroSelectedId === c.id
                    const isActive = heroActive === c.image_path
                    const isJustGenerated = heroJustGeneratedId === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setHeroSelectedId(c.id)}
                        className={`relative w-full aspect-[16/9] rounded overflow-hidden border-2 transition-colors cursor-pointer block ${
                          isSelected
                            ? 'border-[#7ED321]'
                            : isJustGenerated
                              ? 'border-[#7ED321]/70 shadow-[0_0_16px_rgba(126,211,33,0.35)]'
                              : 'border-[#1F1F1F] hover:border-[#555]'
                        }`}
                      >
                        <img src={c.image_path} alt="" className="w-full h-full object-cover" />
                        {isActive && (
                          <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wider bg-[#7ED321] text-[#0D1117] font-black px-1.5 py-0.5 rounded">
                            In use
                          </span>
                        )}
                        {isJustGenerated && !isActive && (
                          <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wider bg-[#7ED321] text-[#0D1117] font-black px-1.5 py-0.5 rounded">
                            New
                          </span>
                        )}
                        <span
                          onClick={(e) => { e.stopPropagation(); deleteCandidate(c.id) }}
                          role="button"
                          tabIndex={0}
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/70 hover:bg-red-500/80 text-white text-xs leading-none cursor-pointer rounded"
                          title="Delete"
                        >×</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#1F1F1F] flex justify-end">
              <button onClick={closeHeroModal} className={btnSecondary}>Done</button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
