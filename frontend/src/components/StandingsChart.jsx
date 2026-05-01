import { useState, useRef } from 'react'

/**
 * Cumulative-points line chart for driver or constructor standings.
 *
 * Props:
 *   - races:  [{ id, round_number, track_name, country }]
 *   - items:  [{ id, name, photo_url?, team_logo?, team_color, team_name?,
 *               points_per_round: number[] }]
 *   - mode:   'drivers' | 'constructors'
 *
 * Two same-coloured driver lines are differentiated with stroke-dasharray on
 * the second one so teammates don't completely overlap visually.
 */
export default function StandingsChart({ races = [], items = [], mode = 'drivers' }) {
  const [hover, setHover] = useState(null) // { id, raceIndex }
  const svgRef = useRef(null)

  if (!races.length || !items.length) {
    return (
      <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-8 text-center">
        <p className="text-[#777777] text-sm">
          No completed races yet — points trend will appear here once a race is run.
        </p>
      </div>
    )
  }

  // Tag every-other driver per team as the "second seat" so we can dash them.
  const teamSeen = new Map()
  const lines = items.map(it => {
    const key = it.team_color || it.team_name || it.id
    const seat = teamSeen.get(key) || 0
    teamSeen.set(key, seat + 1)
    return { ...it, _seat: seat }
  })

  const maxPoints = Math.max(1, ...lines.flatMap(l => l.points_per_round))
  const niceMax = ((m) => {
    const ticks = [5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]
    for (const t of ticks) if (t >= m) return t
    return Math.ceil(m / 100) * 100
  })(maxPoints)

  const W = 800
  const H = 360
  const PAD_L = 40
  const PAD_R = 16
  const PAD_T = 16
  const PAD_B = 80 // extra room for rotated race-name labels
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const xFor = (i) =>
    races.length === 1
      ? PAD_L + innerW / 2
      : PAD_L + (innerW * i) / (races.length - 1)
  const yFor = (p) => PAD_T + innerH - (innerH * p) / niceMax

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(niceMax * t))

  // Convert a client mouse event into the SVG's user coordinate space.
  const localPoint = (e) => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  const handleLineMove = (e, line) => {
    const local = localPoint(e)
    if (!local) return
    let nearest = 0
    let minDist = Infinity
    for (let i = 0; i < line.points_per_round.length; i++) {
      const dx = Math.abs(local.x - xFor(i))
      if (dx < minDist) { minDist = dx; nearest = i }
    }
    setHover({ id: line.id, raceIndex: nearest })
  }

  const hoverLine = hover && lines.find(l => l.id === hover.id)
  const hoverRace = hover && races[hover.raceIndex]
  const hoverPoints = hoverLine ? hoverLine.points_per_round[hover.raceIndex] : 0
  const hoverX = hover ? xFor(hover.raceIndex) : 0
  const hoverY = hoverLine ? yFor(hoverPoints) : 0
  // Tooltip foreignObject placement: prefer right of the marker, flip if near right edge.
  const TIP_W = 200
  const TIP_H = 78
  const tipLeft = hoverX + TIP_W + 12 > W ? hoverX - TIP_W - 12 : hoverX + 12
  const tipTop = Math.max(PAD_T, Math.min(H - PAD_B - TIP_H, hoverY - TIP_H / 2))

  return (
    <div className="bg-[#191919] border border-[#1F1F1F] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#999999]">
          Points trend
        </h2>
        <span className="text-[10px] text-[#777777] uppercase tracking-wider">
          {races.length} race{races.length === 1 ? '' : 's'}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        {/* Y-axis grid + labels */}
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={PAD_L} y1={yFor(t)}
              x2={W - PAD_R} y2={yFor(t)}
              stroke="#1F1F1F" strokeWidth={1}
            />
            <text
              x={PAD_L - 6} y={yFor(t) + 3}
              textAnchor="end" fontSize="10" fill="#777"
            >{t}</text>
          </g>
        ))}

        {/* X-axis: vertical guide + rotated race-name labels */}
        {races.map((r, i) => {
          // Truncate long names so the rotated text doesn't run too far down.
          const label = (r.track_name || r.country || `R${r.round_number}`)
            .replace(/^Autodromo\s+(Nazionale\s+)?/, '')
            .replace(/Circuit\s+/i, '')
            .replace(/\s+(International|Grand Prix).*$/i, '')
          const display = label.length > 22 ? label.slice(0, 21) + '…' : label
          return (
            <g key={r.id}>
              <line
                x1={xFor(i)} y1={PAD_T}
                x2={xFor(i)} y2={H - PAD_B}
                stroke="#1F1F1F" strokeWidth={1}
              />
              <text
                x={xFor(i)} y={H - PAD_B + 8}
                textAnchor="end" fontSize="10" fill="#999"
                transform={`rotate(-40 ${xFor(i)} ${H - PAD_B + 8})`}
              >{display}</text>
            </g>
          )
        })}

        {/* Lines */}
        {lines.map(line => {
          const isHovered = hover?.id === line.id
          const isMuted = hover && !isHovered
          const points = line.points_per_round
            .map((p, i) => `${xFor(i)},${yFor(p)}`)
            .join(' ')
          return (
            <g key={line.id}>
              {/* Wide invisible hit area for easier hovering */}
              <polyline
                points={points}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                onMouseMove={e => handleLineMove(e, line)}
                onMouseEnter={e => handleLineMove(e, line)}
                style={{ cursor: 'pointer' }}
              />
              <polyline
                points={points}
                fill="none"
                stroke={line.team_color || '#7ED321'}
                strokeWidth={isHovered ? 3 : 2}
                strokeOpacity={isMuted ? 0.2 : 0.9}
                strokeDasharray={line._seat === 1 ? '5,3' : ''}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
              <circle
                cx={xFor(line.points_per_round.length - 1)}
                cy={yFor(line.points_per_round[line.points_per_round.length - 1])}
                r={isHovered ? 4 : 2.5}
                fill={line.team_color || '#7ED321'}
                opacity={isMuted ? 0.2 : 1}
                pointerEvents="none"
              />
            </g>
          )
        })}

        {/* Hover marker + tooltip */}
        {hoverLine && hoverRace && (
          <g pointerEvents="none">
            <line
              x1={hoverX} y1={PAD_T}
              x2={hoverX} y2={H - PAD_B}
              stroke="#7ED321" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3,3"
            />
            <circle
              cx={hoverX} cy={hoverY}
              r={5}
              fill={hoverLine.team_color || '#7ED321'}
              stroke="#0D1117" strokeWidth={2}
            />
            <foreignObject x={tipLeft} y={tipTop} width={TIP_W} height={TIP_H}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: '#0D1117',
                  border: `1px solid ${hoverLine.team_color || '#7ED321'}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                  lineHeight: 1.3,
                }}
              >
                <div style={{
                  width: 40, height: 40, flexShrink: 0,
                  borderRadius: 6, overflow: 'hidden',
                  background: (hoverLine.team_color || '#1F1F1F') + '80',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {(hoverLine.photo_url || hoverLine.team_logo) ? (
                    <img
                      src={hoverLine.photo_url || hoverLine.team_logo}
                      alt=""
                      style={{
                        width: '100%', height: '100%',
                        objectFit: hoverLine.photo_url ? 'cover' : 'contain',
                        padding: hoverLine.photo_url ? 0 : 6,
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#E8ECF4', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {hoverLine.name}
                  </div>
                  <div style={{ color: '#777', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    After R{hoverRace.round_number} · {hoverRace.country || hoverRace.track_name}
                  </div>
                  <div style={{ color: '#7ED321', fontWeight: 700, fontSize: 13 }}>
                    {hoverPoints} pts
                  </div>
                </div>
              </div>
            </foreignObject>
          </g>
        )}

        {/* Axis baselines */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#383838" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#383838" />
      </svg>

      {!hover && (
        <p className="text-xs text-[#555]">
          Hover a line to see {mode === 'constructors' ? 'a team' : 'a driver'}'s total at any round.
        </p>
      )}
    </div>
  )
}
