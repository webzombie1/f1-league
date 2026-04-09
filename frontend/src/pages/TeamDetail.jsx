import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api'
import StatBadge from '../components/StatBadge'

export default function TeamDetail() {
  const { teamId } = useParams()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/teams/${teamId}`)
      .then(setTeam)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [teamId])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-stone-400 text-sm">Loading...</p></div>
  }

  if (!team || team.detail) {
    return <p className="text-center text-stone-400 py-8">Team not found.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teams" className="text-sm text-[#B5764B] hover:underline">← Teams</Link>
        <div className="flex items-center gap-3 mt-2">
          <div
            className="w-2 h-8 rounded-full"
            style={{ backgroundColor: team.color || '#ccc' }}
          />
          <h1 className="text-2xl font-bold text-stone-800">{team.name}</h1>
        </div>
      </div>

      <div className="flex gap-8">
        <StatBadge label="Points" value={team.points} />
        <StatBadge label="Wins" value={team.wins} />
        <StatBadge label="Podiums" value={team.podiums} />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <h2 className="text-xs text-stone-400 uppercase tracking-wider mb-4">Drivers</h2>
        <div className="space-y-3">
          {(team.drivers || []).map(d => (
            <Link
              key={d.id}
              to={`/driver/${d.id}`}
              className="flex items-center gap-3 hover:bg-stone-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <span className="text-sm font-mono text-stone-400 w-8">#{d.number || '?'}</span>
              <span className="font-medium text-stone-800">{d.name}</span>
              <span className="text-xs text-stone-400">{d.abbreviation}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
