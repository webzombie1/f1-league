import { useState, useEffect } from 'react'
import { get, put } from '../../api'

const DEFAULT_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0] // 0 = fastest lap bonus

export default function ManagePoints() {
  const [seasonId, setSeasonId] = useState(null)
  const [points, setPoints] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    get('/seasons/active').then(s => {
      if (s.id) {
        setSeasonId(s.id)
        get(`/admin/points-config?season_id=${s.id}`).then(rows => {
          const map = {}
          rows.forEach(r => { map[r.position] = r.points })
          setPoints(map)
        })
      }
    }).catch(() => {})
  }, [])

  const save = async () => {
    if (!seasonId) return
    await put('/admin/points-config', { season_id: seasonId, points })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = (pos, val) => {
    setPoints(prev => ({ ...prev, [pos]: parseInt(val) || 0 }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Points Configuration</h1>

      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {DEFAULT_POSITIONS.map(pos => (
            <div key={pos}>
              <label className="block text-xs text-stone-400 uppercase tracking-wider mb-1">
                {pos === 0 ? 'Fastest Lap' : `P${pos}`}
              </label>
              <input
                type="number"
                value={points[pos] ?? ''}
                onChange={e => update(pos, e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={save}
            className="bg-[#B5764B] hover:bg-[#A36840] text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Save Points
          </button>
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
        </div>
      </div>
    </div>
  )
}
