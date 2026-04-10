import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'

export default function ManageSchedule() {
  const [races, setRaces] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [round, setRound] = useState('')
  const [track, setTrack] = useState('')
  const [country, setCountry] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) { setSeasonId(s.id); get(`/races?season_id=${s.id}`).then(setRaces) }
    }).catch(() => {})
  }, [])

  const load = () => { if (seasonId) get(`/races?season_id=${seasonId}`).then(setRaces) }

  const create = async (e) => {
    e.preventDefault()
    if (!track.trim() || !round || !seasonId) return
    await post('/admin/races', { season_id: seasonId, round_number: parseInt(round), track_name: track, country, date, time })
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
          <div className="flex-1">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Track</label>
            <input value={track} onChange={e => setTrack(e.target.value)} placeholder="Bahrain International Circuit" className={inputCls} />
          </div>
          <div className="w-32">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Country</label>
            <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Bahrain" className={inputCls} />
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
