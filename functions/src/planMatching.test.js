import { describe, it, expect } from 'vitest';
import { matchPlanByPriceId, pickFallbackFreePlanId } from './planMatching.js';

const plans = [
  { id: 'starter', priceMonthly: 0, active: true },
  { id: 'pro', priceMonthly: 3.99, stripePriceIdMonthly: 'price_rat_mo', stripePriceIdAnnual: 'price_rat_yr', active: true },
  { id: 'unlimited', priceMonthly: 9.99, stripePriceIdMonthly: 'price_unl_mo', stripePriceIdAnnual: 'price_unl_yr', active: true },
];

describe('matchPlanByPriceId', () => {
  it('encuentra el plan y marca billingCycle mensual', () => {
    const result = matchPlanByPriceId(plans, 'price_rat_mo');
    expect(result.id).toBe('pro');
    expect(result.billingCycle).toBe('monthly');
  });

  it('encuentra el plan y marca billingCycle anual', () => {
    const result = matchPlanByPriceId(plans, 'price_unl_yr');
    expect(result.id).toBe('unlimited');
    expect(result.billingCycle).toBe('annual');
  });

  it('devuelve null si el priceId no coincide con ningún plan', () => {
    expect(matchPlanByPriceId(plans, 'price_inexistente')).toBeNull();
  });
});

describe('pickFallbackFreePlanId', () => {
  it('elige el primer plan gratuito activo', () => {
    expect(pickFallbackFreePlanId(plans)).toBe('starter');
  });

  it('recurre a "starter" si no hay ningún plan gratuito en la lista', () => {
    const soloPago = plans.filter(p => p.priceMonthly > 0);
    expect(pickFallbackFreePlanId(soloPago)).toBe('starter');
  });
});
