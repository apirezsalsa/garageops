import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

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
// De momento sin "enforcement" activado en Firestore/Functions: solo empieza a emitir tokens
// para poder comprobar en la consola que las peticiones se verifican bien antes de bloquear
// las que no los lleven.
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeMLIMtAAAAAEmcUp2aKhobFi7SDZNlJtG7s9DH'),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
