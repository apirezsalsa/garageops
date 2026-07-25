import { Platform } from 'react-native';

// In web, the API is relative to the app location, or we can use a hardcoded dev URL
// Assuming the web app is hosted at /garage
const BASE_URL = Platform.OS === 'web' 
    ? (window.location.hostname === 'localhost' ? 'http://localhost:8888/api/index.php' : '/api/index.php')
    : 'https://distritoenduro.com/api/index.php';

const getAuthToken = () => {
    if (Platform.OS === 'web') {
        const session = JSON.parse(localStorage.getItem('distrito_v2_session'));
        return session && session.user ? session.user.id : null;
    }
    return null;
};

export const request = async (endpoint, options = {}) => {
    const socioId = getAuthToken();
    const url = `${BASE_URL}?endpoint=garage/${endpoint}`;
    
    console.log(`[Web API] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': socioId ? `Bearer ${socioId}` : '',
            ...(options.headers || {})
        }
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `Error ${response.status}`);
    }
    return result.data;
};
