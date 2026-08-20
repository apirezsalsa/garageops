import { Plus, Bike } from 'lucide-react';
import { VehicleBentoCard } from './VehicleBentoCard';

// Pantalla "Garaje" (listado): grid de vehículos + botón para añadir uno nuevo.
// Puramente presentacional, sin estado propio.
export function GarageList({
  t, language, currencySymbol,
  vehicles, maintenances,
  setEditingVehicleId, setNewVehicleForm, setShowAddVehicleModal,
  setSelectedVehicle,
  setShowKmModal, setNewKmValue, setNewSecondaryKmValue,
  requestDeleteVehicle,
}) {
  const handleOpenAdd = () => {
    setEditingVehicleId(null);
    setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '', nextInspectionDate: '', licensePlate: '', insuranceCompany: '' });
    setShowAddVehicleModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('garage')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Control individual de cada vehículo registrado.' : language === 'en' ? 'Individual control for each registered vehicle.' : language === 'it' ? 'Controllo individuale per ogni veicolo registrato.' : language === 'fr' ? 'Contrôle individuel de chaque véhicule enregistré.' : language === 'de' ? 'Individuelle Kontrolle für jedes registrierte Fahrzeug.' : 'Controlo individual de cada veículo registado.'}</p>
        </div>
        {vehicles.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('addVehicleBtn')}</span>
          </button>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-zinc-900/60 rounded-3xl border border-dashed border-zinc-800 p-8 sm:p-14 text-center flex flex-col items-center justify-center shadow-xl">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-5 shadow-xl shadow-orange-500/10">
            <Bike className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.5]" />
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white mb-2">{t('emptyGarageTitle')}</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
            {t('emptyGarageDesc')}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm shadow-xl shadow-orange-500/25 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('addFirstVehicleBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <VehicleBentoCard
              key={v.id}
              vehicle={v}
              maintenances={maintenances}
              language={language}
              currencySymbol={currencySymbol}
              onSelect={() => setSelectedVehicle(v)}
              onOpenKmModal={(e) => {
                e.stopPropagation();
                setShowKmModal(v);
                setNewKmValue((v.usageNum || 0).toString());
                setNewSecondaryKmValue(v.secondaryUsageNum != null ? String(v.secondaryUsageNum) : '');
              }}
              onDelete={requestDeleteVehicle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
