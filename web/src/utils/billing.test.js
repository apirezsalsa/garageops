import { describe, it, expect } from 'vitest';
import { computePlanStats, isGiftedAccess, isUnderVehicleLimit } from './billing';

const plansById = {
  free: { priceMonthly: 0, maxVehicles: 1 },
  rat: { priceMonthly: 3.99, maxVehicles: 4 },
  unlimited: { priceMonthly: 9.99, maxVehicles: -1 },
};

describe('isGiftedAccess', () => {
  it('es true cuando giftDays es mayor que 0', () => {
    expect(isGiftedAccess({ giftDays: 30 })).toBe(true);
  });

  it('es false cuando no hay giftDays', () => {
    expect(isGiftedAccess({})).toBe(false);
    expect(isGiftedAccess({ giftDays: 0 })).toBe(false);
  });
});

describe('computePlanStats', () => {
  it('cuenta como ingreso a los usuarios de pago reales', () => {
    const users = [
      { role: 'user', plan: 'rat' },
      { role: 'user', plan: 'unlimited' },
      { role: 'user', plan: 'free' },
    ];
    const stats = computePlanStats(users, plansById);
    expect(stats.paidUsers).toBe(2);
    expect(stats.freeUsers).toBe(1);
    expect(stats.mrr).toBeCloseTo(3.99 + 9.99);
  });

  it('excluye del MRR y de "usuarios de pago" a quien tiene un Pase Regalo activo', () => {
    const users = [
      { role: 'user', plan: 'unlimited', giftDays: 30 },
      { role: 'user', plan: 'rat' },
    ];
    const stats = computePlanStats(users, plansById);
    expect(stats.mrr).toBeCloseTo(3.99);
    expect(stats.paidUsers).toBe(1);
    expect(stats.freeUsers).toBe(1);
  });

  it('ignora a los administradores', () => {
    const users = [
      { role: 'admin', plan: 'unlimited' },
      { role: 'user', plan: 'free' },
    ];
    const stats = computePlanStats(users, plansById);
    expect(stats.mrr).toBe(0);
    expect(stats.paidUsers).toBe(0);
    expect(stats.freeUsers).toBe(1);
  });

  it('calcula la conversión a pago sobre el total de usuarios (incluidos admins)', () => {
    const users = [
      { role: 'admin', plan: 'unlimited' },
      { role: 'user', plan: 'rat' },
      { role: 'user', plan: 'free' },
    ];
    const stats = computePlanStats(users, plansById);
    expect(stats.conversionRate).toBe(33); // 1 de pago / 3 usuarios totales
  });
});

describe('isUnderVehicleLimit', () => {
  it('permite añadir mientras no se alcance el límite del plan', () => {
    expect(isUnderVehicleLimit(plansById.rat, 3)).toBe(true);
    expect(isUnderVehicleLimit(plansById.rat, 4)).toBe(false);
  });

  it('siempre permite añadir en un plan ilimitado (maxVehicles -1)', () => {
    expect(isUnderVehicleLimit(plansById.unlimited, 999)).toBe(true);
  });

  it('devuelve false si no hay plan', () => {
    expect(isUnderVehicleLimit(undefined, 0)).toBe(false);
  });
});
