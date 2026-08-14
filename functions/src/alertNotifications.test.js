import { describe, it, expect } from 'vitest';
import { daysUntil, isAlertTriggered, computeDueAlerts, buildNotificationPayload } from './alertNotifications.js';

const TODAY = new Date('2026-08-15T10:00:00Z');

describe('daysUntil', () => {
  it('devuelve null si no hay fecha', () => {
    expect(daysUntil(null, TODAY)).toBeNull();
    expect(daysUntil('fecha-invalida', TODAY)).toBeNull();
  });

  it('cuenta días positivos hacia el futuro', () => {
    expect(daysUntil('2026-08-20', TODAY)).toBe(5);
  });

  it('cuenta días negativos si ya pasó', () => {
    expect(daysUntil('2026-08-10', TODAY)).toBe(-5);
  });

  it('es 0 el mismo día', () => {
    expect(daysUntil('2026-08-15', TODAY)).toBe(0);
  });
});

describe('isAlertTriggered', () => {
  const vehicle = { usageNum: 1000 };

  it('alerta por uso: no vencida ni próxima', () => {
    const alert = { type: 'usage', targetUsage: 2000, advanceNotice: 50 };
    expect(isAlertTriggered(alert, vehicle, TODAY)).toBe(false);
  });

  it('alerta por uso: próxima (dentro del margen de aviso)', () => {
    const alert = { type: 'usage', targetUsage: 1030, advanceNotice: 50 };
    expect(isAlertTriggered(alert, vehicle, TODAY)).toBe(true);
  });

  it('alerta por uso: vencida', () => {
    const alert = { type: 'usage', targetUsage: 900, advanceNotice: 50 };
    expect(isAlertTriggered(alert, vehicle, TODAY)).toBe(true);
  });

  it('alerta por fecha: futura, no dispara', () => {
    const alert = { type: 'date', targetDate: '2026-09-01' };
    expect(isAlertTriggered(alert, vehicle, TODAY)).toBe(false);
  });

  it('alerta por fecha: hoy, dispara', () => {
    const alert = { type: 'date', targetDate: '2026-08-15' };
    expect(isAlertTriggered(alert, vehicle, TODAY)).toBe(true);
  });

  it('alerta por fecha: ya pasada, dispara', () => {
    const alert = { type: 'date', targetDate: '2026-08-01' };
    expect(isAlertTriggered(alert, vehicle, TODAY)).toBe(true);
  });
});

describe('computeDueAlerts', () => {
  it('ignora alertas ya notificadas aunque estén vencidas', () => {
    const vehicle = {
      usageNum: 1000,
      alerts: [
        { id: 1, type: 'usage', targetUsage: 900, advanceNotice: 50, notified: true },
        { id: 2, type: 'date', targetDate: '2026-08-01', notified: false },
      ],
    };
    const due = computeDueAlerts(vehicle, TODAY);
    expect(due.map((a) => a.id)).toEqual([2]);
  });

  it('devuelve vacío si no hay alertas', () => {
    expect(computeDueAlerts({ usageNum: 1000 }, TODAY)).toEqual([]);
  });
});

describe('buildNotificationPayload', () => {
  it('singular para una sola alerta', () => {
    const vehicle = { name: 'KTM EXC 300' };
    const payload = buildNotificationPayload(vehicle, [{ title: 'Cambio de aceite' }]);
    expect(payload.title).toBe('KTM EXC 300: alerta pendiente');
    expect(payload.body).toBe('Cambio de aceite');
  });

  it('plural para varias alertas', () => {
    const vehicle = { name: 'KTM EXC 300' };
    const payload = buildNotificationPayload(vehicle, [{ title: 'Cambio de aceite' }, { title: 'ITV' }]);
    expect(payload.title).toBe('KTM EXC 300: 2 alertas pendientes');
    expect(payload.body).toBe('Cambio de aceite, ITV');
  });
});
