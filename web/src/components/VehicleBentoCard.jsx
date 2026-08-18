import { ChevronRight, ShieldAlert } from 'lucide-react';
import { TRANSLATIONS, translateCategory } from '../locales';
import { getInspectionLabel, getInspectionStatus } from '../utils/dates';

export function VehicleBentoCard({ vehicle, maintenances = [], language = 'es', currencySymbol = '€', onSelect, onOpenKmModal, onDelete }) {
  const vehicleSpent = (maintenances || [])
    .filter(m => (m.vehicle || '').toLowerCase() === (vehicle.name || '').toLowerCase())
    .reduce((sum, m) => sum + (parseFloat((m.cost || '').replace(/[^0-9.]/g, '')) || 0), 0);

  const statusLabel = vehicle.status === 'ok'
    ? (TRANSLATIONS[language]?.statusOk || TRANSLATIONS.es.statusOk)
    : vehicle.statusText;

  const inspection = getInspectionStatus(vehicle.nextInspectionDate);

  return (
    <div
      onClick={onSelect}
      className="p-5 rounded-3xl bg-zinc-900/70 border border-zinc-800/80 hover:border-orange-500/40 hover:bg-zinc-900 transition-all cursor-pointer group shadow-lg flex flex-col justify-between relative"
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shadow-inner overflow-hidden shrink-0">
              {vehicle.photo ? (
                <img src={vehicle.photo} alt={vehicle.name} className="w-full h-full object-cover" />
              ) : (
                <span>{vehicle.icon}</span>
              )}
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-zinc-100 group-hover:text-orange-400 transition-colors">{vehicle.name}</h4>
              <p className="text-[11px] text-zinc-500 font-medium">{translateCategory(vehicle.category, language)}</p>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 transition-colors shrink-0" />
        </div>

        {/* Indicador de Uso, Gasto Acumulado & Botón Rápido */}
        <div className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/60 flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {language === 'es' ? 'Lectura / Gasto' : language === 'en' ? 'Usage / Cost' : language === 'it' ? 'Lettura / Spesa' : language === 'fr' ? 'Relevé / Coût' : language === 'de' ? 'Stand / Kosten' : 'Leitura / Custo'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-orange-400">{vehicle.usage}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{vehicleSpent.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>
          <button
            onClick={onOpenKmModal}
            className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-300 text-[10px] font-semibold transition-colors border border-zinc-700/60"
          >
            + {language === 'es' ? 'Actualizar' : language === 'en' ? 'Update' : language === 'it' ? 'Aggiorna' : language === 'fr' ? 'Mettre à jour' : language === 'de' ? 'Aktualisieren' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
        <span className="text-[10px] text-zinc-500 font-medium">
          {language === 'es' ? 'Estado:' : language === 'en' ? 'Status:' : language === 'it' ? 'Stato:' : language === 'fr' ? 'Statut :' : language === 'de' ? 'Status:' : 'Estado:'}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
          vehicle.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          vehicle.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
          'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          {statusLabel}
        </span>
      </div>

      {inspection && (
        <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold ${
          inspection.urgency === 'overdue' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
          inspection.urgency === 'soon' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
          'bg-zinc-800/60 text-zinc-400 border-zinc-700/60'
        }`}>
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>
            {getInspectionLabel(language)}:{' '}
            {inspection.days < 0
              ? (language === 'es' ? `venció hace ${Math.abs(inspection.days)} días` : language === 'en' ? `overdue by ${Math.abs(inspection.days)} days` : language === 'it' ? `scaduta da ${Math.abs(inspection.days)} giorni` : language === 'fr' ? `en retard de ${Math.abs(inspection.days)} jours` : language === 'de' ? `seit ${Math.abs(inspection.days)} Tagen überfällig` : `venceu há ${Math.abs(inspection.days)} dias`)
              : (language === 'es' ? `en ${inspection.days} días` : language === 'en' ? `in ${inspection.days} days` : language === 'it' ? `tra ${inspection.days} giorni` : language === 'fr' ? `dans ${inspection.days} jours` : language === 'de' ? `in ${inspection.days} Tagen` : `em ${inspection.days} dias`)}
          </span>
        </div>
      )}
    </div>
  );
}
