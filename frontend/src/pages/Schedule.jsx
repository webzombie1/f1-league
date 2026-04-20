import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hr = parseInt(h)
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

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
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#E8ECF4]">Season Schedule</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map(race => (
          <div
            key={race.id}
            className={`rounded-xl overflow-hidden transition-colors flex flex-col ${
              race.status === 'completed'
                ? 'bg-[#7ED321] border border-[#8EE835]'
                : 'bg-[#141A2E] border border-[#7ED321]/30 hover:border-[#3A4468]'
            }`}
          >
            {/* Track image */}
            {race.track_image ? (
              <div className="w-full h-36 overflow-hidden relative">
                <img
                  src={race.track_image}
                  alt={race.track_name}
                  className="w-full h-full object-cover"
                />
                {race.status === 'completed' && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-[#0D1117]/60 text-white px-2 py-0.5 rounded font-medium backdrop-blur-sm">
                      ✓ Completed
                    </span>
                  </div>
                )}
                {race.status === 'upcoming' && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-[#7ED321]/20 text-[#7ED321] px-2 py-0.5 rounded font-medium backdrop-blur-sm">
                      Upcoming
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-36 bg-[#1E2642] flex items-center justify-center">
                <span className="text-[#555F78] text-xs uppercase tracking-wider">Round {race.round_number}</span>
              </div>
            )}

            {/* Race info */}
            <div className="p-4 flex gap-3 flex-1">
              <div className="text-center shrink-0 w-12">
                <span className={`text-[8px] uppercase tracking-wider block leading-none mb-1 ${race.status === 'completed' ? 'text-[#0D1117]/60' : 'text-[#8892A8]'}`}>Round</span>
                <span className={`text-xl font-black leading-none ${race.status === 'completed' ? 'text-[#0D1117]' : 'text-[#7ED321]'}`}>{race.round_number}</span>
              </div>
              <div className="-mt-0.5 flex-1">
                <h3 className={`font-bold uppercase text-sm leading-tight ${race.status === 'completed' ? 'text-[#0D1117]' : 'text-[#E8ECF4]'}`}>
                  {race.track_name}
                </h3>
                <p className={`text-xs mt-0.5 ${race.status === 'completed' ? 'text-[#0D1117]/70' : 'text-[#8892A8]'}`}>
                  {race.country}
                </p>
                {race.status !== 'completed' && race.date && (
                  <p className="text-xs text-[#8892A8] mt-1">
                    {formatDate(race.date)}
                    {race.time ? ` · ${formatTime(race.time)}` : ''}
                  </p>
                )}
              </div>
            </div>
            {race.status === 'completed' && (
              <div className="px-4 pb-3">
                <Link
                  to={`/race/${race.id}`}
                  className="text-xs text-[#0D1117] hover:underline uppercase tracking-wider font-bold"
                >
                  Full Results →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
      {races.length === 0 && (
        <p className="text-center text-[#555F78] text-sm py-8">No races scheduled yet.</p>
      )}
    </div>
  )
}
