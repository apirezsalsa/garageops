import { FileText, Wrench, Edit2, Trash2 } from 'lucide-react';

// Pantalla "Historial de Mantenimiento": libro digital de servicios + certificado de venta.
// Puramente presentacional, sin estado propio.
export function HistoryView({
  t, language,
  handleExportPDFCertificate, handleExportCSV,
  handleExportMaintenanceDetailPDF,
  maintenances, handleEditMaintenance, handleDeleteMaintenance,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('historyTitle')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Libro digital de servicios y certificado para venta.' : language === 'en' ? 'Digital service logbook and sale certificate.' : language === 'it' ? 'Libretto digitale dei servizi e certificato per la vendita.' : language === 'fr' ? 'Carnet numérique d\'entretien et certificat de vente.' : language === 'de' ? 'Digitales Serviceheft und Verkaufszertifikat.' : 'Livrete digital de serviços e certificado de venda.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportPDFCertificate()}
            className="px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <FileText className="w-4 h-4 text-orange-400" />
            <span>{t('exportPdfBtn')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <span>📊 {t('exportCsv')}</span>
          </button>
        </div>
      </div>

      <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden shadow-xl">
        {maintenances.map((item) => (
          <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-orange-400 shrink-0">
                <Wrench className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-zinc-100">{item.title}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{item.vehicle} • <span className="font-mono text-zinc-500">{item.date}</span></p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-mono font-bold text-zinc-100 bg-zinc-800 px-3.5 py-1.5 rounded-xl border border-zinc-700/60">
                {item.cost}
              </span>
              <div className="flex items-center gap-1 border-l border-zinc-800 pl-3">
                <button
                  onClick={() => handleExportMaintenanceDetailPDF(item)}
                  title="Exportar certificado PDF de esta intervención"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleEditMaintenance(item)}
                  title="Modificar Intervención"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteMaintenance(item.id)}
                  title="Borrar Registro"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
