import { FileText, Wrench, ChevronRight, Paperclip } from 'lucide-react';

// Pantalla "Historial de Mantenimiento": libro digital de servicios + certificado de venta.
// Puramente presentacional, sin estado propio. Tocar una fila abre su edición (ver AGENTS.md:
// decisión de UX — filas tocables en vez de iconos diminutos de lápiz/papelera).
export function HistoryView({
  t, language,
  handleExportPDFCertificate, handleExportCSV,
  handleExportMaintenanceDetailPDF,
  maintenances, handleEditMaintenance,
  setPhotoPreviewModal,
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight leading-tight">{t('historyTitle')}</h2>
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
          <div
            key={item.id}
            onClick={() => handleEditMaintenance(item)}
            className="p-4 sm:p-5 hover:bg-zinc-800/30 active:bg-zinc-800/50 transition-colors cursor-pointer space-y-2.5"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-orange-400 shrink-0">
                <Wrench className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-100 leading-snug line-clamp-2">{item.title}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{item.vehicle} • <span className="font-mono text-zinc-500">{item.date}</span></p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 mt-1" />
            </div>

            <div className="flex items-center justify-between pl-12">
              <span className="text-xs font-mono font-bold text-zinc-100 bg-zinc-800 px-3 py-1 rounded-xl border border-zinc-700/60">
                {item.cost}
              </span>
              <div className="flex items-center gap-0.5">
                {item.receipts && item.receipts.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoPreviewModal({ urls: item.receipts.map(r => r.url), index: 0, title: `${item.title} — Recibo` }); }}
                    title={`${item.receipts.length} foto(s) de ticket/factura`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors relative"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {item.receipts.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleExportMaintenanceDetailPDF(item); }}
                  title="Exportar certificado PDF de esta intervención"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
