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

export default function ManageSchedule() {
  const [races, setRaces] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [round, setRound] = useState('')
  const [track, setTrack] = useState('')
  const [trackSearch, setTrackSearch] = useState('')
  const [trackOpen, setTrackOpen] = useState(false)
  const [trackHighlight, setTrackHighlight] = useState(-1)
  const [country, setCountry] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

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

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) { setSeasonId(s.id); get(`/races?season_id=${s.id}`).then(setRaces) }
    }).catch(() => {})
  }, [])

  const load = () => { if (seasonId) get(`/races?season_id=${seasonId}`).then(setRaces) }

  const create = async (e) => {
    e.preventDefault()
    if (!track.trim() || !round || !seasonId) return
    const selectedTrack = F125_TRACKS.find(t => t.name === track)
    const trackImage = selectedTrack
      ? `https://media.formula1.com/image/upload/c_lfill,w_720/q_auto/v1740000001/fom-website/static-assets/2026/races/card/${selectedTrack.image}.webp`
      : ''
    await post('/admin/races', { season_id: seasonId, round_number: parseInt(round), track_name: track, country, date, time, track_image: trackImage })
    setRound(''); setTrack(''); setCountry(''); setDate(''); setTime('')
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this race?')) return
    await del(`/admin/races/${id}`)
    load()
  }

  const markCompleted = async (id) => {
    await put(`/admin/races/${id}`, { status: 'completed' })
    load()
  }

  const inputCls = "w-full bg-[#141A2E] border border-[#2A3458] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#555F78] focus:outline-none focus:border-[#7ED321]"

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Schedule</h1>

      <form onSubmit={create} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-20">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Round</label>
            <input type="number" value={round} onChange={e => setRound(e.target.value)} placeholder="1" className={inputCls} />
          </div>
          <div className="flex-1 relative">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Track</label>
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
        </div>
        <div className="flex gap-3 items-end">
          <div className="w-40">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="w-28">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" className="bg-[#7ED321] hover:bg-[#6BC11A] text-[#141A2E] font-semibold px-4 py-2 rounded-lg text-sm">Add Race</button>
        </div>
      </form>

      <div className="space-y-2">
        {races.map(r => (
          <div key={r.id} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[#8892A8] text-sm mr-2">R{r.round_number}</span>
              <span className="font-medium text-[#E8ECF4]">{r.track_name}</span>
              <span className="text-[#8892A8] text-sm ml-2">{r.country}{r.date ? ` — ${r.date}` : ''}</span>
            </div>
            <div className="flex gap-3 items-center">
              {r.status === 'upcoming' && (
                <button onClick={() => markCompleted(r.id)} className="text-xs text-[#7ED321] hover:underline">Mark Completed</button>
              )}
              {r.status === 'completed' && (
                <span className="text-xs bg-[#7ED321]/15 text-[#7ED321] px-2 py-1 rounded-md">Completed</span>
              )}
              <button onClick={() => remove(r.id)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
