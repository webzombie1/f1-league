import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import PlatformIcon from '../components/PlatformIcon'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [standings, setStandings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get('/teams'),
      get('/standings/constructors'),
    ]).then(([t, s]) => {
      setTeams(t)
      const map = {}
      s.forEach(c => { map[c.id] = c.points })
      setStandings(map)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const sortedTeams = [...teams].sort((a, b) => (standings[b.id] || 0) - (standings[a.id] || 0))

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-[#E8ECF4]">Teams</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedTeams.map(team => (
          <Link
            key={team.id}
            to={`/teams/${team.id}`}
            className="block rounded-xl overflow-hidden shadow-lg shadow-black/30 hover:brightness-110 transition"
            style={{ backgroundColor: team.color || '#191919' }}
          >
            {/* Team header */}
            <div className="relative px-4 py-1.5 overflow-hidden">
              {/* Diagonal stripe pattern */}
              <div className="absolute inset-0" style={{
                background: `repeating-linear-gradient(
                  -70deg,
                  transparent,
                  transparent 40px,
                  rgba(255,255,255,0.04) 40px,
                  rgba(255,255,255,0.04) 80px
                )`
              }} />
              <div className="absolute inset-0" style={{
                background: `repeating-linear-gradient(
                  -70deg,
                  transparent,
                  transparent 120px,
                  rgba(255,255,255,0.025) 120px,
                  rgba(255,255,255,0.025) 200px
                )`
              }} />

              {/* Team logo */}
              <div className="absolute top-1.5 right-3 flex items-center gap-2 z-10">
                <span className="text-white font-black text-sm">{standings[team.id] || 0} <span className="text-white/50 text-xs font-normal">pts</span></span>
                {team.logo_url && (
                  <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                    <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />
                  </div>
                )}
              </div>

              <div className="relative flex items-center gap-3">
                <h2 className="text-lg font-black text-white uppercase relative z-10 px-2 py-0.5 rounded" style={{ backgroundColor: team.color || '#191919' }}>{team.name}</h2>
                {team.car_image && (
                  <div className="absolute right-[45%] top-1 -bottom-4 flex items-end">
                    <img src={team.car_image} alt="" className="h-12 object-contain opacity-50" />
                  </div>
                )}
              </div>
            </div>

            {/* Drivers */}
            <div className="relative grid grid-cols-2 gap-px bg-black/20">
              {(team.drivers || []).filter(d => d.platform !== 'ai').map(d => (
                <div key={d.id} className="relative p-4 flex items-end gap-3 min-h-[140px] overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  {/* Abstract glowing curved lines surrounding driver */}
                  <svg className="absolute -inset-[14%] w-[75%] h-[112%] pointer-events-none translate-x-[20%]" viewBox="0 0 200 200" preserveAspectRatio="none" fill="none">
                    {/* Curves around driver (bottom-right area) */}
                    <path d="M 185,55 C 135,75 115,120 125,165 C 130,185 150,195 175,198" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="1.5" opacity="0.4" filter="url(#glow)" />
                    <path d="M 195,80 C 155,90 135,130 142,170 C 146,186 160,196 185,200" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="1" opacity="0.3" filter="url(#glow)" />
                    <path d="M 170,45 C 110,70 95,125 110,170 C 118,190 140,198 168,200" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="2" opacity="0.2" filter="url(#glow)" />
                    {/* Inner accents */}
                    <path d="M 175,65 C 130,85 118,130 128,168 C 132,182 148,194 170,198" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="0.8" opacity="0.5" filter="url(#glow)" />
                    <path d="M 195,90 C 160,98 142,138 148,172 C 152,186 165,196 185,199" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="0.6" opacity="0.35" filter="url(#glow)" />
                    {/* Subtle cross */}
                    <path d="M 130,200 C 140,155 155,120 190,85" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="0.5" opacity="0.2" filter="url(#glow)" />
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                  </svg>
                  {/* Second layer — flipped, smaller, bottom-right */}
                  <svg className="absolute bottom-0 -right-[20%] w-[66%] h-[66%] pointer-events-none translate-x-[60px]" viewBox="0 0 200 200" preserveAspectRatio="none" fill="none" style={{ transform: 'scaleX(-1)' }}>
                    <path d="M 185,55 C 135,75 115,120 125,165 C 130,185 150,195 175,198" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="1.5" opacity="0.3" filter="url(#glow2)" />
                    <path d="M 195,80 C 155,90 135,130 142,170 C 146,186 160,196 185,200" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="1" opacity="0.2" filter="url(#glow2)" />
                    <path d="M 170,45 C 110,70 95,125 110,170 C 118,190 140,198 168,200" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="2" opacity="0.15" filter="url(#glow2)" />
                    <path d="M 175,65 C 130,85 118,130 128,168 C 132,182 148,194 170,198" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="0.8" opacity="0.35" filter="url(#glow2)" />
                    <path d="M 195,90 C 160,98 142,138 148,172 C 152,186 165,196 185,199" stroke={team.color} vectorEffect="non-scaling-stroke" strokeWidth="0.6" opacity="0.25" filter="url(#glow2)" />
                    <defs>
                      <filter id="glow2">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                  </svg>
                  {/* Driver standing photo */}
                  {(d.photo_standing || d.photo_url) ? (
                    <div className="absolute -bottom-[56px] -right-[7px] w-[60%] h-[240%] overflow-hidden">
                      <img
                        src={d.photo_standing || d.photo_url}
                        alt={d.name}
                        className="w-full h-full object-contain object-bottom"
                        style={{
                          filter: `drop-shadow(0 0 15px ${team.color}) drop-shadow(0 0 30px ${team.color}80) drop-shadow(0 0 60px ${team.color}40)`,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="absolute bottom-2 right-4 opacity-10">
                      <svg className="w-20 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                    </div>
                  )}

                  {/* Driver info */}
                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformIcon platform={d.platform} className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/50 text-xs font-mono">#{d.number || '?'}</span>
                    </div>
                    <p className="text-white/60 text-xs leading-none">{d.name.includes(' ') ? d.name.split(' ').slice(0, -1).join(' ') : ''}</p>
                    <p className="text-white font-black text-lg uppercase leading-tight">
                      {d.name.includes(' ') ? d.name.split(' ').slice(-1)[0] : d.name}
                    </p>
                  </div>
                </div>
              ))}
              {(team.drivers || []).filter(d => d.platform !== 'ai').length === 0 && (
                <div className="col-span-2 p-4 text-center" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  <p className="text-white/40 text-sm italic">No human drivers assigned</p>
                </div>
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
