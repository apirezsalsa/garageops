import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

// Monitorización de errores sin servicio externo: cada error del frontend se guarda en
// Firestore (colección errorLogs). El coste es despreciable (unas pocas escrituras al día
// en un uso normal) y se puede consultar desde Firebase Console o desde el Backoffice.
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;

function logError(message, stack, extra) {
  try {
    addDoc(collection(db, 'errorLogs'), {
      message: String(message || 'Error desconocido').slice(0, MAX_MESSAGE_LENGTH),
      stack: String(stack || '').slice(0, MAX_STACK_LENGTH),
      url: window.location.href,
      userAgent: navigator.userAgent,
      uid: auth.currentUser?.uid || null,
      extra: extra || null,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // Si falla el propio logging (p.ej. sin conexión), no hacemos nada más: no queremos
      // provocar un bucle de errores intentando reportar el fallo del reporte de errores.
    });
  } catch {
    // noop
  }
}

export function initErrorMonitoring() {
  window.addEventListener('error', (event) => {
    logError(event.message, event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logError(reason?.message || String(reason), reason?.stack);
  });
}

export function reportError(error, context) {
  logError(error?.message || String(error), error?.stack, context);
}
