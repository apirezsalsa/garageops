import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const auth = getAuth(app);
export const db = getFirestore(app);
