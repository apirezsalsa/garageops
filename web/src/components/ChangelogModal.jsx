import { Sparkles, X, Check } from 'lucide-react';
import { animate, stagger } from 'animejs';
import { useAnimeScope } from '../utils/useAnime';

const CLOSE_LABEL = {
  es: 'Entendido', en: 'Got it', it: 'Capito', fr: 'Compris', de: 'Verstanden', pt: 'Entendi',
};
const TITLE_LABEL = {
  es: 'Novedades', en: "What's new", it: 'Novità', fr: 'Nouveautés', de: 'Neuigkeiten', pt: 'Novidades',
};

// Modal de "Novedades": se muestra cuando la versión de la app es más reciente que la última
// vista por el usuario (users/{uid}.lastSeenVersion). Solo lista cambios de cara al usuario
// (ver src/changelog.js) — nunca detalles internos.
export function ChangelogModal({ entries, language, onClose }) {
  const lang = CLOSE_LABEL[language] ? language : 'es';

  const scopeRef = useAnimeScope(() => {
    animate('.changelog-entry', {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(80, { start: 120 }),
      duration: 400,
      ease: 'outQuad',
    });
  }, []);

  return (
    <div ref={scopeRef} className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150 relative max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-5">
          <Sparkles className="w-7 h-7 stroke-[1.75]" />
        </div>

        <h3 className="text-lg font-extrabold text-white tracking-tight mb-5">{TITLE_LABEL[lang]}</h3>

        <div className="space-y-5 mb-6">
          {entries.map((entry) => (
            <div key={entry.version} className="changelog-entry">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">{entry.date}</p>
              <ul className="space-y-2">
                {(entry.changes[lang] || entry.changes.es).map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 leading-snug">
                    <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all active:scale-95"
        >
          {CLOSE_LABEL[lang]}
        </button>
      </div>
    </div>
  );
}
