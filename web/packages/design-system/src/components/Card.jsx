/**
 * @param {{
 *  interactive?: boolean,
 *  highlight?: boolean,
 *  className?: string,
 *  children?: React.ReactNode,
 * } & React.HTMLAttributes<HTMLDivElement>} props
 */
export function Card({ interactive = false, highlight = false, className = '', children, ...rest }) {
  return (
    <div
      className={`p-5 rounded-3xl border shadow-lg transition-all ${
        highlight
          ? 'bg-rose-500/5 border-rose-500/30'
          : 'bg-zinc-900/70 border-zinc-800/80'
      } ${
        interactive ? 'hover:border-orange-500/40 hover:bg-zinc-900 cursor-pointer group' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
