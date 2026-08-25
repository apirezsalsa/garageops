const VARIANTS = {
  primary: 'bg-orange-500 text-white hover:bg-orange-400 shadow-sm shadow-orange-500/20',
  secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700/60',
  ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60',
  danger: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

/**
 * @param {{
 *  variant?: 'primary' | 'secondary' | 'ghost' | 'danger',
 *  size?: 'sm' | 'md' | 'lg',
 *  icon?: React.ComponentType<{ className?: string }>,
 *  disabled?: boolean,
 *  className?: string,
 *  children?: React.ReactNode,
 *  onClick?: (e: React.MouseEvent) => void,
 * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {Icon && <Icon className="w-4 h-4 stroke-[2.5]" />}
      {children}
    </button>
  );
}
