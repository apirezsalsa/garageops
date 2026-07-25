import { Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as webApi from './webApi';

// Get all parts for the current user
export const getParts = async () => {
    if (Platform.OS === 'web') {
        return webApi.request('parts');
    }

    try {
        if (!auth.currentUser) return [];
        const q = query(collection(db, 'parts'), where('userId', '==', auth.currentUser.uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting parts:", error);
        return [];
    }
};

// Add a new part
export const addPart = async (partData) => {
    if (Platform.OS === 'web') {
        return webApi.request('parts', {
            method: 'POST',
            body: JSON.stringify(partData)
        });
    }

    try {
        if (!auth.currentUser) throw new Error("No user");
        const docRef = await addDoc(collection(db, 'parts'), {
            ...partData,
            userId: auth.currentUser.uid,
            createdAt: new Date(),
        });
        return { id: docRef.id, ...partData };
    } catch (error) {
        console.error("Error adding part:", error);
        throw error;
    }
};

// Update a part
export const updatePart = async (partId, data) => {
    if (Platform.OS === 'web') {
        return webApi.request(`parts/${partId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    try {
        const ref = doc(db, 'parts', partId);
        await updateDoc(ref, data);
    } catch (error) {
        console.error("Error updating part:", error);
        throw error;
    }
};

// Delete a part
export const deletePart = async (partId) => {
    if (Platform.OS === 'web') {
        return webApi.request(`parts/${partId}`, {
            method: 'DELETE'
        });
    }

    try {
        const ref = doc(db, 'parts', partId);
        await deleteDoc(ref);
    } catch (error) {
        console.error("Error deleting part:", error);
        throw error;
    }
};
