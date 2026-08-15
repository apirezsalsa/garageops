export function MobileNavItem({ icon: Icon, label, active, onClick }) {
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
