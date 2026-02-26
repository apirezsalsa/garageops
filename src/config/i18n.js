import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// Import translations
import es from '../locales/es.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import it from '../locales/it.json';
import pt from '../locales/pt.json';

const resources = {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr },
    de: { translation: de },
    it: { translation: it },
    pt: { translation: pt },
};

const STORE_LANGUAGE_KEY = 'settings.lang';

const languageDetector = {
    type: 'languageDetector',
    async: true,
    init: () => { },
    detect: async (callback) => {
        try {
            // Get stored language from Async storage
            const language = await AsyncStorage.getItem(STORE_LANGUAGE_KEY);
            if (language) {
                // If language was stored before, use this language in the app
                return callback(language);
            } else {
                // If language was not stored yet, use device's locale
                const locales = Localization.getLocales();
                if (locales && locales.length > 0) {
                    // Use only the language code (e.g. 'es' from 'es-ES')
                    return callback(locales[0].languageCode.split('-')[0]);
                }
                return callback('es');
            }
        } catch (error) {
            console.log('Error reading language', error);
            callback('es');
        }
    },
    cacheUserLanguage: async (language) => {
        try {
            // Save a user's language choice in Async storage
            await AsyncStorage.setItem(STORE_LANGUAGE_KEY, language);
        } catch (error) { }
    }
};

i18n
    .use(initReactI18next)
    .use(languageDetector)
    .init({
        resources,
        fallbackLng: 'es', // Fallback to Spanish if language not found
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false, // For safety in React Native
        }
    });

export default i18n;
