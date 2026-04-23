export default function StatBadge({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xs text-[#999999] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-[#E8ECF4]">{value}</p>
    </div>
  )
}
