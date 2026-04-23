import { useState, useEffect } from 'react'
import { get, post, del } from '../../api'

function getYoutubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export default function ManageHighlights() {
  const [races, setRaces] = useState([])
  const [highlights, setHighlights] = useState([])
  const [raceId, setRaceId] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    get('/races').then(r => setRaces(r.filter(x => x.status === 'completed'))).catch(() => {})
    loadHighlights()
  }, [])

  const loadHighlights = () => {
    fetch('/api/admin/highlights', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setHighlights(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  const add = async (e) => {
    e.preventDefault()
    if (!raceId || !url) return
    const autoTitle = title || `Highlight — ${races.find(r => r.id === parseInt(raceId))?.track_name || 'Race'}`
    await post('/admin/highlights', { race_id: parseInt(raceId), title: autoTitle, youtube_url: url })
    setTitle('')
    setUrl('')
    loadHighlights()
  }

  const remove = async (id) => {
    await del(`/admin/highlights/${id}`)
    loadHighlights()
  }

  const inputCls = "w-full bg-[#111111] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#777777] focus:outline-none focus:border-[#7ED321]"

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Highlights</h1>

      <form onSubmit={add} className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-48">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Race</label>
            <select value={raceId} onChange={e => setRaceId(e.target.value)} className={inputCls}>
              <option value="">Select race...</option>
              {races.map(r => <option key={r.id} value={r.id}>R{r.round_number}: {r.track_name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">YouTube URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#999999] uppercase tracking-wider mb-1">Title (optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto-generated from race name" className={inputCls} />
          </div>
          <button type="submit" disabled={!raceId || !url} className="cursor-pointer bg-gradient-to-b from-[#7ED321] to-[#5BA318] border border-[#8EE835] text-[#0D1117] font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded disabled:from-[#1F1F1F] disabled:to-[#191919] disabled:border-[#1F1F1F] disabled:text-[#777777] transition-all">
            Add Highlight
          </button>
        </div>
        {url && getYoutubeId(url) && (
          <div className="mt-2">
            <img src={`https://img.youtube.com/vi/${getYoutubeId(url)}/mqdefault.jpg`} alt="" className="h-20 rounded opacity-70" />
          </div>
        )}
      </form>

      <div className="space-y-2">
        {highlights.map(h => (
          <div key={h.id} className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getYoutubeId(h.youtube_url) && (
                <img src={`https://img.youtube.com/vi/${getYoutubeId(h.youtube_url)}/default.jpg`} alt="" className="h-10 rounded" />
              )}
              <div>
                <span className="font-medium text-[#E8ECF4]">{h.title}</span>
                {h.track_name && <span className="text-[#999999] text-sm ml-2">— {h.track_name}</span>}
              </div>
            </div>
            <button onClick={() => remove(h.id)} className="text-xs text-red-400 hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
