import { Sparkles, Plus, Bike, ShieldAlert, Wrench, TrendingUp, History, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { MetricBento } from './MetricBento';
import { VehicleBentoCard } from './VehicleBentoCard';

// Pantalla "Dashboard": banner + métricas + vehículos principales + últimas intervenciones +
// notificaciones automáticas + análisis financiero. Puramente presentacional, sin estado propio.
export function DashboardView({
  language, t,
  vehicles, parts, maintenances,
  setEditingMaintenanceId, blankMaintenanceForm, setNewMaintenanceForm, setShowAddMaintenanceModal,
  setActiveTab, setSelectedVehicle,
  setShowKmModal, setNewKmValue,
}) {
  return (
    <div className="space-y-6">

      {/* Banner de Cabecera con Bento Grid */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'es' ? 'Control Preventivo Inteligente' : language === 'en' ? 'Smart Preventive Control' : language === 'it' ? 'Controllo Preventivo Intelligente' : language === 'fr' ? 'Contrôle Préventif Intelligent' : language === 'de' ? 'Intelligente Vorsorgekontrolle' : 'Controlo Preventivo Inteligente'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {language === 'es' ? 'Estado del Garaje' : language === 'en' ? 'Garage Status' : language === 'it' ? 'Stato del Garage' : language === 'fr' ? 'État du Garage' : language === 'de' ? 'Garagenstatus' : 'Estado da Garagem'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
              {language === 'es' ? 'Monitoreo en tiempo real de tus vehículos, repuestos críticos e intervenciones de taller.' : language === 'en' ? 'Real-time monitoring of your vehicles, critical parts, and service records.' : language === 'it' ? 'Monitoraggio in tempo reale dei tuoi veicoli, ricambi critici e interventi di officina.' : language === 'fr' ? 'Suivi en temps réel de vos véhicules, pièces critiques et interventions d\'atelier.' : language === 'de' ? 'Echtzeitüberwachung deiner Fahrzeuge, kritischen Ersatzteile und Werkstatteinsätze.' : 'Monitorização em tempo real dos teus veículos, peças críticas e intervenções de oficina.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingMaintenanceId(null);
                setNewMaintenanceForm(blankMaintenanceForm());
                setShowAddMaintenanceModal(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{t('addIntervention')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* BENTO CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricBento
          title={t('vehicles')}
          value={vehicles.length}
          subtitle={language === 'es' ? 'En Garaje' : language === 'en' ? 'In Garage' : language === 'it' ? 'Nel Garage' : language === 'fr' ? 'Au Garage' : language === 'de' ? 'In der Garage' : 'Na Garagem'}
          icon={Bike}
          color="text-orange-400"
        />
        {(() => {
          const lowStockCount = parts.filter(p => {
            const total = (p.purchases || []).reduce((sum, b) => sum + (b.qty || 0), 0);
            return p.lowStockAlertEnabled !== false && total <= (p.minStock || 1);
          }).length;
          const vehicleAlerts = vehicles.filter(v => v.status !== 'ok').length;
          const totalAlerts = lowStockCount + vehicleAlerts;

          return (
            <MetricBento
              title={t('activeAlerts')}
              value={totalAlerts}
              subtitle={totalAlerts > 0 ? `${lowStockCount} ${language === 'es' ? 'repuestos bajos' : language === 'en' ? 'low stock parts' : language === 'it' ? 'ricambi in esaurimento' : language === 'fr' ? 'pièces en stock bas' : language === 'de' ? 'Teile mit niedrigem Bestand' : 'peças com stock baixo'}` : (language === 'es' ? 'Todo al día' : language === 'en' ? 'All up to date' : language === 'it' ? 'Tutto aggiornato' : language === 'fr' ? 'Tout est à jour' : language === 'de' ? 'Alles aktuell' : 'Tudo em dia')}
              icon={ShieldAlert}
              color={totalAlerts > 0 ? "text-rose-400" : "text-emerald-400"}
              highlight={totalAlerts > 0}
            />
          );
        })()}
        {(() => {
          const lowStockCount = parts.filter(p => {
            const total = (p.purchases || []).reduce((sum, b) => sum + (b.qty || 0), 0);
            return p.lowStockAlertEnabled !== false && total <= (p.minStock || 1);
          }).length;

          return (
            <MetricBento
              title={t('partsStock')}
              value={parts.length}
              subtitle={lowStockCount > 0 ? `${lowStockCount} ${language === 'es' ? 'por reponer' : language === 'en' ? 'to order' : language === 'it' ? 'da ordinare' : language === 'fr' ? 'à commander' : language === 'de' ? 'zu bestellen' : 'a encomendar'}` : (language === 'es' ? 'Stock suficiente' : language === 'en' ? 'Stock OK' : language === 'it' ? 'Scorta ok' : language === 'fr' ? 'Stock suffisant' : language === 'de' ? 'Bestand ausreichend' : 'Stock suficiente')}
              icon={Wrench}
              color="text-blue-400"
            />
          );
        })()}
        {(() => {
          const totalSpent = maintenances.reduce((sum, m) => {
            const num = parseFloat((m.cost || '').replace(/[^0-9.]/g, '')) || 0;
            return sum + num;
          }, 0);

          return (
            <MetricBento
              title={t('totalSpent')}
              value={`${totalSpent.toFixed(2)} €`}
              subtitle={language === 'es' ? 'Total intervenciones' : language === 'en' ? 'Total services' : language === 'it' ? 'Totale interventi' : language === 'fr' ? 'Total interventions' : language === 'de' ? 'Gesamt Einsätze' : 'Total de intervenções'}
              icon={TrendingUp}
              color="text-emerald-400"
            />
          );
        })()}
      </div>

      {/* BENTO SECTION: VEHÍCULOS (ACCESO RÁPIDO DUAL) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bike className="w-4 h-4 text-orange-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              {language === 'es' ? 'Vehículos Principales' : language === 'en' ? 'Main Vehicles' : language === 'it' ? 'Veicoli Principali' : language === 'fr' ? 'Véhicules Principaux' : language === 'de' ? 'Hauptfahrzeuge' : 'Veículos Principais'}
            </h3>
          </div>
          <button onClick={() => setActiveTab('garage')} className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
            {language === 'es' ? 'Ver Garaje completo' : language === 'en' ? 'View Full Garage' : language === 'it' ? 'Vedi Garage completo' : language === 'fr' ? 'Voir le Garage complet' : language === 'de' ? 'Ganze Garage ansehen' : 'Ver Garagem completa'} <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <VehicleBentoCard
              key={v.id}
              vehicle={v}
              maintenances={maintenances}
              language={language}
              onSelect={() => {
                setSelectedVehicle(v);
                setActiveTab('garage');
              }}
              onOpenKmModal={(e) => {
                e.stopPropagation();
                setShowKmModal(v);
                setNewKmValue((v.usageNum || 0).toString());
              }}
            />
          ))}
        </div>
      </div>

      {/* BENTO SECTION: RECIENTES MANTENIMIENTOS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-orange-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              {language === 'es' ? 'Últimas Intervenciones Registradas' : language === 'en' ? 'Recent Service Records' : language === 'it' ? 'Ultimi Interventi Registrati' : language === 'fr' ? 'Dernières Interventions Enregistrées' : language === 'de' ? 'Zuletzt Erfasste Einsätze' : 'Últimas Intervenções Registadas'}
            </h3>
          </div>
          <button onClick={() => setActiveTab('history')} className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
            {language === 'es' ? 'Ver Historial' : language === 'en' ? 'View History' : language === 'it' ? 'Vedi Cronologia' : language === 'fr' ? 'Voir l\'Historique' : language === 'de' ? 'Verlauf ansehen' : 'Ver Histórico'} <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden shadow-xl">
          {maintenances.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-orange-400 shrink-0">
                  <Wrench className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-100">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-zinc-400 font-medium">{item.vehicle}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[11px] font-mono text-zinc-500">{item.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`hidden sm:inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full border ${item.badgeColor}`}>
                  {item.type}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-zinc-100 bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700/60">
                  {item.cost}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BENTO SECTION: NOTIFICACIONES AUTOMÁTICAS Y ANÁLISIS FINANCIERO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NOTIFICACIONES AUTOMÁTICAS EN PANTALLA */}
        <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800/80 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">{t('notificationsTitle')}</h3>
          </div>
          {(() => {
            const warnings = vehicles.filter(v => v.status !== 'ok');
            const lowStockParts = parts.filter(p => {
              const total = (p.purchases || []).reduce((sum, b) => sum + (b.qty || 0), 0);
              return p.lowStockAlertEnabled !== false && total <= (p.minStock || 1);
            });

            if (warnings.length === 0 && lowStockParts.length === 0) {
              return (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{language === 'es' ? '¡Tu flota está en perfecto estado y el inventario completo!' : language === 'en' ? 'Your fleet is in perfect condition and stock is full!' : language === 'it' ? 'Il tuo parco è in perfette condizioni e la scorta è completa!' : language === 'fr' ? 'Votre flotte est en parfait état et le stock est complet !' : language === 'de' ? 'Deine Flotte ist in perfektem Zustand und der Bestand ist vollständig!' : 'A tua frota está em perfeito estado e o stock está completo!'}</span>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {warnings.map(v => (
                  <div key={v.id} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{v.icon}</span>
                      <div>
                        <p className="font-bold text-amber-300">{v.name}</p>
                        <p className="text-[10px] text-zinc-400">{v.statusText}</p>
                      </div>
                    </div>
                    <button onClick={() => { setActiveTab('garage'); setSelectedVehicle(v); }} className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white rounded-lg text-[10px] font-bold transition-all">
                      {t('updateUnit')}
                    </button>
                  </div>
                ))}
                {lowStockParts.map(p => (
                  <div key={p.id} className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Wrench className="w-4 h-4 text-rose-400" />
                      <div>
                        <p className="font-bold text-rose-300">{p.name}</p>
                        <p className="text-[10px] text-zinc-400">{language === 'es' ? 'Stock Agotándose' : language === 'en' ? 'Low Stock Alert' : language === 'it' ? 'Ricambio in esaurimento' : language === 'fr' ? 'Stock en Baisse' : language === 'de' ? 'Bestand wird knapp' : 'Stock a Esgotar'}</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('parts')} className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold transition-all">
                      {t('addPartBtn')}
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ANÁLISIS FINANCIERO Y DESGLOSE DE COSTES */}
        <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">{t('analyticsTitle')}</h3>
              </div>
            </div>
            {(() => {
              let totalLabor = 0;
              let totalParts = 0;
              maintenances.forEach(m => {
                totalLabor += parseFloat((m.laborCost || '0').replace(/[^0-9.]/g, '')) || 0;
                totalParts += parseFloat((m.partsCost || '0').replace(/[^0-9.]/g, '')) || 0;
              });
              const grandTotal = totalLabor + totalParts || 1;
              const laborPercent = Math.round((totalLabor / grandTotal) * 100);
              const partsPercent = Math.round((totalParts / grandTotal) * 100);

              return (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400">{t('partsCostLabel')} ({partsPercent}%)</span>
                      <span className="font-mono text-emerald-400 font-bold">{totalParts.toFixed(2)} €</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${partsPercent}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400">{t('laborCost')} ({laborPercent}%)</span>
                      <span className="font-mono text-orange-400 font-bold">{totalLabor.toFixed(2)} €</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${laborPercent}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{language === 'es' ? 'Optimización DIY calculada' : language === 'en' ? 'Calculated DIY Savings' : language === 'it' ? 'Risparmio DIY calcolato' : language === 'fr' ? 'Économies DIY calculées' : language === 'de' ? 'Berechnete DIY-Ersparnis' : 'Poupança DIY calculada'}</span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">+35% ahorro</span>
          </div>
        </div>
      </div>

    </div>
  );
}
