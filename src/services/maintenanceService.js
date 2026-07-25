import { Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as webApi from './webApi';

export const addMaintenance = async (vehicleId, maintenanceData) => {
    if (Platform.OS === 'web') {
        return webApi.request('maintenance', {
            method: 'POST',
            body: JSON.stringify({ ...maintenanceData, vehicle_id: vehicleId })
        });
    }

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
    if (Platform.OS === 'web') {
        return webApi.request(`maintenance?vehicle_id=${vehicleId}`);
    }

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
    if (Platform.OS === 'web') {
        return webApi.request(`maintenance/${maintenanceId}`, {
            method: 'DELETE'
        });
    }

    try {
        const ref = doc(db, 'maintenances', maintenanceId);
        await deleteDoc(ref);
    } catch (error) {
        console.error('Error deleting maintenance: ', error);
        throw error;
    }
};

export const updateMaintenance = async (maintenanceId, updatedData) => {
    if (Platform.OS === 'web') {
        return webApi.request(`maintenance/${maintenanceId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData)
        });
    }

    try {
        const ref = doc(db, 'maintenances', maintenanceId);
        await updateDoc(ref, updatedData);
    } catch (error) {
        console.error('Error updating maintenance: ', error);
        throw error;
    }
};

export const getAllMaintenances = async (limitCount = 20) => {
    if (Platform.OS === 'web') {
        // Handle global search/recent maintenance
        // In this simple API, we might need a specific endpoint or just fetch all
        return webApi.request('maintenance/all'); // Assuming I might add this or just rely on vehicle history
    }

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
        console.error("Error getting all maintenances:", error);
        return [];
    }
};
