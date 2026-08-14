import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export const addMaintenance = async (vehicleId, maintenanceData) => {
    try {
        if (!auth.currentUser) throw new Error('Usuario no autenticado');

        const docRef = await addDoc(collection(db, 'maintenances'), {
            ...maintenanceData,
            vehicleId,
            userId: auth.currentUser.uid,
            createdAt: new Date(),
        });

        return { id: docRef.id, ...maintenanceData };
    } catch (error) {
        console.error('Error adding maintenance: ', error);
        throw error;
    }
};

export const getMaintenanceHistory = async (vehicleId) => {
    try {
        if (!auth.currentUser) return [];

        const q = query(
            collection(db, 'maintenances'),
            where('vehicleId', '==', vehicleId),
            where('userId', '==', auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        const history = [];
        querySnapshot.forEach((doc) => {
            history.push({ id: doc.id, ...doc.data() });
        });

        history.sort((a, b) => {
            const dateA = a.date?.seconds || 0;
            const dateB = b.date?.seconds || 0;
            return dateB - dateA;
        });

        return history;
    } catch (error) {
        console.error('Error fetching maintenance history: ', error);
        throw error;
    }
};

export const deleteMaintenance = async (maintenanceId) => {
    try {
        const ref = doc(db, 'maintenances', maintenanceId);
        await deleteDoc(ref);
    } catch (error) {
        console.error('Error deleting maintenance: ', error);
        throw error;
    }
};

export const updateMaintenance = async (maintenanceId, updatedData) => {
    try {
        const ref = doc(db, 'maintenances', maintenanceId);
        await updateDoc(ref, updatedData);
    } catch (error) {
        console.error('Error updating maintenance: ', error);
        throw error;
    }
};

export const getAllMaintenances = async (limitCount = 20) => {
    try {
        if (!auth.currentUser) return [];
        const q = query(
            collection(db, 'maintenances'),
            where('userId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allDocs.sort((a, b) => {
            const dateA = a.date?.seconds || 0;
            const dateB = b.date?.seconds || 0;
            return dateB - dateA;
        });

        if (limitCount && limitCount > 0) {
            return allDocs.slice(0, limitCount);
        }
        return allDocs;
    } catch (error) {
        console.error('Error getting all maintenances:', error);
        return [];
    }
};
