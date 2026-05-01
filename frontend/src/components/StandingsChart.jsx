import { useState } from 'react'

/**
 * Cumulative-points line chart for driver or constructor standings.
 *
 * Props:
 *   - races:  [{ id, round_number, track_name, country }]
 *   - items:  [{ id, name, team_color, team_name?, points_per_round: number[] }]
 *   - mode:   'drivers' | 'constructors'   (used for "no data" copy)
 *
 * Two same-coloured driver lines are differentiated with stroke-dasharray on
 * the second one so teammates don't completely overlap visually.
 */
export default function StandingsChart({ races = [], items = [], mode = 'drivers' }) {
  const [hoverId, setHoverId] = useState(null)

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
  // Round up the y-axis to a clean tick (10, 25, 50, 100, 250, ...).
  const niceMax = ((m) => {
    const ticks = [5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]
    for (const t of ticks) if (t >= m) return t
    return Math.ceil(m / 100) * 100
  })(maxPoints)

  const W = 800
  const H = 320
  const PAD_L = 40
  const PAD_R = 16
  const PAD_T = 16
  const PAD_B = 32
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const xFor = (i) =>
    races.length === 1
      ? PAD_L + innerW / 2
      : PAD_L + (innerW * i) / (races.length - 1)
  const yFor = (p) => PAD_T + innerH - (innerH * p) / niceMax

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(niceMax * t))

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
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid + labels */}
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={PAD_L} y1={yFor(t)}
              x2={W - PAD_R} y2={yFor(t)}
              stroke="#1F1F1F"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6} y={yFor(t) + 3}
              textAnchor="end" fontSize="10" fill="#777"
            >{t}</text>
          </g>
        ))}

        {/* X-axis labels */}
        {races.map((r, i) => (
          <g key={r.id}>
            <line
              x1={xFor(i)} y1={PAD_T}
              x2={xFor(i)} y2={H - PAD_B}
              stroke="#1F1F1F" strokeWidth={1}
            />
            <text
              x={xFor(i)} y={H - PAD_B + 14}
              textAnchor="middle" fontSize="10" fill="#777"
            >R{r.round_number}</text>
          </g>
        ))}

        {/* Lines */}
        {lines.map(line => {
          const isHovered = hoverId === line.id
          const isMuted = hoverId !== null && !isHovered
          const points = line.points_per_round
            .map((p, i) => `${xFor(i)},${yFor(p)}`)
            .join(' ')
          return (
            <g key={line.id}>
              <polyline
                points={points}
                fill="none"
                stroke={line.team_color || '#7ED321'}
                strokeWidth={isHovered ? 3 : 2}
                strokeOpacity={isMuted ? 0.2 : 0.9}
                strokeDasharray={line._seat === 1 ? '5,3' : ''}
                strokeLinecap="round"
                strokeLinejoin="round"
                onMouseEnter={() => setHoverId(line.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: 'pointer' }}
              />
              {/* End-point dot */}
              <circle
                cx={xFor(line.points_per_round.length - 1)}
                cy={yFor(line.points_per_round[line.points_per_round.length - 1])}
                r={isHovered ? 4 : 2.5}
                fill={line.team_color || '#7ED321'}
                opacity={isMuted ? 0.2 : 1}
              />
            </g>
          )
        })}

        {/* Axis baselines */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#383838" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#383838" />
      </svg>

      {/* Hover label */}
      <div className="min-h-[20px] text-xs text-[#999999]">
        {hoverId !== null && (() => {
          const l = lines.find(x => x.id === hoverId)
          if (!l) return null
          const last = l.points_per_round[l.points_per_round.length - 1]
          return (
            <span>
              <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: l.team_color || '#7ED321' }} />
              <span className="font-medium text-[#E8ECF4]">{l.name}</span>
              {l.team_name && <span className="text-[#777777]"> · {l.team_name}</span>}
              <span className="text-[#7ED321] ml-2">{last} pts</span>
            </span>
          )
        })()}
        {hoverId === null && (
          <span className="text-[#555]">Hover a line to highlight {mode === 'constructors' ? 'a team' : 'a driver'}</span>
        )}
      </div>
    </div>
  )
}
