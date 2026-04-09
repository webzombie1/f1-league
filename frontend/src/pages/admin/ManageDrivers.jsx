import { useState, useEffect } from 'react'
import { get, post, del } from '../../api'

export default function ManageDrivers() {
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [number, setNumber] = useState('')
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) {
        setSeasonId(s.id)
        get(`/drivers?season_id=${s.id}`).then(setDrivers)
        get(`/teams?season_id=${s.id}`).then(setTeams)
      }
    }).catch(() => {})
  }, [])

  const load = () => {
    if (seasonId) get(`/drivers?season_id=${seasonId}`).then(setDrivers)
  }

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim() || !seasonId) return
    await post('/admin/drivers', {
      season_id: seasonId,
      team_id: teamId ? parseInt(teamId) : null,
      name,
      abbreviation: abbreviation || name.slice(0, 3).toUpperCase(),
      number: number ? parseInt(number) : null,
    })
    setName('')
    setAbbreviation('')
    setNumber('')
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this driver?')) return
    await del(`/admin/drivers/${id}`)
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Drivers</h1>

      <form onSubmit={create} className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Max Verstappen"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Abbr</label>
            <input
              value={abbreviation}
              onChange={e => setAbbreviation(e.target.value.toUpperCase())}
              placeholder="VER"
              maxLength={3}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">#</label>
            <input
              type="number"
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="1"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            />
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">Team</label>
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
            >
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" className="bg-[#B5764B] hover:bg-[#A36840] text-white px-4 py-2 rounded-lg text-sm font-medium">
            Add
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {drivers.map(d => (
          <div key={d.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: d.team_color || '#ccc' }}
              />
              <span className="font-medium">#{d.number || '?'} {d.name}</span>
              <span className="text-stone-400 text-sm">{d.abbreviation}</span>
              <span className="text-stone-400 text-sm">— {d.team_name || 'No team'}</span>
            </div>
            <button onClick={() => remove(d.id)} className="text-xs text-red-500 hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
