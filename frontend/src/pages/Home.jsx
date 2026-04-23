import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

const DEFAULT_HERO = '/hero-australia.jpeg'

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function StandingsSection({ topDrivers, tab, setTab }) {
  const constructors = Object.values(
    topDrivers.reduce((acc, d) => {
      const key = d.team_name || 'Unknown'
      if (!acc[key]) acc[key] = { name: key, color: d.team_color, logo: d.team_logo, points: 0 }
      acc[key].points += d.points
      return acc
    }, {})
  ).sort((a, b) => b.points - a.points)

  return (
    <div>
      {tab === 'drivers' ? (
        <div className="space-y-0">
          {topDrivers.slice(3).map((d, i) => (
            <Link
              key={d.id}
              to={`/driver/${d.id}`}
              className="flex items-center py-3.5 border-b border-[#1F1F1F]/40 hover:bg-[#191919]/50 transition-colors -mx-1 px-1 rounded"
            >
              <span className="text-sm font-bold text-[#777777] w-10 text-center">{i + 4}</span>
              <div className="w-1 h-6 rounded-full mx-3" style={{ backgroundColor: d.team_color || '#555' }} />
              <div className="flex-1">
                <span className="font-semibold text-[#E8ECF4]">{d.name}</span>
                <span className="text-[#777777] text-xs ml-2">{d.team_name}</span>
              </div>
              <span className="font-bold text-[#E8ECF4] text-sm">{d.points}</span>
            </Link>
          ))}
          {topDrivers.length <= 3 && (
            <p className="text-[#777777] text-sm py-4">No additional drivers.</p>
          )}
          <div className="pt-4">
            <Link to="/standings" className="text-xs text-[#7ED321] hover:underline uppercase tracking-wider">
              Full Standings →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {constructors.map((t, i) => (
            <div
              key={t.name}
              className="flex items-center py-3.5 border-b border-[#1F1F1F]/40 -mx-1 px-1"
            >
              <span className="text-sm font-bold text-[#777777] w-10 text-center">{i + 1}</span>
              <div className="w-7 h-7 rounded-full mx-3 shrink-0 flex items-center justify-center" style={{ backgroundColor: t.color || '#555' }}>
                {t.logo ? <img src={t.logo} alt="" className="w-4 h-4 object-contain" /> : null}
              </div>
              <span className="font-semibold text-[#E8ECF4] flex-1">{t.name}</span>
              <span className="font-bold text-[#E8ECF4] text-sm">{t.points}</span>
            </div>
          ))}
          {constructors.length === 0 && (
            <p className="text-[#777777] text-sm py-4">No standings yet.</p>
          )}
          <div className="pt-4">
            <Link to="/standings/constructors" className="text-xs text-[#7ED321] hover:underline uppercase tracking-wider">
              Full Standings →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [season, setSeason] = useState(null)
  const [races, setRaces] = useState([])
  const [topDrivers, setTopDrivers] = useState([])
  const [lastRaceData, setLastRaceData] = useState(null)
  const [latestArticle, setLatestArticle] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [playingVideo, setPlayingVideo] = useState(null)
  const [standingsTab, setStandingsTab] = useState('drivers')
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  const scroll = (direction) => {
    if (!scrollRef.current) return
    const amount = 360
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  useEffect(() => {
    Promise.all([
      get('/seasons/active'),
      get('/races'),
      get('/standings/drivers'),
      get('/articles'),
    ]).then(async ([s, r, d, articles]) => {
      setSeason(s)
      setRaces(r)
      setTopDrivers(d.slice(0, 10))

      // Latest article
      if (articles.length > 0) {
        setLatestArticle(articles[0])
      }

      // Fetch full results and highlights for the last completed race
      const lastCompleted = [...r].reverse().find(x => x.status === 'completed')
      if (lastCompleted) {
        try {
          const raceDetail = await get(`/races/${lastCompleted.id}`)
          setLastRaceData(raceDetail)
          const hl = await get(`/highlights?race_id=${lastCompleted.id}`)
          setHighlights(hl)
        } catch {}
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  const nextRace = races.find(r => r.status === 'upcoming')
  const lastRace = lastRaceData || [...races].reverse().find(r => r.status === 'completed')
  // Use featured article data for hero if race doesn't have its own
  const heroHeadline = lastRace?.hero_headline || latestArticle?.headline || ''
  const heroSubtitle = lastRace?.hero_subtitle || latestArticle?.subtitle || ''
  const heroImage = lastRace?.hero_image || latestArticle?.hero_image || nextRace?.hero_image || DEFAULT_HERO
  const heroRace = lastRace || nextRace
  const results = lastRaceData?.results || []

  return (
    <div>
      {/* ── Hero Section ── */}
      <div className="relative w-full h-[420px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/80 to-transparent" />

        <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col justify-end pb-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#7ED321] mb-0">
            {lastRace ? `Round ${lastRace.round_number} · ${lastRace.country}` : 'Up Next'}
          </p>
          {lastRace && heroHeadline ? (
            <>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight max-w-3xl">
                {heroHeadline}
              </h1>
              {heroSubtitle && (
                <p className="text-lg text-[#999999] mt-3 max-w-2xl leading-relaxed">
                  {heroSubtitle}
                </p>
              )}
              <Link
                to={latestArticle ? `/article/${latestArticle.id}` : `/race/${lastRace.id}`}
                className="inline-flex items-center mt-5 bg-[#7ED321] hover:bg-[#6BC11A] text-[#0D1117] font-black uppercase text-sm tracking-wider px-8 py-4 rounded-lg transition-colors w-fit shadow-lg shadow-[#7ED321]/20"
              >
                {latestArticle ? 'Full Story' : 'Full Results'}
              </Link>
            </>
          ) : heroRace ? (
            <>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight">
                {heroRace.track_name}
              </h1>
              <p className="text-lg text-[#999999] mt-3">
                Round {heroRace.round_number} · {heroRace.country}
                {heroRace.date ? ` · ${heroRace.date}` : ''}
              </p>
              {lastRace && (
                <Link
                  to={`/race/${lastRace.id}`}
                  className="inline-flex items-center mt-5 bg-[#7ED321] hover:bg-[#6BC11A] text-[#0D1117] font-bold uppercase text-sm tracking-wider px-6 py-3 rounded transition-colors w-fit"
                >
                  View Results
                </Link>
              )}
            </>
          ) : (
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
              {season?.name || 'GDR League'}
            </h1>
          )}
        </div>
      </div>

      {/* ── Race Results Scroll Bar ── */}
      {results.length > 0 && (
        <div className="bg-[#131313] border-y border-[#1F1F1F]">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#999999]">Race Results</h2>
              <span className="text-xs text-[#777777]">—</span>
              <span className="text-xs text-[#777777]">{lastRace?.track_name}</span>
            </div>
            <div className="relative flex items-center">
              {/* Left arrow */}
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#191919] border border-[#1F1F1F] text-[#999999] hover:text-[#E8ECF4] hover:bg-[#1F1F1F] transition-colors -ml-4 shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Scrollable area */}
              <div ref={scrollRef} className="overflow-x-auto scrollbar-hide mx-6" style={{ scrollbarWidth: 'none' }}>
                <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
                {results.map((r) => {
                  const pos = r.status === 'finished' ? r.position : null
                  const isTop3 = pos && pos <= 3
                  const isDNF = r.status !== 'finished'

                  return (
                    <div
                      key={r.id}
                      className="flex-shrink-0 w-[170px] rounded-xl bg-[#191919] border border-[#1F1F1F] overflow-hidden hover:bg-[#1F1F1F] transition-colors shadow-md shadow-black/20"
                    >
                      {/* Position overlapping the team color bar + car image */}
                      <div className="relative h-7 overflow-hidden">
                        {/* Team color diagonal bar */}
                        <div className="absolute inset-0 overflow-hidden">
                          <div
                            className="w-[120%] h-full origin-top-left -skew-x-12 -ml-2"
                            style={{ backgroundColor: r.team_color || '#555' }}
                          />
                        </div>
                        {/* Car image faded in from the right */}
                        {r.team_car_image && (
                          <div className="absolute inset-0 flex items-center justify-end">
                            <img
                              src={r.team_car_image}
                              alt=""
                              className="h-5 object-contain mr-1 drop-shadow-lg -translate-x-[20px] -scale-x-100"
                              style={{
                                maskImage: 'linear-gradient(to right, transparent 0%, black 30%)',
                                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 30%)',
                              }}
                            />
                          </div>
                        )}
                        {/* Position text on top */}
                        <span className="absolute top-1 left-2 text-sm font-black text-white drop-shadow-md">
                          {isDNF ? r.status?.toUpperCase() : `P${pos}`}
                        </span>
                        {/* Team logo top right */}
                        {r.team_logo && (
                          <img src={r.team_logo} alt="" className="absolute top-1 right-1.5 w-5 h-5 object-contain drop-shadow-md" />
                        )}
                        {r.fastest_lap ? (
                          <span className="absolute bottom-1 right-2 text-[9px] font-bold text-purple-300 drop-shadow-md">FL</span>
                        ) : null}
                      </div>

                      {/* Content below */}
                      <div className="p-2 pt-1.5 flex items-center gap-2">
                        {/* Driver photo placeholder */}
                        <div className="w-12 h-12 rounded bg-[#1F1F1F] shrink-0 flex items-center justify-center">
                          <svg className="w-7 h-7 text-[#777777]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>

                        {/* Name + points */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#E8ECF4] truncate">
                            {r.driver_name || r.driver_name_raw || 'Unknown'}
                          </p>
                          {r.points_awarded > 0 && (
                            <p className="text-xs font-bold text-[#7ED321] mt-0.5">
                              +{r.points_awarded} <span className="text-[10px] font-normal text-[#777777]">pts</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>

              {/* Right arrow */}
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#191919] border border-[#1F1F1F] text-[#999999] hover:text-[#E8ECF4] hover:bg-[#1F1F1F] transition-colors -mr-4 shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Video Highlights + Next Race ── */}
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Highlights */}
          <div className="lg:col-span-2 bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-lg shadow-black/30">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F1F]">
              <h2 className="text-base font-bold uppercase tracking-wider text-[#E8ECF4]">Latest Highlights</h2>
            </div>
            {highlights.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 p-4">
                {highlights.slice(0, 2).map((video) => {
                  const ytId = getYoutubeId(video.youtube_url)
                  return (
                    <button
                      key={video.id}
                      onClick={() => setPlayingVideo(video)}
                      className="group block rounded-lg overflow-hidden bg-[#0D1117] border border-[#1F1F1F] hover:border-[#7ED321]/40 transition-colors text-left cursor-pointer"
                    >
                      <div className="relative aspect-video bg-[#191919] overflow-hidden">
                        {ytId && (
                          <img
                            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-[#7ED321]/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4 text-[#0D1117] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <p className="px-3 py-2 text-xs font-medium text-[#E8ECF4] truncate">
                        {video.title}
                      </p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-[#777777] text-sm">No highlights yet.</p>
              </div>
            )}
            {highlights.length > 2 && (
              <div className="px-5 pb-4">
                <button onClick={() => setPlayingVideo(highlights[2])} className="text-xs text-[#7ED321] hover:underline uppercase tracking-wider cursor-pointer">
                  More Highlights →
                </button>
              </div>
            )}
          </div>

          {/* Next Race card */}
          <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/30">
            {/* Track image */}
            {nextRace?.track_image && (
              <div className="w-full h-36 overflow-hidden">
                <img
                  src={nextRace.track_image}
                  alt={nextRace.track_name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-6 flex-1 flex flex-col">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#999999] mb-3">Next Race</h2>
              {nextRace ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xl font-black text-[#E8ECF4] uppercase">{nextRace.track_name}</p>
                    <p className="text-sm text-[#999999] mt-1">
                      Round {nextRace.round_number} · {nextRace.country}
                    </p>
                    {nextRace.date && (
                      <p className="text-sm text-[#999999] mt-1">
                        {new Date(nextRace.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                        {nextRace.time ? ` · ${(() => { const [h,m] = nextRace.time.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}` })()}` : ''}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/schedule"
                    className="mt-4 text-xs text-[#7ED321] hover:underline uppercase tracking-wider"
                  >
                    Full Schedule →
                  </Link>
                </div>
              ) : (
                <p className="text-[#777777] text-sm italic">Season complete.</p>
              )}
            </div>
          </div>
        </div>

        {/* Season separator */}
        <div className="mt-4">
          <div className="relative h-4 overflow-hidden mb-6">
            <div className="absolute top-0 left-0 right-8 h-[3px] bg-[#7ED321]" />
            <div className="absolute top-[6px] left-12 right-0 h-[2px] bg-[#7ED321]/60" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-[#E8ECF4] uppercase italic tracking-tight">
            {season?.year || '2026'} Season
          </h2>
        </div>

        {/* Drivers / Teams tab switcher */}
        <div className="flex gap-6 border-b border-[#1F1F1F]">
          <button
            onClick={() => setStandingsTab('drivers')}
            className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              standingsTab === 'drivers'
                ? 'text-[#E8ECF4] border-b-2 border-[#7ED321]'
                : 'text-[#777777] hover:text-[#999999]'
            }`}
          >
            Drivers
          </button>
          <button
            onClick={() => setStandingsTab('teams')}
            className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              standingsTab === 'teams'
                ? 'text-[#E8ECF4] border-b-2 border-[#7ED321]'
                : 'text-[#777777] hover:text-[#999999]'
            }`}
          >
            Teams
          </button>
        </div>

        {/* Podium Cards — Top 3 */}
        {topDrivers.length >= 3 && standingsTab === 'drivers' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[topDrivers[0], topDrivers[1], topDrivers[2]].map((d, i) => {
              const pos = i + 1
              const suffix = pos === 1 ? 'ST' : pos === 2 ? 'ND' : 'RD'
              const isCenter = pos === 1
              return (
                <Link
                  key={d.id}
                  to={`/driver/${d.id}`}
                  className="relative rounded-xl overflow-hidden p-6 flex flex-col justify-between hover:brightness-110 transition shadow-lg shadow-black/30"
                  style={{ backgroundColor: d.team_color || '#333', minHeight: '240px' }}
                >
                  {/* Halftone/dot pattern overlay */}
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
                    backgroundSize: '6px 6px',
                  }} />

                  {/* Team logo — top right */}
                  {d.team_logo && (
                    <img src={d.team_logo} alt="" className="absolute top-4 right-4 w-10 h-10 object-contain opacity-70" />
                  )}

                  {/* Content */}
                  <div className="relative">
                    <p className="text-white/70 font-black">
                      <span className="text-2xl">{pos}</span><sup className="text-xs">{suffix}</sup>
                    </p>
                    <h3 className="uppercase leading-tight mt-1">
                      {d.name.includes(' ') ? (
                        <>
                          <span className="text-white/70 text-sm font-medium block leading-none">{d.name.split(' ').slice(0, -1).join(' ')}</span>
                          <span className="font-black text-white text-2xl leading-none">{d.name.split(' ').slice(-1)[0]}</span>
                        </>
                      ) : (
                        <span className="font-black text-white text-2xl">{d.name}</span>
                      )}
                    </h3>
                    <p className="text-white/60 text-sm italic mt-0.5">{d.team_name}</p>
                  </div>

                  {/* Points */}
                  <div className="relative mt-4">
                    <span className="font-black text-white text-3xl">{d.points}</span>
                    <span className="text-white/60 text-sm ml-1 uppercase">pts</span>
                  </div>

                  {/* Driver photo — bottom right */}
                  <div className="absolute -bottom-1 right-[25px] w-44 h-[110%] overflow-hidden">
                    {(d.photo_standing || d.photo_url) ? (
                      <img
                        src={d.photo_standing || d.photo_url}
                        alt={d.name}
                        className="w-full h-full object-cover drop-shadow-2xl"
                        style={{ objectPosition: 'center 0%' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-end justify-center opacity-15">
                        <svg className="w-16 h-20 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Drivers / Teams tab switcher + standings list */}
        <StandingsSection topDrivers={topDrivers} tab={standingsTab} setTab={setStandingsTab} />
      </div>

      {/* Video player modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setPlayingVideo(null)}>
          <div className="w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-[#E8ECF4] truncate">{playingVideo.title}</h3>
              <button onClick={() => setPlayingVideo(null)} className="text-[#999999] hover:text-white text-2xl leading-none cursor-pointer">×</button>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${getYoutubeId(playingVideo.youtube_url)}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
