// Lógica pura para decidir qué alertas de un vehículo deben disparar una notificación push,
// separada de Firestore/Admin SDK para poder testearla sin emulador. Replica exactamente los
// mismos umbrales que ya usa la UI en web/src/App.jsx (isDue / isNear por uso y por fecha).

// Días restantes (negativo si ya venció) hasta una fecha objetivo dada.
export function daysUntil(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - todayMidnight.getTime()) / msPerDay);
}

// Para una alerta concreta de un vehículo, decide si está "vencida" o "próxima" ahora mismo.
export function isAlertTriggered(alert, vehicle, today = new Date()) {
  if (alert.type === 'date') {
    const days = daysUntil(alert.targetDate, today);
    return days !== null && days <= 0;
  }
  const current = vehicle.usageNum || 0;
  const diff = alert.targetUsage - current;
  const isDue = diff <= 0;
  const isNear = !isDue && diff <= (alert.advanceNotice || 0);
  return isDue || isNear;
}

// De todas las alertas de un vehículo, las que hay que notificar ahora: están vencidas/próximas
// y todavía no se avisaron (cada alerta dispara como mucho un push, una sola vez).
export function computeDueAlerts(vehicle, today = new Date()) {
  return (vehicle.alerts || []).filter(
    (alert) => !alert.notified && isAlertTriggered(alert, vehicle, today)
  );
}

// Título/cuerpo del push para un vehículo con una o más alertas nuevas que notificar.
export function buildNotificationPayload(vehicle, dueAlerts) {
  const title = `${vehicle.name || 'Vehículo'}: ${dueAlerts.length > 1 ? `${dueAlerts.length} alertas` : 'alerta'} pendiente${dueAlerts.length > 1 ? 's' : ''}`;
  const body = dueAlerts.map((a) => a.title).join(', ');
  return { title, body };
}
