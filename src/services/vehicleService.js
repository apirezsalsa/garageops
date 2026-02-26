import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export const getVehicles = async () => {
    try {
        if (!auth.currentUser) return [];

        const q = query(collection(db, 'vehicles'), where('userId', '==', auth.currentUser.uid));
        const querySnapshot = await getDocs(q);

        const vehicles = [];
        querySnapshot.forEach((doc) => {
            vehicles.push({ id: doc.id, ...doc.data() });
        });

        return vehicles;
    } catch (error) {
        console.error('Error fetching vehicles: ', error);
        throw error;
    }
};

export const addVehicle = async (vehicleData) => {
    try {
        if (!auth.currentUser) throw new Error('Usuario no autenticado');

        const docRef = await addDoc(collection(db, 'vehicles'), {
            ...vehicleData,
            userId: auth.currentUser.uid,
            createdAt: new Date(),
            health: 100, // Default start health
        });
        return { id: docRef.id, ...vehicleData };
    } catch (error) {
        console.error('Error adding vehicle: ', error);
        throw error;
    }
};

export const updateVehicle = async (vehicleId, updatedData) => {
    try {
        const vehicleRef = doc(db, 'vehicles', vehicleId);
        await updateDoc(vehicleRef, updatedData);
    } catch (error) {
        console.error('Error updating vehicle: ', error);
        throw error;
    }
};

export const deleteVehicle = async (vehicleId) => {
    try {
        const batch = writeBatch(db);

        // 1. Delete associated maintenances
        const maintenanceQ = query(collection(db, 'maintenances'), where('vehicleId', '==', vehicleId));
        const maintenanceSnapshot = await getDocs(maintenanceQ);

        maintenanceSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 2. Delete the vehicle itself
        const vehicleRef = doc(db, 'vehicles', vehicleId);
        batch.delete(vehicleRef);

        // Commit the batch
        await batch.commit();
    } catch (error) {
        console.error('Error deleting vehicle and its history: ', error);
        throw error;
    }
}
