import { Sparkles, Bike, AlertTriangle, Wrench, History, X, ArrowLeft, ArrowRight } from 'lucide-react';

export function OnboardingTour({ step, setStep, onClose, t }) {
  const slides = [
    { icon: Sparkles, title: t('onboardingWelcomeTitle'), body: t('onboardingWelcomeBody') },
    { icon: Bike, title: t('onboardingGarageTitle'), body: t('onboardingGarageBody') },
    { icon: AlertTriangle, title: t('onboardingAlertsTitle'), body: t('onboardingAlertsBody') },
    { icon: Wrench, title: t('onboardingPartsTitle'), body: t('onboardingPartsBody') },
    { icon: History, title: t('onboardingHistoryTitle'), body: t('onboardingHistoryBody') },
  ];
  const isLast = step === slides.length - 1;
  const current = slides[step];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-5">
          <current.icon className="w-7 h-7 stroke-[1.75]" />
        </div>

        <h3 className="text-lg font-extrabold text-white tracking-tight mb-2">{current.title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">{current.body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {slides.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-orange-500' : 'w-1.5 bg-zinc-700'}`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t('onboardingBack')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-all active:scale-95"
            >
              {t('onboardingSkip')}
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            className="flex-1 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/25 transition-all active:scale-95"
          >
            {isLast ? t('onboardingFinish') : t('onboardingNext')}
            {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
