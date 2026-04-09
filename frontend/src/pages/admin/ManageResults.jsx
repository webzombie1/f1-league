import { useState, useEffect } from 'react'
import { get, put, del } from '../../api'

export default function ManageResults() {
  const [races, setRaces] = useState([])
  const [selectedRace, setSelectedRace] = useState(null)
  const [results, setResults] = useState([])

  useEffect(() => {
    get('/races').then(r => setRaces(r.filter(x => x.status === 'completed'))).catch(() => {})
  }, [])

  const loadResults = async (raceId) => {
    const race = await get(`/races/${raceId}`)
    setSelectedRace(race)
    setResults(race.results || [])
  }

  const updateResult = async (resultId, field, value) => {
    await put(`/admin/results/${resultId}`, { [field]: value })
    if (selectedRace) loadResults(selectedRace.id)
  }

  const clearResults = async (raceId) => {
    if (!confirm('Clear all results for this race? This cannot be undone.')) return
    await del(`/admin/races/${raceId}/results`)
    setSelectedRace(null)
    setResults([])
    get('/races').then(r => setRaces(r.filter(x => x.status === 'completed'))).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Results</h1>

      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <label className="block text-xs text-stone-400 uppercase tracking-wider mb-2">Select Race</label>
        <select
          value={selectedRace?.id || ''}
          onChange={e => e.target.value && loadResults(parseInt(e.target.value))}
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B5764B]"
        >
          <option value="">Choose a completed race...</option>
          {races.map(r => (
            <option key={r.id} value={r.id}>R{r.round_number}: {r.track_name}</option>
          ))}
        </select>
      </div>

      {selectedRace && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Round {selectedRace.round_number}: {selectedRace.track_name}
            </h2>
            <button
              onClick={() => clearResults(selectedRace.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Clear All Results
            </button>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-stone-400 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Pos</th>
                  <th className="text-left py-3 px-2">Driver</th>
                  <th className="text-center py-3 px-2">Status</th>
                  <th className="text-center py-3 px-2">Points</th>
                  <th className="text-center py-3 px-2">FL</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} className="border-b border-stone-50">
                    <td className="py-2 px-4">{r.position || '-'}</td>
                    <td className="py-2 px-2 font-medium">{r.driver_name || r.driver_name_raw}</td>
                    <td className="py-2 px-2 text-center">{r.status}</td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        value={r.points_awarded}
                        onChange={e => updateResult(r.id, 'points_awarded', parseInt(e.target.value) || 0)}
                        className="w-16 text-center bg-white border border-stone-200 rounded px-1 py-0.5 text-sm focus:outline-none focus:border-[#B5764B]"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!r.fastest_lap}
                        onChange={e => updateResult(r.id, 'fastest_lap', e.target.checked ? 1 : 0)}
                        className="accent-[#B5764B]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
