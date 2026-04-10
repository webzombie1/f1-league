import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

export default function Schedule() {
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/races')
      .then(setRaces)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#8892A8] text-sm">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#E8ECF4]">Season Schedule</h1>

      <div className="space-y-3">
        {races.map(race => (
          <div
            key={race.id}
            className={`bg-[#1E2642] border rounded-xl p-5 transition-colors ${
              race.status === 'completed' ? 'border-[#2A3458]' : 'border-[#7ED321]/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-[#8892A8] w-12">R{race.round_number}</span>
                <div>
                  <p className="font-medium text-[#E8ECF4]">{race.track_name}</p>
                  <p className="text-sm text-[#8892A8] mt-0.5">
                    {race.country}
                    {race.date ? ` — ${race.date}` : ''}
                    {race.time ? ` at ${race.time}` : ''}
                  </p>
                </div>
              </div>
              <div>
                {race.status === 'completed' ? (
                  <Link
                    to={`/race/${race.id}`}
                    className="text-sm text-[#7ED321] hover:underline"
                  >
                    Results →
                  </Link>
                ) : race.status === 'cancelled' ? (
                  <span className="text-sm text-[#555F78]">Cancelled</span>
                ) : (
                  <span className="text-xs bg-[#7ED321]/15 text-[#7ED321] px-2 py-1 rounded-md font-medium">
                    Upcoming
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {races.length === 0 && (
          <p className="text-center text-[#555F78] text-sm py-8">No races scheduled yet.</p>
        )}
      </div>
    </div>
  )
}
