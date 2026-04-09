export default function StatBadge({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xs text-stone-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-stone-800">{value}</p>
    </div>
  )
}
