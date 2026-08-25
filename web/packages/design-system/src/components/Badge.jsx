const VARIANTS = {
  neutral: 'bg-zinc-800 text-zinc-300',
  active: 'bg-orange-500/20 text-orange-300',
  success: 'bg-emerald-500/15 text-emerald-400',
  danger: 'bg-rose-500/15 text-rose-400',
};

/**
 * @param {{
 *  variant?: 'neutral' | 'active' | 'success' | 'danger',
 *  className?: string,
 *  children?: React.ReactNode,
 * } & React.HTMLAttributes<HTMLSpanElement>} props
 */
export function Badge({ variant = 'neutral', className = '', children, ...rest }) {
  return (
    <span
      className={`px-2.5 py-0.5 text-[10px] font-mono font-semibold rounded-full ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
