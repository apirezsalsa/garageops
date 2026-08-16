import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

// Reutilizamos el mismo proyecto Firebase de la app móvil (garageops-6511f)
const firebaseConfig = {
  apiKey: "AIzaSyBFI60elQ9espDdquI9tnSipbNFN_lfsxI",
  authDomain: "garageops-6511f.firebaseapp.com",
  projectId: "garageops-6511f",
  storageBucket: "garageops-6511f.firebasestorage.app",
  messagingSenderId: "1077063710094",
  appId: "1:1077063710094:web:911bc7f65d9fe43159e0df"
};

const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3, clave del sitio registrada en Firebase Console → App Check).
// Enforce activado en Firestore, Authentication y en las Cloud Functions callable sensibles.
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeMLIMtAAAAAEmcUp2aKhobFi7SDZNlJtG7s9DH'),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Clave pública de Web Push (Firebase Console → Configuración del proyecto → Cloud Messaging →
// "Certificados push web"). No es un secreto, igual que el resto de firebaseConfig.
export const VAPID_KEY = 'BMbTyphLTrS6LhgZlGB2iZtubi5hhSLC5qQl4tZU5wcpZIKhZH6Fe5TkBuNfLv642R6GoVl_oxbw96KucHbiETc';

// Firebase Messaging no está soportado en todos los navegadores/contextos (p.ej. Safari fuera
// de una PWA instalada en pantalla de inicio), así que se resuelve de forma perezosa y segura.
let messagingInstance = null;
export const getMessagingIfSupported = async () => {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
};
