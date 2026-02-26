import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads an image to Firebase Storage if it's a local URI.
 * @param {string} uri - The local URI of the image.
 * @param {string} path - The Storage path (e.g., 'profiles/userid').
 * @returns {Promise<string>} - The network URL if uploaded, or the original URI.
 */
export const uploadImage = async (uri, path) => {
    if (!uri) return null;

    // Only upload if it's a local URI (file://, content://, or base64)
    const isLocal = uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:');
    if (!isLocal) return uri;

    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileRef = ref(storage, path);

        // Metadata to help with content type
        const metadata = {
            contentType: 'image/jpeg',
        };

        await uploadBytes(fileRef, blob, metadata);
        const downloadURL = await getDownloadURL(fileRef);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image to Firebase Storage:", error);
        return uri; // Fallback to local URI so it at least works on one device
    }
};
