import { Plus } from 'lucide-react';
import { VehicleBentoCard } from './VehicleBentoCard';

// Pantalla "Garaje" (listado): grid de vehículos + botón para añadir uno nuevo.
// Puramente presentacional, sin estado propio.
export function GarageList({
  t, language,
  vehicles, maintenances,
  setEditingVehicleId, setNewVehicleForm, setShowAddVehicleModal,
  setSelectedVehicle,
  setShowKmModal, setNewKmValue,
  requestDeleteVehicle,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('garage')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Control individual de cada vehículo registrado.' : language === 'en' ? 'Individual control for each registered vehicle.' : language === 'it' ? 'Controllo individuale per ogni veicolo registrato.' : language === 'fr' ? 'Contrôle individuel de chaque véhicule enregistré.' : language === 'de' ? 'Individuelle Kontrolle für jedes registrierte Fahrzeug.' : 'Controlo individual de cada veículo registado.'}</p>
        </div>
        <button
          onClick={() => {
            setEditingVehicleId(null);
            setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '' });
            setShowAddVehicleModal(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t('addVehicleBtn')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <VehicleBentoCard
            key={v.id}
            vehicle={v}
            maintenances={maintenances}
            language={language}
            onSelect={() => setSelectedVehicle(v)}
            onOpenKmModal={(e) => {
              e.stopPropagation();
              setShowKmModal(v);
              setNewKmValue((v.usageNum || 0).toString());
            }}
            onDelete={requestDeleteVehicle}
          />
        ))}
      </div>
    </div>
  );
}
