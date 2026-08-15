// Paleta fija de colores de badge para planes (Tailwind purga clases que no puede detectar
// estáticamente, así que no se puede construir el nombre de la clase a partir de datos dinámicos).
export const PLAN_COLOR_STYLES = {
  zinc: { badge: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30', ring: 'border-zinc-700' },
  orange: { badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', ring: 'border-orange-500/60' },
  amber: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', ring: 'border-amber-500/60' },
  emerald: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', ring: 'border-emerald-500/60' },
  sky: { badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30', ring: 'border-sky-500/60' },
  violet: { badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30', ring: 'border-violet-500/60' },
};
export const DEFAULT_PLAN_COLOR = 'zinc';

// Idiomas soportados para los campos traducibles de un plan (tagline y features)
export const PLAN_LANGUAGES = ['es', 'en', 'it', 'fr', 'de', 'pt'];

// Devuelve el texto de un campo multi-idioma de un plan (p.ej. tagline) para el idioma dado.
// Compatibilidad hacia atrás: los planes creados antes de soportar 6 idiomas guardan tagline como
// un string suelto en vez de un objeto {es, en, it, fr, de, pt} — en ese caso se usa tal cual, sea cual sea el idioma.
export const getLocalizedPlanText = (value, language) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.es || Object.values(value).find(Boolean) || '';
};

// Igual que getLocalizedPlanText pero para arrays (features de un plan)
export const getLocalizedPlanList = (value, language) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value[language] || value.es || Object.values(value).find(v => Array.isArray(v) && v.length) || [];
};

// Mientras no haya pasarela de pago real integrada, los usuarios no pueden autoasignarse un plan de pago:
// solo pueden quedarse en un plan gratuito o pedir a un admin que se lo otorgue desde el Backoffice.
export const PAYMENT_GATEWAY_ENABLED = true;

// Planes de siembra inicial (se escriben una sola vez en Firestore si la colección 'plans' está vacía)
export const SEED_PLANS = [
  {
    id: 'starter',
    name: 'DIY Starter',
    priceMonthly: 0,
    priceAnnual: 0,
    maxVehicles: 2,
    badgeColor: 'zinc',
    highlight: false,
    tagline: {
      es: 'Para tu vehículo principal', en: 'For your main vehicle', it: 'Per il tuo veicolo principale',
      fr: 'Pour votre véhicule principal', de: 'Für dein Hauptfahrzeug', pt: 'Para o teu veículo principal'
    },
    features: {
      es: ['Historial de mantenimiento básico', 'Soporte por comunidad'],
      en: ['Basic maintenance history', 'Community support'],
      it: ['Cronologia di manutenzione base', 'Supporto della community'],
      fr: ["Historique d'entretien basique", 'Support communautaire'],
      de: ['Einfache Wartungshistorie', 'Community-Support'],
      pt: ['Histórico de manutenção básico', 'Suporte da comunidade']
    },
    isDefaultSignup: true,
    active: true,
    order: 0
  },
  {
    id: 'pro',
    name: 'DIY Garage',
    priceMonthly: 4.99,
    priceAnnual: 3.99,
    maxVehicles: 4,
    badgeColor: 'orange',
    highlight: true,
    tagline: {
      es: 'Particulares con 2 a 4 vehículos', en: 'For 2 to 4 vehicles', it: 'Per privati con 2-4 veicoli',
      fr: 'Pour les particuliers avec 2 à 4 véhicules', de: 'Für Privatpersonen mit 2 bis 4 Fahrzeugen', pt: 'Para particulares com 2 a 4 veículos'
    },
    features: {
      es: ['Alertas de mantenimiento', 'Gestión de repuestos', 'Soporte prioritario'],
      en: ['Maintenance alerts', 'Parts management', 'Priority support'],
      it: ['Avvisi di manutenzione', 'Gestione ricambi', 'Supporto prioritario'],
      fr: ["Alertes d'entretien", 'Gestion des pièces', 'Support prioritaire'],
      de: ['Wartungserinnerungen', 'Ersatzteilverwaltung', 'Prioritäts-Support'],
      pt: ['Alertas de manutenção', 'Gestão de peças', 'Suporte prioritário']
    },
    isDefaultSignup: false,
    active: true,
    order: 1
  },
  {
    id: 'unlimited',
    name: 'Garage Unlimited',
    priceMonthly: 9.99,
    priceAnnual: 7.99,
    maxVehicles: -1,
    badgeColor: 'amber',
    highlight: false,
    tagline: {
      es: 'Sin límites para gran garaje o taller', en: 'No limits, for big garages or shops', it: 'Senza limiti, per grandi garage o officine',
      fr: 'Sans limites, pour grands garages ou ateliers', de: 'Ohne Limits, für große Garagen oder Werkstätten', pt: 'Sem limites, para grandes garagens ou oficinas'
    },
    features: {
      es: ['Alertas de mantenimiento', 'Gestión de repuestos', 'Soporte prioritario 24/7'],
      en: ['Maintenance alerts', 'Parts management', '24/7 priority support'],
      it: ['Avvisi di manutenzione', 'Gestione ricambi', 'Supporto prioritario 24/7'],
      fr: ["Alertes d'entretien", 'Gestion des pièces', 'Support prioritaire 24/7'],
      de: ['Wartungserinnerungen', 'Ersatzteilverwaltung', '24/7 Prioritäts-Support'],
      pt: ['Alertas de manutenção', 'Gestão de peças', 'Suporte prioritário 24/7']
    },
    isDefaultSignup: false,
    active: true,
    order: 2
  }
];
