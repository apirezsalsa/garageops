import * as Sentry from '@sentry/react';

// Solo se activa si existe VITE_SENTRY_DSN en el entorno de build (.env, o variable de Firebase Hosting/CI).
// Sin DSN configurado, esto no hace nada: no hay cuenta de Sentry creada todavía.
export function initErrorMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
