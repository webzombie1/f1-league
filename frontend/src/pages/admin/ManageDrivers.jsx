import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'
import PlatformIcon from '../../components/PlatformIcon'

export default function ManageDrivers() {
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [number, setNumber] = useState('')
  const [teamId, setTeamId] = useState('')
  const [eaTag, setEaTag] = useState('')
  const [platform, setPlatform] = useState('')
  const [discordName, setDiscordName] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  const startEdit = (d) => {
    setEditingId(d.id)
    setEditData({
      name: d.name || '', abbreviation: d.abbreviation || '', number: d.number || '',
      team_id: d.team_id || '', ea_tag: d.ea_tag || '', platform: d.platform || '',
      discord_name: d.discord_name || '', discord_url: d.discord_url || '',
    })
  }

  const saveEdit = async () => {
    await put(`/admin/drivers/${editingId}`, {
      ...editData,
      number: editData.number ? parseInt(editData.number) : null,
      team_id: editData.team_id ? parseInt(editData.team_id) : null,
    })
    setEditingId(null)
    load()
  }

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) { setSeasonId(s.id); get(`/drivers?season_id=${s.id}`).then(setDrivers); get(`/teams?season_id=${s.id}`).then(setTeams) }
    }).catch(() => {})
  }, [])

  const load = () => { if (seasonId) get(`/drivers?season_id=${seasonId}`).then(setDrivers) }

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim() || !seasonId) return
    await post('/admin/drivers', {
      season_id: seasonId, team_id: teamId ? parseInt(teamId) : null,
      name, abbreviation: abbreviation || name.slice(0, 3).toUpperCase(),
      number: number ? parseInt(number) : null,
      ea_tag: eaTag,
      platform,
      discord_name: discordName,
      discord_url: discordUrl,
    })
    setName(''); setAbbreviation(''); setNumber(''); setEaTag(''); setPlatform(''); setDiscordName(''); setDiscordUrl('')
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this driver?')) return
    await del(`/admin/drivers/${id}`)
    load()
  }

  const inputCls = "w-full bg-[#111111] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#777777] focus:outline-none focus:border-[#7ED321]"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Drivers</h1>
        {drivers.length > 0 && (
          <button
            onClick={async () => {
              if (!confirm(`Delete all ${drivers.length} drivers? This cannot be undone.`)) return
              for (const d of drivers) await del(`/admin/drivers/${d.id}`)
              load()
            }}
            className="cursor-pointer bg-gradient-to-b from-red-500 to-red-700 border border-red-400 text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-red-400 hover:to-red-600 transition-all"
          >
            Delete All
          </button>
        )}
      </div>

      <form onSubmit={create} className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-5 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Max Verstappen" className={inputCls} />
          </div>
          <div className="w-20">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Abbr</label>
            <input value={abbreviation} onChange={e => setAbbreviation(e.target.value.toUpperCase())} placeholder="VER" maxLength={3} className={inputCls} />
          </div>
          <div className="w-20">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">#</label>
            <input type="number" value={number} onChange={e => setNumber(e.target.value)} placeholder="1" className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">EA Tag</label>
            <input value={eaTag} onChange={e => setEaTag(e.target.value)} placeholder="EA gamertag" className={inputCls} />
          </div>
          <div className="w-36">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Platform</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              <option value="steam">Steam</option>
              <option value="playstation">PlayStation</option>
              <option value="xbox">Xbox</option>
              <option value="ai">AI</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Discord Name</label>
            <input value={discordName} onChange={e => setDiscordName(e.target.value)} placeholder="username#1234" className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Discord Profile URL</label>
            <input value={discordUrl} onChange={e => setDiscordUrl(e.target.value)} placeholder="https://discord.com/users/..." className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Team</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className={inputCls}>
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" className="bg-[#7ED321] hover:bg-[#6BC11A] text-[#111111] font-semibold px-4 py-2 rounded-lg text-sm">Add</button>
        </div>
      </form>

      <div className="space-y-2">
        {drivers.map(d => (
          <div key={d.id} className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-hidden">
            {/* Summary row — click to expand */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1F1F1F] transition-colors"
              onClick={() => editingId === d.id ? setEditingId(null) : startEdit(d)}
            >
              <div className="flex items-center gap-3">
                {d.photo_url ? (
                  <img src={d.photo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1F1F1F] shrink-0 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#777777]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                )}
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: d.team_color || '#555' }} />
                <PlatformIcon platform={d.platform} className="w-4 h-4" />
                <span className="font-medium text-[#E8ECF4]">#{d.number || '?'} {d.name}</span>
                <span className="text-[#999999] text-sm">{d.abbreviation}</span>
                <span className="text-[#777777] text-sm">— {d.team_name || 'No team'}</span>
                {d.discord_name && <span className="text-[#777777] text-xs ml-2 font-mono">({d.discord_name})</span>}
              </div>
              <svg className={`w-4 h-4 text-[#777777] transition-transform ${editingId === d.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded edit panel */}
            {editingId === d.id && (
              <div className="border-t border-[#1F1F1F] p-4 space-y-3 bg-[#141414]">
                {/* Photos */}
                <div className="flex gap-4 items-start mb-4">
                  <div className="text-center">
                    <p className="text-[8px] text-[#999999] uppercase tracking-wider mb-1">Thumbnail</p>
                    <div className="w-16 h-16 rounded-lg bg-[#1F1F1F] overflow-hidden mb-1">
                      {d.photo_url ? <img src={d.photo_url} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <label className="cursor-pointer text-[10px] text-[#7ED321] hover:underline">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files[0]; if (!file) return
                        const form = new FormData(); form.append('file', file)
                        await fetch(`/api/admin/drivers/${d.id}/photo`, { method: 'POST', credentials: 'include', body: form })
                        load()
                      }} />
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] text-[#999999] uppercase tracking-wider mb-1">Standing</p>
                    <div className="w-16 h-20 rounded-lg bg-[#1F1F1F] overflow-hidden mb-1">
                      {d.photo_standing ? <img src={d.photo_standing} alt="" className="w-full h-full object-cover object-top" /> : null}
                    </div>
                    <label className="cursor-pointer text-[10px] text-[#7ED321] hover:underline">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files[0]; if (!file) return
                        const form = new FormData(); form.append('file', file)
                        await fetch(`/api/admin/drivers/${d.id}/photo?type=standing`, { method: 'POST', credentials: 'include', body: form })
                        load()
                      }} />
                    </label>
                  </div>
                </div>

                {/* Edit fields */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Name</label>
                    <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className={inputCls} />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Abbr</label>
                    <input value={editData.abbreviation} onChange={e => setEditData({...editData, abbreviation: e.target.value.toUpperCase()})} maxLength={3} className={inputCls} />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">#</label>
                    <input type="number" value={editData.number} onChange={e => setEditData({...editData, number: e.target.value})} className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">EA Tag</label>
                    <input value={editData.ea_tag} onChange={e => setEditData({...editData, ea_tag: e.target.value})} className={inputCls} />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Platform</label>
                    <select value={editData.platform} onChange={e => setEditData({...editData, platform: e.target.value})} className={inputCls}>
                      <option value="">Select...</option>
                      <option value="steam">Steam</option>
                      <option value="playstation">PlayStation</option>
                      <option value="xbox">Xbox</option>
                      <option value="ai">AI</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Discord Name</label>
                    <input value={editData.discord_name} onChange={e => setEditData({...editData, discord_name: e.target.value})} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Discord URL</label>
                    <input value={editData.discord_url} onChange={e => setEditData({...editData, discord_url: e.target.value})} className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Team</label>
                    <select value={editData.team_id} onChange={e => setEditData({...editData, team_id: e.target.value})} className={inputCls}>
                      <option value="">No team</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveEdit} className="cursor-pointer bg-gradient-to-b from-[#7ED321] to-[#5BA318] border border-[#8EE835] text-[#0D1117] font-bold uppercase text-xs tracking-wider px-5 py-2 rounded transition-all">Save Changes</button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-[#999999] hover:text-[#E8ECF4]">Cancel</button>
                  <button onClick={() => { remove(d.id); setEditingId(null) }} className="ml-auto cursor-pointer bg-gradient-to-b from-red-500 to-red-700 border border-red-400 text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded transition-all">Delete Driver</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
