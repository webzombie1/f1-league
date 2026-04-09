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

      <form onSubmit={create} className="bg-white border border-stone-200 rounded-xl p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Season Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Season 1"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
          />
        </div>
        <button type="submit" className="bg-[#B5764B] hover:bg-[#A36840] text-white px-4 py-2 rounded-lg text-sm font-medium">
          Create
        </button>
      </form>

      <div className="space-y-2">
        {seasons.map(s => (
          <div key={s.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="font-medium">{s.name}</span>
              <span className="text-stone-400 text-sm ml-2">({s.year})</span>
            </div>
            {s.is_active ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-medium">Active</span>
            ) : (
              <button
                onClick={() => setActive(s.id)}
                className="text-xs text-[#B5764B] hover:underline"
              >
                Set Active
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
