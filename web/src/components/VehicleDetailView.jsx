import { FileText, Edit2, Trash2, Gauge, TrendingUp, ShieldAlert, Plus, Paperclip, ChevronRight } from 'lucide-react';
import { translateCategory } from '../locales';
import { getInspectionStatus, getInspectionLabel } from '../utils/dates';
import { optimizeImageFile } from '../utils/image';

// Ficha de detalle de un vehículo (dentro de la pestaña Garaje, cuando hay uno seleccionado):
// cabecera con foto/estado, acciones rápidas, alertas programadas, historial de intervenciones
// propio del vehículo. Puramente presentacional, sin estado propio.
export function VehicleDetailView({
  t, language, currencySymbol,
  selectedVehicle, setSelectedVehicle,
  handleExportPDFCertificate, openEditVehicleModal, requestDeleteVehicle,
  setPhotoPreviewModal, setVehicles,
  maintenances,
  setShowAlertModal, setNewAlertForm,
  setShowKmModal, setNewKmValue, setNewSecondaryKmValue,
  setEditingMaintenanceId, blankMaintenanceForm, setNewMaintenanceForm, setShowAddMaintenanceModal,
  handleDeleteVehicleAlert,
  handleEditMaintenance,
}) {
  const vehicleMaintenances = maintenances.filter(m => (m.vehicle || '').toLowerCase() === (selectedVehicle?.name || '').toLowerCase());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedVehicle(null)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800"
        >
          {t('backToGarage')}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportPDFCertificate(selectedVehicle)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold text-xs border border-orange-500/30 transition-colors shadow-sm active:scale-95"
          >
            <FileText className="w-4 h-4 stroke-[2.5]" />
            <span>{t('exportPdfBtn')}</span>
          </button>

          <button
            onClick={() => openEditVehicleModal(selectedVehicle)}
            title={language === 'es' ? 'Editar Vehículo' : language === 'en' ? 'Edit Vehicle' : language === 'it' ? 'Modifica Veicolo' : language === 'fr' ? 'Modifier le Véhicule' : language === 'de' ? 'Fahrzeug Bearbeiten' : 'Editar Veículo'}
            className="p-2 rounded-xl text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors border border-transparent hover:border-amber-500/20"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => requestDeleteVehicle(selectedVehicle.id)}
            title={t('deleteVehicle')}
            className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ficha Header del Vehículo */}
      <div className={`p-4 sm:p-8 rounded-3xl border bg-gradient-to-br ${selectedVehicle.accentColor} ${selectedVehicle.borderColor} bg-zinc-900 relative overflow-hidden shadow-2xl space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group/photo shrink-0">
              <div
                onClick={() => {
                  if (selectedVehicle.photo) {
                    setPhotoPreviewModal({
                      url: selectedVehicle.photo,
                      title: selectedVehicle.name
                    });
                  }
                }}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center text-3xl sm:text-4xl shadow-inner overflow-hidden ${
                  selectedVehicle.photo ? 'cursor-pointer hover:opacity-90' : ''
                }`}
              >
                {selectedVehicle.photo ? (
                  <img src={selectedVehicle.photo} alt={selectedVehicle.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{selectedVehicle.icon}</span>
                )}
              </div>

              <div className="flex gap-1 mt-1 justify-center">
                {selectedVehicle.photo && (
                  <button
                    type="button"
                    onClick={() => setPhotoPreviewModal({ url: selectedVehicle.photo, title: selectedVehicle.name })}
                    className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-300 text-[9px] font-semibold border border-zinc-700/60"
                  >
                    👁️
                  </button>
                )}
                <label
                  title={t('changePhoto')}
                  className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold cursor-pointer border border-orange-500/40"
                >
                  📷 {selectedVehicle.photo ? t('changePhoto') : t('photo')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const optimizedUrl = await optimizeImageFile(file);
                        setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? { ...v, photo: optimizedUrl } : v));
                        setSelectedVehicle(prev => ({ ...prev, photo: optimizedUrl }));
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">{selectedVehicle.name}</h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium mt-0.5 truncate">{translateCategory(selectedVehicle.category, language)}</p>
              {(selectedVehicle.licensePlate || selectedVehicle.insuranceCompany) && (
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">
                  {[selectedVehicle.licensePlate, selectedVehicle.insuranceCompany].filter(Boolean).join(' · ')}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-orange-400 font-mono text-[11px] font-semibold">
                  <Gauge className="w-3 h-3" />
                  <span>{t('usage')} {selectedVehicle.usage}</span>
                </div>
                {selectedVehicle.secondaryUsageNum != null && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-950/80 border border-zinc-800/60 text-zinc-400 font-mono text-[11px] font-semibold">
                    <span>{selectedVehicle.secondaryUsageNum} {selectedVehicle.unit === 'hrs' ? 'km' : 'hrs'}</span>
                  </div>
                )}
                {(() => {
                  const vehicleSpent = maintenances
                    .filter(m => (m.vehicle || '').toLowerCase() === (selectedVehicle.name || '').toLowerCase())
                    .reduce((sum, m) => sum + (parseFloat((m.cost || '').replace(/[^0-9.]/g, '')) || 0), 0);

                  return (
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                      <TrendingUp className="w-3 h-3" />
                      <span>{t('spent')} {vehicleSpent.toFixed(2)} {currencySymbol}</span>
                    </div>
                  );
                })()}
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                  selectedVehicle.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  selectedVehicle.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {selectedVehicle.status === 'ok' ? t('statusOk') : selectedVehicle.statusText}
                </span>
                {(() => {
                  const inspection = getInspectionStatus(selectedVehicle.nextInspectionDate);
                  if (!inspection) return null;
                  return (
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                      inspection.urgency === 'overdue' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                      inspection.urgency === 'soon' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                      'bg-zinc-800/60 text-zinc-400 border-zinc-700/60'
                    }`}>
                      {getInspectionLabel(language)}:{' '}
                      {inspection.days < 0
                        ? (language === 'es' ? `venció hace ${Math.abs(inspection.days)} días` : language === 'en' ? `overdue by ${Math.abs(inspection.days)} days` : language === 'it' ? `scaduta da ${Math.abs(inspection.days)} giorni` : language === 'fr' ? `en retard de ${Math.abs(inspection.days)} jours` : language === 'de' ? `seit ${Math.abs(inspection.days)} Tagen überfällig` : `venceu há ${Math.abs(inspection.days)} dias`)
                        : (language === 'es' ? `en ${inspection.days} días` : language === 'en' ? `in ${inspection.days} days` : language === 'it' ? `tra ${inspection.days} giorni` : language === 'fr' ? `dans ${inspection.days} jours` : language === 'de' ? `in ${inspection.days} Tagen` : `em ${inspection.days} dias`)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Botones de Acción Principales */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
          <button
            onClick={() => {
              setShowAlertModal(selectedVehicle);
              setNewAlertForm({ type: 'usage', title: '', targetUsage: '', advanceNotice: selectedVehicle.unit === 'hrs' ? '5' : '500', targetDate: '' });
            }}
            className="px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('addAlertShort')}</span>
          </button>

          <button
            onClick={() => {
              setShowKmModal(selectedVehicle);
              setNewKmValue((selectedVehicle.usageNum || 0).toString());
              setNewSecondaryKmValue(selectedVehicle.secondaryUsageNum != null ? String(selectedVehicle.secondaryUsageNum) : '');
            }}
            className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-all border border-zinc-700 flex items-center justify-center gap-1.5"
          >
            <Gauge className="w-3.5 h-3.5 text-orange-400" />
            <span>{t('updateUnit')} {selectedVehicle.unit}</span>
          </button>

          <button
            onClick={() => {
              setEditingMaintenanceId(null);
              setNewMaintenanceForm(blankMaintenanceForm(selectedVehicle.name));
              setShowAddMaintenanceModal(true);
            }}
            className="col-span-2 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('addIntervention')}</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN DE ALERTAS PROGRAMADAS DE ESTE VEHÍCULO */}
      <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">{t('scheduledAlerts')} ({selectedVehicle.name})</h3>
          </div>
          <button
            onClick={() => {
              setShowAlertModal(selectedVehicle);
              setNewAlertForm({ type: 'usage', title: '', targetUsage: '', advanceNotice: selectedVehicle.unit === 'hrs' ? '5' : '500', targetDate: '' });
            }}
            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            {t('newAlert')}
          </button>
        </div>

        {selectedVehicle.alerts && selectedVehicle.alerts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {selectedVehicle.alerts.map(al => {
              const isDateAlert = al.type === 'date';
              const current = selectedVehicle.usageNum || 0;
              const diff = isDateAlert ? null : al.targetUsage - current;
              const dateStatus = isDateAlert ? getInspectionStatus(al.targetDate) : null;
              const isDue = isDateAlert ? (dateStatus?.days ?? 1) <= 0 : diff <= 0;
              const isNear = isDateAlert
                ? false
                : !isDue && diff <= (al.advanceNotice || 0);

              return (
                <div
                  key={al.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isDue
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200 animate-pulse'
                      : isNear
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-zinc-950/70 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{al.title}</span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${
                        isDue
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : isNear
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {isDue ? '¡VENCIDO / TOCA YA!' : isNear ? '¡PRÓXIMO!' : 'PROGRAMADO'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 pt-0.5">
                      {isDateAlert ? (
                        <>
                          <span>{t('targetDateLabel')} <strong className="text-white">{new Date(al.targetDate).toLocaleDateString(language === 'en' ? 'en-US' : language)}</strong></span>
                          <span>•</span>
                          <span>
                            {isDue
                              ? `${t('overdueBy')} ${Math.abs(dateStatus.days)} ${language === 'es' ? 'días' : language === 'en' ? 'days' : language === 'it' ? 'giorni' : language === 'fr' ? 'jours' : language === 'de' ? 'Tage' : 'dias'}`
                              : `${t('remaining')} ${dateStatus.days} ${language === 'es' ? 'días' : language === 'en' ? 'days' : language === 'it' ? 'giorni' : language === 'fr' ? 'jours' : language === 'de' ? 'Tage' : 'dias'}`}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{t('target')} <strong className="text-white">{al.targetUsage} {selectedVehicle.unit}</strong></span>
                          <span>•</span>
                          <span>
                            {isDue
                              ? `${t('overdueBy')} ${Math.abs(diff).toFixed(1)} ${selectedVehicle.unit}`
                              : `${t('remaining')} ${diff.toFixed(1)} ${selectedVehicle.unit}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteVehicleAlert(selectedVehicle.id, al.id)}
                    title="Eliminar Alerta"
                    className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 py-0.5">
            {t('noAlerts')}
          </p>
        )}
      </div>

      {/* Historial Específico del Vehículo */}
      <div>
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider font-mono mb-3">{t('vehicleHistoryTitle')}</h3>
        <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
          {vehicleMaintenances.length > 0 ? (
            vehicleMaintenances.map((item) => (
              <div
                key={item.id}
                onClick={() => handleEditMaintenance(item)}
                className="p-4 sm:p-5 hover:bg-zinc-800/30 active:bg-zinc-800/50 transition-colors space-y-3 cursor-pointer"
              >
                {/* Línea 1 Superior Dedicada: Título del Trabajo y Acciones */}
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-zinc-100 leading-snug">{item.title}</h4>
                  <div className="flex items-center gap-1 shrink-0">
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
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </div>
                </div>

                {/* Línea 2: Categoría Badge + Fecha + Tipo */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  {item.category && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 font-mono px-2.5 py-0.5 rounded-md border border-zinc-700/60 font-medium">
                      {item.category}
                    </span>
                  )}
                  <span className="font-mono text-zinc-400">{item.date}</span>
                  <span>•</span>
                  <span className="text-orange-400 font-semibold">{item.type}</span>
                  {item.usageAtService && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-zinc-300">Uso: {item.usageAtService}</span>
                    </>
                  )}
                  {item.secondaryReading && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-zinc-500">{item.secondaryReading}</span>
                    </>
                  )}
                  {item.mechanic && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-500">Taller: {item.mechanic}</span>
                    </>
                  )}
                </div>

                {/* Línea 3: Desglose de Precio */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40 text-[11px]">
                  <div className="font-mono text-zinc-500 text-[10px]">
                    {/* Se compara el número, no el texto: "0.00 €" y "0.00 $" son ambos cero,
                        pero solo el primero coincidiría con una comparación de string literal. */}
                    {(parseFloat((item.partsCost || '').replace(/[^0-9.]/g, '')) || 0) > 0 && (
                      <span>Piezas: <strong className="text-zinc-400">{item.partsCost}</strong></span>
                    )}
                    {(parseFloat((item.laborCost || '').replace(/[^0-9.]/g, '')) || 0) > 0 && (
                      <span className="ml-2">M.O: <strong className="text-zinc-400">{item.laborCost}</strong></span>
                    )}
                  </div>

                  <div className="text-xs font-mono font-bold text-orange-400 bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-800">
                    {item.cost}
                  </div>
                </div>

                {item.notes && (
                  <div className="pt-2 text-[11px] text-zinc-400 italic bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                    "{item.notes}"
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-zinc-500">
              {t('noHistoryMsgPrefix')}<span className="text-orange-400 font-semibold">{t('noHistoryMsgBtn')}</span>{t('noHistoryMsgSuffix')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
