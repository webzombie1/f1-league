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
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#E8ECF4]">Teams</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {teams.map(team => (
          <Link
            key={team.id}
            to={`/teams/${team.id}`}
            className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-5 hover:border-[#383838] transition-colors"
          >
            <div
              className="h-1 w-12 rounded-full mb-3"
              style={{ backgroundColor: team.color || '#555' }}
            />
            <h3 className="font-semibold text-[#E8ECF4]">{team.name}</h3>
            <div className="mt-2 space-y-1">
              {(team.drivers || []).map(d => (
                <p key={d.id} className="text-sm text-[#999999]">
                  #{d.number || '?'} {d.name}
                </p>
              ))}
              {(!team.drivers || team.drivers.length === 0) && (
                <p className="text-sm text-[#777777] italic">No drivers assigned</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {teams.length === 0 && (
        <p className="text-center text-[#777777] text-sm py-8">No teams yet.</p>
      )}
    </div>
  )
}
