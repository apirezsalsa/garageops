// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBFI60elQ9espDdquI9tnSipbNFN_lfsxI",
    authDomain: "garageops-6511f.firebaseapp.com",
    projectId: "garageops-6511f",
    storageBucket: "garageops-6511f.firebasestorage.app",
    messagingSenderId: "1077063710094",
    appId: "1:1077063710094:web:911bc7f65d9fe43159e0df"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth based on platform
export const auth = Platform.OS === 'web' 
    ? getAuth(app) 
    : initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
export const db = getFirestore(app);
export const storage = getStorage(app);
