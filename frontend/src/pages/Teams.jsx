import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/teams')
      .then(setTeams)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-stone-400 text-sm">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Teams</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {teams.map(team => (
          <Link
            key={team.id}
            to={`/teams/${team.id}`}
            className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
          >
            <div
              className="h-1 w-12 rounded-full mb-3"
              style={{ backgroundColor: team.color || '#ccc' }}
            />
            <h3 className="font-semibold text-stone-800">{team.name}</h3>
            <div className="mt-2 space-y-1">
              {(team.drivers || []).map(d => (
                <p key={d.id} className="text-sm text-stone-500">
                  #{d.number || '?'} {d.name}
                </p>
              ))}
              {(!team.drivers || team.drivers.length === 0) && (
                <p className="text-sm text-stone-400 italic">No drivers assigned</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {teams.length === 0 && (
        <p className="text-center text-stone-400 text-sm py-8">No teams yet.</p>
      )}
    </div>
  )
}
