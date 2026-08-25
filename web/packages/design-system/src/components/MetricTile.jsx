/**
 * @param {{
 *  title: string,
 *  value: string | number,
 *  subtitle?: string,
 *  icon: React.ComponentType<{ className?: string }>,
 *  color?: string,
 *  highlight?: boolean,
 * }} props
 */
export function MetricTile({ title, value, subtitle, icon: Icon, color = 'text-zinc-300', highlight = false }) {
  return (
    <div className={`p-4 sm:p-5 rounded-3xl border transition-all ${
      highlight
        ? 'bg-rose-500/5 border-rose-500/30'
        : 'bg-zinc-900/60 border-zinc-800/80'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-zinc-400">{title}</span>
        <div className={`w-8 h-8 rounded-xl bg-zinc-800/80 flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">{value}</p>
      {subtitle && <p className="text-[10px] text-zinc-500 mt-1 font-medium">{subtitle}</p>}
    </div>
  );
}
