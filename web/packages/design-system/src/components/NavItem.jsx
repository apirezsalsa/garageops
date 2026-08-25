/**
 * @param {{
 *  icon: React.ComponentType<{ className?: string }>,
 *  label: string,
 *  badge?: string | number,
 *  active?: boolean,
 *  layout?: 'sidebar' | 'mobile-tab',
 *  onClick?: (e: React.MouseEvent) => void,
 * }} props
 */
export function NavItem({ icon: Icon, label, badge, active = false, layout = 'sidebar', onClick }) {
  if (layout === 'mobile-tab') {
    return (
      <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-14 h-12 rounded-2xl transition-all ${
          active ? 'text-orange-400 font-bold scale-105' : 'text-zinc-500 hover:text-zinc-300 font-medium'
        }`}
      >
        <Icon className={`w-5 h-5 mb-0.5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
        <span className="text-[10px] tracking-tight">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
        active
          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/25 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span className={`px-2.5 py-0.5 text-[10px] font-mono rounded-full ${active ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-400'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
