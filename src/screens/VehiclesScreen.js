import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChevronRight, Clock, Map, AlertTriangle } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SpotlightOverlay from '../components/SpotlightOverlay';
import { auth, db } from '../config/firebase';

const { width } = Dimensions.get('window');

// Import local assets
const defaultImages = {
    moto: require('../assets/images/default_moto.png'),
    coche: require('../assets/images/default_car.png'),
    bici: require('../assets/images/default_bike.png'),
    quad: require('../assets/images/default_atv.png'),
    // Fallbacks
    scooter: require('../assets/images/default_moto.png'),
    furgoneta: require('../assets/images/default_car.png'),
    camion: require('../assets/images/default_car.png'),
    barco: require('../assets/images/default_atv.png'),
    otro: require('../assets/images/default_atv.png'),
};

const VehiclesScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [vehicles, setVehicles] = useState([]);
    const [maintenances, setMaintenances] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSpotlight, setShowSpotlight] = useState(false);

    const vehicleSteps = [
        {
            title: 'spotlight_garage_2_title',
            description: 'spotlight_garage_2_desc',
            icon: 'bike'
        },
        {
            title: 'spotlight_garage_1_title',
            description: 'spotlight_garage_1_desc',
            icon: 'plus'
        }
    ];

    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('hasSeenSpotlightGarage');
                if (hasSeen !== 'true') {
                    setTimeout(() => setShowSpotlight(true), 1000);
                }
            } catch (e) {
                console.log('Error checking garage onboarding', e);
            }
        };
        checkOnboarding();
    }, []);

    const handleFinishSpotlight = async () => {
        try {
            await AsyncStorage.setItem('hasSeenSpotlightGarage', 'true');
            setShowSpotlight(false);
        } catch (e) {
            setShowSpotlight(false);
        }
    };

    useEffect(() => {
        if (!auth.currentUser) return;

        const qVehicles = query(collection(db, 'vehicles'), where('userId', '==', auth.currentUser.uid));
        const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            setVehicles(list);
            setLoading(false);
        });

        const qMaintenances = query(collection(db, 'maintenances'), where('userId', '==', auth.currentUser.uid));
        const unsubscribeMaintenances = onSnapshot(qMaintenances, (snapshot) => {
            const mList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaintenances(mList);
        });

        return () => {
            unsubscribeVehicles();
            unsubscribeMaintenances();
        };
    }, []);

    // Calculate Alerts
    useEffect(() => {
        if (vehicles.length === 0) {
            setAlerts([]);
            return;
        }

        const newAlerts = [];

        vehicles.forEach(vehicle => {
            if (!vehicle.usage) return;

            const vehicleMaintenances = maintenances.filter(m => m.vehicleId === vehicle.id);

            // Group by type to find last performed
            const historyByType = {};
            vehicleMaintenances.forEach(m => {
                if (!historyByType[m.type]) {
                    historyByType[m.type] = m;
                } else {
                    const dateA = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    const dateB = historyByType[m.type].date?.toDate ? historyByType[m.type].date.toDate() : new Date(historyByType[m.type].date);
                    if (dateA > dateB) {
                        historyByType[m.type] = m;
                    }
                }
            });

            Object.values(historyByType).forEach(lastJob => {
                if (lastJob.alertEnabled && lastJob.alertInterval) {
                    const currentUsage = parseFloat(vehicle.usage);
                    const lastUsage = parseFloat(lastJob.usage || 0);
                    const interval = parseFloat(lastJob.alertInterval);

                    const elapsed = currentUsage - lastUsage;
                    const remaining = interval - elapsed;
                    const status = remaining <= 0 ? 'overdue' : (remaining <= interval * 0.1 ? 'warning' : 'good');

                    if (status !== 'good') {
                        newAlerts.push({
                            id: lastJob.id,
                            title: lastJob.type,
                            vehicleId: vehicle.id,
                            remaining: remaining,
                            unit: vehicle.trackingType === 'h' ? 'h' : 'km',
                            status: status
                        });
                    }
                }
            });
        });

        // Sort by urgency
        newAlerts.sort((a, b) => {
            if (a.status === 'overdue' && b.status !== 'overdue') return -1;
            if (b.status === 'overdue' && a.status !== 'overdue') return 1;
            return a.remaining - b.remaining;
        });

        setAlerts(newAlerts);
    }, [vehicles, maintenances]);

    const getVehicleImage = (vehicle) => {
        if (!vehicle.image) return defaultImages.moto;
        // Check if image is a string. If object (from old require?), return it.
        // But Firestore stores strings.
        if (typeof vehicle.image === 'string' && vehicle.image.startsWith('DEFAULT_')) {
            const type = vehicle.image.replace('DEFAULT_', '').toLowerCase();
            return defaultImages[type] || defaultImages.moto;
        }
        if (typeof vehicle.image === 'string' && vehicle.image.startsWith('http')) return { uri: vehicle.image };
        if (typeof vehicle.image === 'string' && vehicle.image.startsWith('file')) return { uri: vehicle.image };
        // If it's something else or null, fallback
        return { uri: vehicle.image };
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('my_garage')}</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('AddVehicle')}
                >
                    <Plus size={24} color="#F2780D" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.listContent}>
                {loading ? (
                    <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>{t('loading')}</Text>
                ) : vehicles.length === 0 ? (
                    <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>{t('no_vehicles_add')}</Text>
                ) : (
                    vehicles.map((v) => {
                        const nextMaint = alerts.find(a => a.vehicleId === v.id);

                        return (
                            <TouchableOpacity
                                key={v.id}
                                style={styles.vehicleCard}
                                onPress={() => navigation.navigate('VehicleDetail', { vehicle: v })}
                            >
                                <Image
                                    source={getVehicleImage(v)}
                                    style={styles.bikeImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.cardInfo}>
                                    <View style={styles.nameRow}>
                                        <View>
                                            <Text style={styles.bikeName}>{v.name}</Text>
                                            <Text style={styles.bikeYear}>{v.year || ''} • {v.make || ''}</Text>
                                        </View>
                                        <ChevronRight size={20} color="#555" />
                                    </View>

                                    <View style={styles.statsRow}>
                                        <View style={[styles.miniStat, { backgroundColor: v.trackingType === 'h' ? 'rgba(242, 120, 13, 0.1)' : 'rgba(33, 150, 243, 0.1)' }]}>
                                            {v.trackingType === 'h' ? (
                                                <Clock size={14} color="#F2780D" />
                                            ) : (
                                                <Map size={14} color="#2196F3" />
                                            )}
                                            <Text style={[styles.miniStatText, { color: v.trackingType === 'h' ? '#F2780D' : '#2196F3' }]}>
                                                {v.usage || 0} {v.trackingType === 'h' ? 'h' : 'km'}
                                            </Text>
                                        </View>

                                        <View style={[styles.miniStat,
                                        nextMaint?.status === 'overdue' ? { backgroundColor: 'rgba(255, 82, 82, 0.1)' } :
                                            nextMaint?.status === 'warning' ? { backgroundColor: 'rgba(255, 193, 7, 0.1)' } :
                                                { backgroundColor: 'rgba(76, 175, 80, 0.1)' }
                                        ]}>
                                            <AlertTriangle size={14} color={
                                                nextMaint?.status === 'overdue' ? '#FF5252' :
                                                    nextMaint?.status === 'warning' ? '#FFC107' :
                                                        '#4CAF50'
                                            } />
                                            <Text style={[styles.miniStatText, {
                                                color: nextMaint?.status === 'overdue' ? '#FF5252' :
                                                    nextMaint?.status === 'warning' ? '#FFC107' :
                                                        '#4CAF50'
                                            }]}>
                                                {nextMaint
                                                    ? (nextMaint.status === 'overdue' ? t('overdue') : t('next_status'))
                                                    : t('all_good')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
            <SpotlightOverlay
                visible={showSpotlight}
                steps={vehicleSteps}
                onFinished={handleFinishSpotlight}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    addButton: {
        backgroundColor: '#1E1E1E',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    vehicleCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    bikeImage: {
        width: '100%',
        height: 160,
    },
    cardInfo: {
        padding: 16,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bikeName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    bikeYear: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    miniStat: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#252525',
    },
    miniStatText: {
        color: '#E0E0E0',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
});

export default VehiclesScreen;
