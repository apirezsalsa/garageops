import posthog from 'posthog-js';

// Analítica de producto y monitorización de errores (PostHog Cloud, EU, plan gratuito).
// Autocapture activado: clics, páginas vistas y excepciones del frontend se registran solos.
// Los eventos de negocio (onboarding, paywall, uso de funcionalidades clave) se disparan a mano, ver abajo.
const POSTHOG_KEY = 'phc_ytwwX6nGzz2HBZLyxrcVBKbwEA8KwmA6YvZ3ANRWK856';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: true,
    capture_exceptions: true,
    // Cookie en .mygarageops.com, no solo en app.: así quien llegó por la landing sigue siendo
    // el mismo visitante al registrarse aquí y el embudo visita → registro se ve entero.
    // Es el valor por defecto, pero se deja explícito porque sin esto el embudo se rompe.
    cross_subdomain_cookie: true,
  });
  posthog.register({ site: 'app' });
}

export function identifyUser(uid, props) {
  posthog.identify(uid, props);
}

export function resetAnalyticsUser() {
  posthog.reset();
}

export function trackEvent(name, props) {
  posthog.capture(name, props);
}

// Errores de React capturados por ErrorBoundary (los de window.onerror/unhandledrejection
// ya los recoge solo el autocapture de excepciones activado arriba)
export function reportError(error, context) {
  posthog.captureException(error, context);
}
