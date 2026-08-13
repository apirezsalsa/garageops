// Lógica pura de matching de planes, separada de las llamadas a Firestore para poder testearla
// sin necesidad de un emulador. `plans` es un array de { id, ...datos del documento }.

// Encuentra el plan cuyo Price ID de Stripe (mensual o anual) coincide con el recibido del webhook
export function matchPlanByPriceId(plans, priceId) {
  for (const plan of plans) {
    if (plan.stripePriceIdMonthly === priceId) return { id: plan.id, billingCycle: 'monthly', ...plan };
    if (plan.stripePriceIdAnnual === priceId) return { id: plan.id, billingCycle: 'annual', ...plan };
  }
  return null;
}

// Plan al que se revierte a un usuario cuando su suscripción de pago termina o se cancela:
// el primer plan activo y gratuito (priceMonthly <= 0). 'starter' es el último recurso si no hay ninguno.
export function pickFallbackFreePlanId(plans) {
  const free = plans.find(p => !(p.priceMonthly > 0));
  return free?.id || 'starter';
}
