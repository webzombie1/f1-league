const TYRE_COLORS = {
  soft: { bg: 'bg-red-500', text: 'text-white' },
  medium: { bg: 'bg-yellow-400', text: 'text-stone-800' },
  hard: { bg: 'bg-white border border-stone-300', text: 'text-stone-800' },
  inter: { bg: 'bg-green-500', text: 'text-white' },
  wet: { bg: 'bg-blue-500', text: 'text-white' },
}

export default function TyreChip({ compound, laps }) {
  const colors = TYRE_COLORS[compound] || TYRE_COLORS.hard
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      {compound?.[0]?.toUpperCase()}{laps ? ` ${laps}` : ''}
    </span>
  )
}
