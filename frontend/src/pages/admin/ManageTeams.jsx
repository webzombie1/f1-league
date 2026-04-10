import { useState, useEffect } from 'react'
import { get, post, del } from '../../api'

export default function ManageTeams() {
  const [teams, setTeams] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#E80020')

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) { setSeasonId(s.id); get(`/teams?season_id=${s.id}`).then(setTeams) }
    }).catch(() => {})
  }, [])

  const load = () => { if (seasonId) get(`/teams?season_id=${seasonId}`).then(setTeams) }

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim() || !seasonId) return
    await post('/admin/teams', { season_id: seasonId, name, color })
    setName('')
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this team?')) return
    await del(`/admin/teams/${id}`)
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Teams</h1>

      <form onSubmit={create} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Team Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Red Bull Racing"
            className="w-full bg-[#141A2E] border border-[#2A3458] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#555F78] focus:outline-none focus:border-[#7ED321]" />
        </div>
        <div className="w-20">
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Color</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-9 rounded-lg cursor-pointer bg-transparent" />
        </div>
        <button type="submit" className="bg-[#7ED321] hover:bg-[#6BC11A] text-[#141A2E] font-semibold px-4 py-2 rounded-lg text-sm">Add</button>
      </form>

      <div className="space-y-2">
        {teams.map(t => (
          <div key={t.id} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.color }} />
              <span className="font-medium text-[#E8ECF4]">{t.name}</span>
              <span className="text-[#8892A8] text-sm">({(t.drivers || []).length} driver{(t.drivers || []).length !== 1 ? 's' : ''})</span>
            </div>
            <button onClick={() => remove(t.id)} className="text-xs text-red-400 hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
