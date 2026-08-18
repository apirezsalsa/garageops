import { useState } from 'react';
import { Plus, Search, ChevronRight } from 'lucide-react';

// Pantalla "Repuestos": listado con búsqueda, lotes de compra desplegables. Tocar una fila abre
// su edición (ver AGENTS.md: decisión de UX — filas tocables en vez de iconos diminutos de lápiz/
// papelera). Los modales de Añadir/Editar Repuesto y de Añadir Lote viven en App() (compartidos
// también desde el modal de mantenimiento), así que solo se disparan aquí vía props.
export function PartsView({
  t, language, currencySymbol,
  parts,
  setEditingPartId, setNewPartForm, setShowAddPartModal,
  setShowBatchModal, setNewBatchForm,
  handleEditPart,
}) {
  const [partSearch, setPartSearch] = useState('');
  const [selectedPartForBatches, setSelectedPartForBatches] = useState(null);

  const filteredParts = parts.filter(p => {
    const search = partSearch.toLowerCase();
    const matchName = p.name.toLowerCase().includes(search);
    const matchVeh = p.compatibleVehicles ? p.compatibleVehicles.some(v => v.toLowerCase().includes(search)) : (p.vehicle && p.vehicle.toLowerCase().includes(search));
    return matchName || matchVeh;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('partsTitle')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Gestión de piezas, consumibles y stock mínimo.' : language === 'en' ? 'Management of parts, consumables, and minimum stock.' : language === 'it' ? 'Gestione di parti, consumabili e scorta minima.' : language === 'fr' ? 'Gestion des pièces, consommables et stock minimum.' : language === 'de' ? 'Verwaltung von Teilen, Verbrauchsmaterial und Mindestbestand.' : 'Gestão de peças, consumíveis e stock mínimo.'}</p>
        </div>
        <button
          onClick={() => {
            setEditingPartId(null);
            setNewPartForm({
              name: '',
              reference: '',
              unit: 'ud',
              compatibleVehicles: [],
              minStock: '1',
              initialQty: '1',
              initialPrice: '',
              initialSupplier: '',
              initialDate: '2026-07-25'
            });
            setShowAddPartModal(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t('addPartBtn')}</span>
        </button>
      </div>

      <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800/80 flex items-center gap-3">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={partSearch}
            onChange={(e) => setPartSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar repuesto por nombre o vehículo compatible...' : language === 'en' ? 'Search part by name or compatible vehicle...' : language === 'it' ? 'Cerca ricambio per nome o veicolo compatibile...' : language === 'fr' ? 'Rechercher une pièce par nom ou véhicule compatible...' : language === 'de' ? 'Ersatzteil nach Name oder kompatiblem Fahrzeug suchen...' : 'Procurar peça por nome ou veículo compatível...'}
            className="bg-transparent text-xs text-zinc-200 outline-none w-full placeholder:text-zinc-600"
          />
        </div>

        <div className="divide-y divide-zinc-800/60">
          {filteredParts.map((p) => {
            const vehList = p.compatibleVehicles || (p.vehicle ? [p.vehicle] : ['Universal']);
            const purchases = p.purchases || [];
            const totalStock = parseFloat((purchases.reduce((acc, b) => acc + (b.qty || 0), 0)).toFixed(3));
            const formatQty = (num) => {
              if (typeof num !== 'number' || isNaN(num)) return '0';
              return Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(3)).toString();
            };
            const isLow = p.lowStockAlertEnabled !== false && totalStock <= (p.minStock || 1);

            // Formatear precios de compra (mostrar rango o único precio)
            const prices = purchases.map(b => b.pricePerUnit).filter(pr => pr > 0);
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
            const priceLabel = minPrice === maxPrice
              ? `${minPrice.toFixed(2)} ${currencySymbol}`
              : `${minPrice.toFixed(2)} ${currencySymbol} - ${maxPrice.toFixed(2)} ${currencySymbol}`;

            const isExpanded = selectedPartForBatches === p.id;

            return (
              <div key={p.id} className="divide-y divide-zinc-800/40">
                <div
                  onClick={() => handleEditPart(p)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-800/30 active:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-bold text-zinc-100">{p.name}</p>
                      {p.reference && (
                        <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg border border-zinc-700/60">
                          {p.reference}
                        </span>
                      )}
                      {purchases.length > 1 && (
                        <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold">
                          {purchases.length} {language === 'es' ? 'Lotes de Compra' : language === 'en' ? 'Purchase Batches' : language === 'it' ? 'Lotti d\'acquisto' : language === 'fr' ? 'Lots d\'Achat' : language === 'de' ? 'Einkaufschargen' : 'Lotes de Compra'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-zinc-500 font-medium">{language === 'es' ? 'Compatibilidad:' : language === 'en' ? 'Compatibility:' : language === 'it' ? 'Compatibilità:' : language === 'fr' ? 'Compatibilité :' : language === 'de' ? 'Kompatibilität:' : 'Compatibilidade:'}</span>
                      {vehList.map((vName, idx) => (
                        <span key={idx} className="text-[10px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-lg border border-zinc-700/60">
                          {vName}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-xl border ${
                        isLow
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                      }`}>
                        {formatQty(totalStock)} {p.unit || 'ud'} {isLow && (language === 'es' ? '(Stock Bajo)' : language === 'en' ? '(Low Stock)' : language === 'it' ? '(Scorta Bassa)' : language === 'fr' ? '(Stock Bas)' : language === 'de' ? '(Niedriger Bestand)' : '(Stock Baixo)')}
                      </span>
                      <p className="text-[11px] font-mono text-zinc-400 mt-1 font-semibold">
                        {prices.length > 0 ? priceLabel : (language === 'es' ? 'Sin compras' : language === 'en' ? 'No purchases' : language === 'it' ? 'Nessun acquisto' : language === 'fr' ? 'Aucun achat' : language === 'de' ? 'Keine Käufe' : 'Sem compras')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 border-l border-zinc-800 pl-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBatchModal(p);
                          setNewBatchForm({ qty: '1', pricePerUnit: '', supplier: '', date: '2026-07-25' });
                        }}
                        title="Añadir nueva compra / lote de stock"
                        className="min-h-[44px] px-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ {language === 'es' ? 'Compra' : language === 'en' ? 'Batch' : language === 'it' ? 'Lotto' : language === 'fr' ? 'Lot' : language === 'de' ? 'Charge' : 'Lote'}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPartForBatches(isExpanded ? null : p.id); }}
                        title="Ver Historial de Lotes de Compra"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-xs font-mono"
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                      <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 hidden sm:block" />
                    </div>
                  </div>
                </div>

                {/* Desplegable de Lotes de Compra Registrados */}
                {isExpanded && (
                  <div className="p-4 bg-zinc-950/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                        {language === 'es' ? 'Lotes de Compra & Precios Registrados' : language === 'en' ? 'Registered Purchase Batches & Prices' : language === 'it' ? 'Lotti d\'acquisto e prezzi registrati' : language === 'fr' ? 'Lots d\'Achat et Prix Enregistrés' : language === 'de' ? 'Erfasste Einkaufschargen & Preise' : 'Lotes de Compra e Preços Registados'} ({purchases.length})
                      </span>
                    </div>

                    {purchases.length > 0 ? (
                      <div className="space-y-1.5">
                        {purchases.map((b) => (
                          <div key={b.id} className="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                {formatQty(b.qty)} {p.unit || 'ud'}
                              </span>
                              <div>
                                <p className="font-semibold text-zinc-200">{b.supplier || 'Taller / Proveedor'}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">{language === 'es' ? 'Adquirido el' : language === 'en' ? 'Purchased on' : language === 'it' ? 'Acquistato il' : language === 'fr' ? 'Acheté le' : language === 'de' ? 'Gekauft am' : 'Adquirido em'} {b.date}</p>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-zinc-100 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
                              {b.pricePerUnit.toFixed(2)} {b.pricePerUnitCurrency || '€'} / {p.unit || 'ud'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No hay compras registradas para este repuesto.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredParts.length === 0 && (
            <div className="p-6 text-center text-xs text-zinc-500">
              No se encontraron repuestos registrados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
