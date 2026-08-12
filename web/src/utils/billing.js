// Un Pase Regalo (giftDays > 0) da acceso a un plan de pago sin cobro real, así que nunca cuenta como ingreso
export function isGiftedAccess(user) {
  return (user?.giftDays || 0) > 0;
}

export function computePlanStats(users, plansById) {
  const nonAdmins = users.filter(u => u.role !== 'admin');

  const paidUsers = nonAdmins.filter(u => !isGiftedAccess(u) && (plansById[u.plan]?.priceMonthly > 0)).length;
  const freeUsers = nonAdmins.filter(u => isGiftedAccess(u) || !(plansById[u.plan]?.priceMonthly > 0)).length;
  const conversionRate = users.length > 0 ? Math.round((paidUsers / users.length) * 100) : 0;

  const mrr = nonAdmins.reduce((sum, u) => {
    if (isGiftedAccess(u)) return sum;
    return sum + (plansById[u.plan]?.priceMonthly || 0);
  }, 0);

  return { mrr, paidUsers, freeUsers, conversionRate };
}

// Límite de vehículos del plan: -1 significa ilimitado
export function isUnderVehicleLimit(plan, currentVehicleCount) {
  if (!plan) return false;
  if (plan.maxVehicles === -1) return true;
  return currentVehicleCount < plan.maxVehicles;
}
