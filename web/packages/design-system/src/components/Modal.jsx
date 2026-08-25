import { X } from 'lucide-react';

/**
 * @param {{
 *  open: boolean,
 *  onClose: () => void,
 *  title?: string,
 *  className?: string,
 *  children?: React.ReactNode,
 * }} props
 */
export function Modal({ open, onClose, title, className = '', children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-bold text-zinc-100">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
