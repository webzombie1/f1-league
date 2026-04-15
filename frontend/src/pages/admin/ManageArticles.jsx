import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'

export default function ManageArticles() {
  const [articles, setArticles] = useState([])
  const [races, setRaces] = useState([])
  const [seasonId, setSeasonId] = useState(null)

  // Form state
  const [raceId, setRaceId] = useState('')
  const [headline, setHeadline] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [body, setBody] = useState('')
  const [heroImage, setHeroImage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) {
        setSeasonId(s.id)
        get('/races').then(r => setRaces(r.filter(x => x.status === 'completed')))
      }
    }).catch(() => {})
    loadArticles()
  }, [])

  const loadArticles = () => {
    get('/admin/articles').then(setArticles).catch(() => {})
  }

  const generate = async () => {
    if (!raceId) return
    setGenerating(true)
    try {
      const result = await post('/admin/articles/generate', { race_id: parseInt(raceId) })
      if (result.error) {
        alert(result.error)
      } else {
        setHeadline(result.headline || '')
        setSubtitle(result.subtitle || '')
        setBody(result.body || '')
        // Pre-fill hero image from race
        const race = races.find(r => r.id === parseInt(raceId))
        if (race?.hero_image) setHeroImage(race.hero_image)
      }
    } catch (e) {
      alert('Generation failed: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!headline.trim() || !seasonId) return

    if (editing) {
      await put(`/admin/articles/${editing}`, { headline, subtitle, body, hero_image: heroImage, race_id: raceId ? parseInt(raceId) : null })
    } else {
      await post('/admin/articles', {
        season_id: seasonId,
        race_id: raceId ? parseInt(raceId) : null,
        headline,
        subtitle,
        body,
        hero_image: heroImage,
      })
    }
    clearForm()
    loadArticles()
  }

  const edit = (a) => {
    setEditing(a.id)
    setRaceId(a.race_id || '')
    setHeadline(a.headline)
    setSubtitle(a.subtitle || '')
    setBody(a.body || '')
    setHeroImage(a.hero_image || '')
  }

  const remove = async (id) => {
    if (!confirm('Delete this article?')) return
    await del(`/admin/articles/${id}`)
    loadArticles()
  }

  const clearForm = () => {
    setEditing(null)
    setRaceId('')
    setHeadline('')
    setSubtitle('')
    setBody('')
    setHeroImage('')
  }

  const inputCls = "w-full bg-[#141A2E] border border-[#2A3458] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#555F78] focus:outline-none focus:border-[#7ED321]"

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Articles</h1>

      <form onSubmit={save} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-5 space-y-3">
        {/* Race selector + Generate button */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Race</label>
            <select value={raceId} onChange={e => setRaceId(e.target.value)} className={inputCls}>
              <option value="">Select a race...</option>
              {races.map(r => <option key={r.id} value={r.id}>R{r.round_number}: {r.track_name}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={!raceId || generating}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-[#2A3458] disabled:text-[#555F78] text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            {generating ? (
              <>
                <span className="animate-spin">⚡</span> Generating...
              </>
            ) : (
              <>⚡ Generate Article</>
            )}
          </button>
        </div>

        <div>
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Headline</label>
          <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Hoecker Takes P1 in Australia" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Subtitle</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="A one-line summary of the drama..." className={inputCls} />
        </div>

        <div>
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Hero Image URL</label>
          <input value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="/hero-australia.jpeg" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs text-[#8892A8] uppercase tracking-wider mb-1">Article Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={12}
            placeholder="The full article text..."
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="bg-[#7ED321] hover:bg-[#6BC11A] text-[#141A2E] font-semibold px-4 py-2 rounded-lg text-sm">
            {editing ? 'Update Article' : 'Publish Article'}
          </button>
          {editing && (
            <button type="button" onClick={clearForm} className="text-sm text-[#8892A8] hover:text-[#E8ECF4]">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Article list */}
      <div className="space-y-2">
        {articles.map(a => (
          <div key={a.id} className="bg-[#1E2642] border border-[#2A3458] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="font-medium text-[#E8ECF4]">{a.headline}</span>
              {a.track_name && <span className="text-[#8892A8] text-sm ml-2">— {a.track_name}</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => edit(a)} className="text-xs text-[#7ED321] hover:underline">Edit</button>
              <button onClick={() => remove(a.id)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
