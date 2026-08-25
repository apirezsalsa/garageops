/**
 * @param {{
 *  label?: string,
 *  error?: string,
 *  className?: string,
 * } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export function Input({ label, error, className = '', id, ...rest }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[11px] font-medium text-zinc-400">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`bg-zinc-950 border rounded-2xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-orange-500/60 ${
          error ? 'border-rose-500/50' : 'border-zinc-800'
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-[10px] text-rose-400 font-medium">{error}</span>}
    </div>
  );
}
