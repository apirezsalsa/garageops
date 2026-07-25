import { Platform } from 'react-native';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads an image to Firebase or Web Server.
 * @param {string} uri - The local URI or base64.
 * @param {string} path - The relative path/filename.
 */
export const uploadImage = async (uri, path) => {
    if (!uri) return null;

    const isLocal = uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:');
    if (!isLocal) return uri;

    // --- Web Bridge: Upload to Distrito Enduro Server ---
    if (Platform.OS === 'web') {
        try {
            const formData = new FormData();
            
            // Convert base64 or URI to blob/file
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('image', blob, 'image.jpg');

            const session = JSON.parse(localStorage.getItem('distrito_v2_session'));
            const socioId = session?.user?.id;

            const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:8888/api/index.php' : '/api/index.php';
            const uploadUrl = `${apiBase}?endpoint=upload`;

            const res = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': socioId ? `Bearer ${socioId}` : ''
                },
                body: formData
            });

            const result = await res.json();
            if (res.ok && result.data?.url) {
                return result.data.url;
            } else {
                console.error("Upload error server response:", result);
                return uri;
            }
        } catch (error) {
            console.error("Error uploading image to web server:", error);
            return uri;
        }
    }

    // --- Original: Firebase Storage (Mobile / Native) ---
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileRef = ref(storage, path);
        const metadata = { contentType: 'image/jpeg' };

        await uploadBytes(fileRef, blob, metadata);
        return await getDownloadURL(fileRef);
    } catch (error) {
        console.error("Error uploading to Firebase:", error);
        return uri;
    }
};
