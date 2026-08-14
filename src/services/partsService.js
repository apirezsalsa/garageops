import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// Get all parts for the current user
export const getParts = async () => {
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
    try {
        const ref = doc(db, 'parts', partId);
        await deleteDoc(ref);
    } catch (error) {
        console.error("Error deleting part:", error);
        throw error;
    }
};
