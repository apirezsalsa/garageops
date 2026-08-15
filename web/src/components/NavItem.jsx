export function NavItem({ icon: Icon, label, badge, active, onClick }) {
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
