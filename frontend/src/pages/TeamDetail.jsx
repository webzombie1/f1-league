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
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  if (!team || team.detail) {
    return <p className="text-center text-[#777777] py-8">Team not found.</p>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link to="/teams" className="text-sm text-[#7ED321] hover:underline">← Teams</Link>
        <div className="flex items-center gap-3 mt-2">
          <div
            className="w-2 h-8 rounded-full"
            style={{ backgroundColor: team.color || '#555' }}
          />
          <h1 className="text-2xl font-bold text-[#E8ECF4]">{team.name}</h1>
        </div>
      </div>

      <div className="flex gap-8">
        <StatBadge label="Points" value={team.points} />
        <StatBadge label="Wins" value={team.wins} />
        <StatBadge label="Podiums" value={team.podiums} />
      </div>

      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-5">
        <h2 className="text-xs text-[#999999] uppercase tracking-wider mb-4">Drivers</h2>
        <div className="space-y-3">
          {(team.drivers || []).map(d => (
            <Link
              key={d.id}
              to={`/driver/${d.id}`}
              className="flex items-center gap-3 hover:bg-[#1F1F1F] -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <span className="text-sm font-mono text-[#999999] w-8">#{d.number || '?'}</span>
              <span className="font-medium text-[#E8ECF4]">{d.name}</span>
              <span className="text-xs text-[#777777]">{d.abbreviation}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
