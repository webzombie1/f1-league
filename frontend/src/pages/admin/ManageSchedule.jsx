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
      if (s.id) {
        setSeasonId(s.id)
        get(`/races?season_id=${s.id}`).then(setRaces)
      }
    }).catch(() => {})
  }, [])

  const load = () => {
    if (seasonId) get(`/races?season_id=${seasonId}`).then(setRaces)
  }

  const create = async (e) => {
    e.preventDefault()
    if (!track.trim() || !round || !seasonId) return
    await post('/admin/races', {
      season_id: seasonId,
      round_number: parseInt(round),
      track_name: track,
      country,
      date,
      time,
    })
    setRound('')
    setTrack('')
    setCountry('')
    setDate('')
    setTime('')
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Schedule</h1>

      <form onSubmit={create} className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-20">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Round</label>
            <input
              type="number"
              value={round}
              onChange={e => setRound(e.target.value)}
              placeholder="1"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Track</label>
            <input
              value={track}
              onChange={e => setTrack(e.target.value)}
              placeholder="Bahrain International Circuit"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Country</label>
            <input
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="Bahrain"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div className="w-40">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
          <button type="submit" className="bg-[#B5764B] hover:bg-[#A36840] text-white px-4 py-2 rounded-lg text-sm font-medium">
            Add Race
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {races.map(r => (
          <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-stone-400 text-sm mr-2">R{r.round_number}</span>
              <span className="font-medium">{r.track_name}</span>
              <span className="text-stone-400 text-sm ml-2">
                {r.country}{r.date ? ` — ${r.date}` : ''}
              </span>
            </div>
            <div className="flex gap-3 items-center">
              {r.status === 'upcoming' && (
                <button onClick={() => markCompleted(r.id)} className="text-xs text-green-600 hover:underline">
                  Mark Completed
                </button>
              )}
              {r.status === 'completed' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md">Completed</span>
              )}
              <button onClick={() => remove(r.id)} className="text-xs text-red-500 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
