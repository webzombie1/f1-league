import { useState, useEffect } from 'react'
import { get, post, put } from '../../api'

export default function ManageSeasons() {
  const [seasons, setSeasons] = useState([])
  const [name, setName] = useState('')
  const [year, setYear] = useState(2026)

  const load = () => get('/seasons').then(setSeasons).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await post('/admin/seasons', { name, year })
    setName('')
    load()
  }

  const setActive = async (id) => {
    await put(`/admin/seasons/${id}`, { is_active: true })
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Seasons</h1>

      <form onSubmit={create} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Season Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Season 1"
            className="w-full bg-[#141A2E] border border-[#2A3458] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#555F78] focus:outline-none focus:border-[#7ED321]" />
        </div>
        <div className="w-24">
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="w-full bg-[#141A2E] border border-[#2A3458] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] focus:outline-none focus:border-[#7ED321]" />
        </div>
        <button type="submit" className="bg-[#7ED321] hover:bg-[#6BC11A] text-[#141A2E] font-semibold px-4 py-2 rounded-lg text-sm">Create</button>
      </form>

      <div className="space-y-2">
        {seasons.map(s => (
          <div key={s.id} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="font-medium text-[#E8ECF4]">{s.name}</span>
              <span className="text-[#8892A8] text-sm ml-2">({s.year})</span>
            </div>
            {s.is_active ? (
              <span className="text-xs bg-[#7ED321]/15 text-[#7ED321] px-2 py-1 rounded-md font-medium">Active</span>
            ) : (
              <button onClick={() => setActive(s.id)} className="text-xs text-[#7ED321] hover:underline">Set Active</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
