// Convierte cualquier representación de fecha (Timestamp de Firestore, string ISO, Date) a milisegundos epoch
export const toDateMs = (val, fallbackMs) => {
  if (!val) return fallbackMs;
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  const ms = new Date(val).getTime();
  return isNaN(ms) ? fallbackMs : ms;
};

// Suma N meses a una fecha respetando desbordes de fin de mes
export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// Calcula la próxima fecha de renovación (>= ahora) anclada a la fecha de alta original del plan
export const computeNextRenewal = (startMs, billingCycle, now = Date.now()) => {
  const step = billingCycle === 'annual' ? 12 : 1;
  let renewal = new Date(startMs || now);
  if (isNaN(renewal.getTime())) renewal = new Date(now);
  while (renewal.getTime() <= now) {
    renewal = addMonths(renewal, step);
  }
  return renewal;
};

// Etiqueta de la inspección técnica obligatoria según idioma (varía mucho por país: ITV en España,
// MOT en Reino Unido, TÜV en Alemania, y en EEUU depende de cada estado, por eso el término genérico en inglés)
const INSPECTION_LABELS = {
  es: 'ITV',
  en: 'Vehicle Inspection',
  it: 'Revisione',
  fr: 'Contrôle Technique',
  de: 'TÜV',
  pt: 'Inspeção Veicular'
};
export const getInspectionLabel = (language) => INSPECTION_LABELS[language] || INSPECTION_LABELS.es;

// Días restantes (negativo si ya venció) hasta la fecha de inspección obligatoria del vehículo
export const getInspectionStatus = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / msPerDay);
  const urgency = days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok';
  return { days, urgency };
};
