import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { updateVehicle } from '../services/vehicleService';
import { User, Calendar, AlertTriangle, Plus, Gauge, ChevronRight, Calculator, Wrench, ShieldCheck, Check, Map, ArrowRight, ClipboardList } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import SpotlightOverlay from '../components/SpotlightOverlay';

const { width, height } = Dimensions.get('window');

// Import local assets for consistency with VehiclesScreen
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

const getVehicleImage = (vehicle) => {
    if (!vehicle.image) return defaultImages.moto;

    // Check if image is a default placeholder string
    if (typeof vehicle.image === 'string' && vehicle.image.startsWith('DEFAULT_')) {
        const type = vehicle.image.replace('DEFAULT_', '').toLowerCase();
        return defaultImages[type] || defaultImages.moto;
    }

    // For local file uris (file://) or remote http/https
    return { uri: vehicle.image };
};

const DashboardScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { userProfile } = useAuth();
    const [vehicles, setVehicles] = useState([]);
    const [maintenances, setMaintenances] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [nextJob, setNextJob] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [newUsage, setNewUsage] = useState('');
    const [updatingUsage, setUpdatingUsage] = useState(false);
    const [actionType, setActionType] = useState(null); // 'maintenance' or 'usage'

    // Spotlight Onboarding State
    const [showSpotlight, setShowSpotlight] = useState(false);

    const dashboardSteps = [
        {
            title: 'spotlight_dash_1_title',
            description: 'spotlight_dash_1_desc',
            icon: 'home'
        },
        {
            title: 'spotlight_dash_2_title',
            description: 'spotlight_dash_2_desc',
            icon: 'gauge'
        },
        {
            title: 'spotlight_dash_3_title',
            description: 'spotlight_dash_3_desc',
            icon: 'layout'
        }
    ];

    // Check Onboarding Status
    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('hasSeenSpotlightDash');
                if (hasSeen !== 'true') {
                    // Give the UI a moment to load before starting the spotlight
                    setTimeout(() => setShowSpotlight(true), 1000);
                }
            } catch (e) {
                console.log('Error checking onboarding status', e);
            }
        };
        checkOnboarding();
    }, []);

    const handleFinishSpotlight = async () => {
        try {
            await AsyncStorage.setItem('hasSeenSpotlightDash', 'true');
            setShowSpotlight(false);
        } catch (e) {
            console.log('Error saving onboarding status', e);
            setShowSpotlight(false);
        }
    };

    // Fetch Vehicles & Maintenances Real-time
    useEffect(() => {
        if (!auth.currentUser) return;

        const qVehicles = query(collection(db, 'vehicles'), where('userId', '==', auth.currentUser.uid));
        const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
            const vList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVehicles(vList);
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
            setNextJob(null);
            return;
        }

        const newAlerts = [];

        vehicles.forEach(vehicle => {
            if (!vehicle.usage) return;

            // Get maintenances for this vehicle
            const vehicleMaintenances = maintenances.filter(m => m.vehicleId === vehicle.id);

            // Group by type/category to find the last one
            // We only care about maintenances that have alerts enabled
            // Actually, we should check all "types" of maintenance that have ALERTS enabled.
            // A maintenance record acts as the "last performed".
            // If I have 3 "Cambio de Aceite", I take the most recent one.

            // 1. Group by type
            const historyByType = {};
            vehicleMaintenances.forEach(m => {
                if (!historyByType[m.type]) {
                    historyByType[m.type] = m;
                } else {
                    // Check if this one is newer
                    const dateA = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    const dateB = historyByType[m.type].date?.toDate ? historyByType[m.type].date.toDate() : new Date(historyByType[m.type].date);
                    if (dateA > dateB) {
                        historyByType[m.type] = m;
                    }
                }
            });

            // 2. Check intervals
            Object.values(historyByType).forEach(lastJob => {
                if (lastJob.alertEnabled && lastJob.alertInterval) {
                    const currentUsage = parseFloat(vehicle.usage);
                    const lastUsage = parseFloat(lastJob.usage || 0); // Usage at time of maintenance
                    const interval = parseFloat(lastJob.alertInterval);

                    const elapsed = currentUsage - lastUsage;
                    const remaining = interval - elapsed;

                    // Smart Warning Logic:
                    // 1. Fixed thresholds: 500km or 5 hours (predictable for user)
                    // 2. Cap at 20% of interval: prevents warning too early on short intervals (e.g., chain lube every 300km)
                    const fixedThreshold = vehicle.trackingType === 'h' ? 5 : 500;
                    const threshold = Math.min(fixedThreshold, interval * 0.2);

                    const status = remaining <= 0 ? 'overdue' : (remaining <= threshold ? 'warning' : 'good');

                    if (status !== 'good') {
                        newAlerts.push({
                            id: lastJob.id,
                            title: lastJob.type,
                            vehicleId: vehicle.id,
                            vehicleName: vehicle.name,
                            remaining: remaining,
                            unit: vehicle.trackingType === 'h' ? 'h' : 'km',
                            status: status,
                            progress: Math.min(Math.max(elapsed / interval, 0), 1),
                            date: lastJob.date
                        });
                    }
                }
            });
        });

        // Sort alerts: Overdue first, then by remaining (ascending)
        newAlerts.sort((a, b) => {
            if (a.status === 'overdue' && b.status !== 'overdue') return -1;
            if (b.status === 'overdue' && a.status !== 'overdue') return 1;
            return a.remaining - b.remaining;
        });

        setAlerts(newAlerts);
        setNextJob(newAlerts.length > 0 ? newAlerts[0] : null);

    }, [vehicles, maintenances]);


    const handleActionPress = (type) => { // 'maintenance' or 'usage'
        setActionType(type);
        setShowVehicleModal(true);
    };

    const handleVehicleSelect = (vehicle) => {
        setShowVehicleModal(false);
        if (actionType === 'maintenance') {
            navigation.navigate('garage', { screen: 'AddMaintenance', params: { vehicle } });
        } else {
            setSelectedVehicle(vehicle);
            setNewUsage(String(vehicle.usage || ''));
            setShowUpdateModal(true);
        }
    };

    const handleUpdateUsage = async () => {
        if (!selectedVehicle || !newUsage) return;
        setUpdatingUsage(true);
        try {
            await updateVehicle(selectedVehicle.id, {
                usage: parseFloat(newUsage)
            });
            setShowUpdateModal(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la lectura.');
        } finally {
            setUpdatingUsage(false);
        }
    };

    const getVehicleStatus = (vehicleId) => {
        const vehicleAlerts = alerts.filter(a => a.vehicleId === vehicleId);
        if (vehicleAlerts.length === 0) return { status: 'good', text: t('all_good') };
        // Alerts are already sorted by urgency
        const topAlert = vehicleAlerts[0];
        if (topAlert.status === 'overdue') return { status: 'overdue', text: t('overdue') };
        if (topAlert.status === 'warning') return { status: 'warning', text: t('next_maintenance') };
        return { status: 'good', text: t('all_good') };
    };

    const renderVehicleCard = ({ item }) => {
        const status = getVehicleStatus(item.id);
        const nextMaint = alerts.find(a => a.vehicleId === item.id);

        return (
            <TouchableOpacity
                style={styles.vehicleMiniCard}
                onPress={() => navigation.navigate('garage', { screen: 'VehicleDetail', params: { vehicle: item } })}
            >
                <Image
                    source={getVehicleImage(item)}
                    style={styles.miniBikeImage}
                    resizeMode="cover"
                />
                <View style={styles.miniCardOverlay}>
                    <Text style={styles.miniBikeName} numberOfLines={1}>{item.name}</Text>

                    <View style={styles.usageRow}>
                        {item.trackingType === 'h' ? <Gauge size={14} color="#FFF" /> : <Map size={14} color="#FFF" />}
                        <Text style={styles.usageText}>{item.usage} {item.trackingType === 'h' ? 'h' : 'km'}</Text>
                    </View>

                    <View style={[styles.statusBadge,
                    status.status === 'overdue' ? { backgroundColor: 'rgba(255, 82, 82, 0.9)' } :
                        status.status === 'warning' ? { backgroundColor: 'rgba(255, 193, 7, 0.9)' } :
                            { backgroundColor: 'rgba(76, 175, 80, 0.9)' }
                    ]}>
                        <Text style={styles.statusText}>
                            {nextMaint
                                ? (nextMaint.status === 'overdue'
                                    ? `${t('overdue')} ${t('ago')} ${Math.abs(nextMaint.remaining).toFixed(0)} ${nextMaint.unit}`
                                    : `${t('due_in')} ${nextMaint.remaining.toFixed(0)} ${nextMaint.unit}`)
                                : t('all_good')}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{t('hello')}, {userProfile?.displayName || auth.currentUser?.displayName || t('default_user')}</Text>
                        <Text style={styles.title}>GarageOps</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.profileButton, (userProfile?.photoURL || auth.currentUser?.photoURL) && { padding: 0, overflow: 'hidden' }]}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        {(userProfile?.photoURL || auth.currentUser?.photoURL) ? (
                            <Image
                                key={userProfile?.photoURL || auth.currentUser?.photoURL}
                                source={{ uri: userProfile?.photoURL || auth.currentUser?.photoURL }}
                                style={{ width: 44, height: 44, borderRadius: 22 }}
                            />
                        ) : (
                            <User size={24} color="#E0E0E0" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* AD BANNER (Mock) */}
                {!userProfile?.isPremium && (
                    <TouchableOpacity
                        style={styles.adBanner}
                        onPress={() => navigation.navigate('Paywall')}
                    >
                        <View style={styles.adBadge}>
                            <Text style={styles.adBadgeText}>{t('ad_badge')}</Text>
                        </View>
                        <Text style={styles.adText}>
                            {t('ad_text')} {"\n"}
                            <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{t('ad_pro_text')}</Text>
                        </Text>
                    </TouchableOpacity>
                )}

                {/* PRÓXIMO MANTENIMIENTO */}
                {nextJob ? (
                    <TouchableOpacity
                        style={styles.nextJobCard}
                        onPress={() => {
                            const v = vehicles.find(veh => veh.id === nextJob.vehicleId);
                            if (v) navigation.navigate('garage', { screen: 'VehicleDetail', params: { vehicle: v } });
                        }}
                    >
                        <View style={styles.nextJobHeader}>
                            <View style={[styles.nextJobLabelContainer, nextJob.status === 'overdue' && { backgroundColor: 'rgba(255, 82, 82, 0.1)' }]}>
                                <Calendar size={14} color={nextJob.status === 'overdue' ? '#FF5252' : '#F2780D'} />
                                <Text style={[styles.nextJobLabel, nextJob.status === 'overdue' && { color: '#FF5252' }]}>
                                    {nextJob.status === 'overdue' ? t('overdue') : t('next_maintenance')}
                                </Text>
                            </View>
                            <Text style={[styles.nextJobTime, nextJob.status === 'overdue' && { color: '#FF5252' }]}>
                                {nextJob.status === 'overdue'
                                    ? `${t('ago')} ${Math.abs(nextJob.remaining).toFixed(1)} ${nextJob.unit}`
                                    : `${t('due_in')} ${nextJob.remaining.toFixed(1)} ${nextJob.unit}`}
                            </Text>
                        </View>

                        <View style={styles.jobDetails}>
                            <Text style={styles.jobTitle}>{nextJob.title}</Text>
                            <Text style={styles.jobVehicle}>{nextJob.vehicleName}</Text>
                        </View>

                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    {
                                        width: `${Math.min(nextJob.progress * 100, 100)}%`,
                                        backgroundColor: nextJob.status === 'overdue' ? '#FF5252' : '#F2780D'
                                    }
                                ]}
                            />
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.nextJobCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }]}>
                        <ShieldCheck size={48} color="#4CAF50" style={{ marginBottom: 12, opacity: 0.8 }} />
                        <Text style={styles.jobTitle}>{t('all_good')}</Text>
                        <Text style={styles.jobVehicle}>{t('no_pending_maintenance')}</Text>
                    </View>
                )}

                {/* Carousel Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('my_vehicles')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('garage')}>
                        <Text style={styles.seeAllText}>{t('see_all')}</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={vehicles}
                    renderItem={renderVehicleCard}
                    keyExtractor={item => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContainer}
                    snapToInterval={width * 0.7 + 16}
                    decelerationRate="fast"
                    ListEmptyComponent={
                        <View style={{ width: width - 40, alignItems: 'center', justifyContent: 'center', height: 180 }}>
                            <Text style={{ color: '#666', marginBottom: 10 }}>{t('no_vehicles')}</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('garage', { screen: 'AddVehicle' })}>
                                <Text style={{ color: '#F2780D', fontWeight: 'bold' }}>{t('add_vehicle')}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />

                {/* Critical Alerts Bento */}
                {alerts.length > 1 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{t('other_alerts')}</Text>
                        </View>

                        {alerts.slice(1).map(alert => (
                            <TouchableOpacity
                                key={alert.id}
                                style={[styles.alertCard,
                                alert.status === 'overdue' ? { backgroundColor: 'rgba(255, 82, 82, 0.1)', borderColor: 'rgba(255, 82, 82, 0.3)' } :
                                    alert.status === 'warning' ? { backgroundColor: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)' } :
                                        { backgroundColor: '#1E1E1E', borderColor: '#333' }
                                ]}
                                onPress={() => {
                                    const v = vehicles.find(veh => veh.id === alert.vehicleId);
                                    if (v) navigation.navigate('garage', { screen: 'VehicleDetail', params: { vehicle: v } });
                                }}
                            >
                                <View style={[styles.alertIconBg,
                                alert.status === 'overdue' ? { backgroundColor: 'rgba(255, 82, 82, 0.2)' } :
                                    alert.status === 'warning' ? { backgroundColor: 'rgba(255, 193, 7, 0.2)' } :
                                        { backgroundColor: 'rgba(76, 175, 80, 0.2)' } // Good
                                ]}>
                                    <AlertTriangle size={24} color={
                                        alert.status === 'overdue' ? '#FF5252' :
                                            alert.status === 'warning' ? '#FFC107' :
                                                '#4CAF50' // Good
                                    } />
                                </View>
                                <View style={styles.alertInfo}>
                                    <Text style={[styles.alertTitle,
                                    alert.status === 'overdue' ? { color: '#FF5252' } :
                                        alert.status === 'warning' ? { color: '#FFC107' } :
                                            { color: '#E0E0E0' }
                                    ]}>
                                        {alert.title} - {alert.vehicleName}
                                    </Text>
                                    <Text style={styles.alertDesc}>
                                        {alert.status === 'overdue'
                                            ? `${t('overdue')} ${t('ago')} ${Math.abs(alert.remaining).toFixed(1)} ${alert.unit}`
                                            : `${t('due_in')} ${alert.remaining.toFixed(1)} ${alert.unit}`}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                )}

            </ScrollView>

            {/* FABS */}
            <TouchableOpacity
                style={[styles.fab, { bottom: 110, backgroundColor: '#2196F3' }]}
                onPress={() => handleActionPress('usage')}
            >
                <Gauge size={32} color="#121212" strokeWidth={3} />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => handleActionPress('maintenance')}
            >
                <Plus size={32} color="#121212" strokeWidth={3} />
            </TouchableOpacity>

            {/* Vehicle Selection Modal */}
            {showVehicleModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {actionType === 'maintenance' ? t('new_maintenance') : t('update_reading')}
                            </Text>
                            <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                                <Text style={styles.closeText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                        </View>
                        {vehicles.length > 0 ? (
                            vehicles.map(v => (
                                <TouchableOpacity
                                    key={v.id}
                                    style={styles.modalItem}
                                    onPress={() => handleVehicleSelect(v)}
                                >
                                    <View style={[styles.modalDot, { backgroundColor: v.color || '#F2780D' }]} />
                                    <Text style={styles.modalItemText}>{v.name}</Text>
                                    <View style={{ flex: 1 }} />
                                    {actionType === 'maintenance' ? <Plus size={20} color="#666" /> : <Gauge size={20} color="#666" />}
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <Text style={{ color: '#888', marginBottom: 20 }}>{t('no_vehicles')}</Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#F2780D', padding: 10, borderRadius: 8 }}
                                    onPress={() => {
                                        setShowVehicleModal(false);
                                        navigation.navigate('garage', { screen: 'AddVehicle' });
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('new_vehicle')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Update Usage Modal */}
            <Modal
                visible={showUpdateModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowUpdateModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('update_reading')}</Text>
                        <Text style={styles.modalSubtitle}>
                            {selectedVehicle ? `${t('enter_current_value')} ${selectedVehicle.name} (${selectedVehicle.trackingType === 'h' ? 'Horas' : 'Km'}).` : t('enter_value')}
                        </Text>

                        <TextInput
                            style={styles.updateInput}
                            value={newUsage}
                            onChangeText={setNewUsage}
                            keyboardType="numeric"
                            placeholder="0.0"
                            placeholderTextColor="#666"
                            autoFocus={true}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowUpdateModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={handleUpdateUsage}
                                disabled={updatingUsage}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {updatingUsage ? t('saving') : t('update')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>


            {/* Spotlight Onboarding Overlay */}
            <SpotlightOverlay
                visible={showSpotlight}
                steps={dashboardSteps}
                onFinished={handleFinishSpotlight}
            />
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 16,
        color: '#888',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    profileButton: {
        backgroundColor: '#1E1E1E',
        padding: 10,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#333',
    },
    nextJobCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#333',
    },
    nextJobHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    nextJobLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    nextJobLabel: {
        color: '#F2780D',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    nextJobTime: {
        color: '#E0E0E0',
        fontWeight: 'bold',
    },
    jobDetails: {
        marginBottom: 16,
    },
    jobTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 4,
    },
    jobVehicle: {
        fontSize: 16,
        color: '#888',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#F2780D',
        borderRadius: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    seeAllText: {
        color: '#F2780D',
        fontSize: 14,
        fontWeight: '600',
    },
    carouselContainer: {
        paddingBottom: 24,
    },
    vehicleMiniCard: {
        width: width * 0.7,
        height: 180,
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        marginRight: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    miniBikeImage: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    miniCardOverlay: {
        ...StyleSheet.absoluteFillObject,
        padding: 16,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    miniBikeName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    usageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    usageText: {
        color: '#E0E0E0',
        fontSize: 12,
        marginLeft: 6,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    statusText: {
        color: '#121212',
        fontSize: 10,
        fontWeight: 'bold',
    },
    alertCard: {
        backgroundColor: 'rgba(255, 82, 82, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 82, 82, 0.3)',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    alertIconBg: {
        backgroundColor: 'rgba(255, 82, 82, 0.2)',
        padding: 12,
        borderRadius: 14,
        marginRight: 16,
    },
    alertInfo: {
        flex: 1,
    },
    alertTitle: {
        color: '#FF5252',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    alertDesc: {
        color: '#E0E0E0',
        fontSize: 13,
        lineHeight: 18,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F2780D',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#F2780D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    closeText: {
        color: '#F2780D',
        fontWeight: 'bold',
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    modalDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    modalItemText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    // New Modal Styles
    modalSubtitle: {
        color: '#888',
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 14,
    },
    updateInput: {
        backgroundColor: '#121212',
        color: '#F2780D',
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 6,
    },
    cancelButton: {
        backgroundColor: '#2A2A2A',
    },
    confirmButton: {
        backgroundColor: '#F2780D',
    },
    cancelButtonText: {
        color: '#E0E0E0',
        fontWeight: '600',
    },
    confirmButtonText: {
        color: '#121212',
        fontWeight: 'bold',
    },
    adBanner: {
        backgroundColor: '#333',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20
    },
    // Onboarding Styles
    onboardingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    onboardingContent: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    slide: {
        alignItems: 'center',
        marginBottom: 30,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(242, 120, 13, 0.3)',
    },
    logoCircle: {
        // Logo styling if needed
    },
    slideTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 10,
        textAlign: 'center',
    },
    slideDesc: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
    dotsContainer: {
        flexDirection: 'row',
        marginBottom: 30,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#333',
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: '#F2780D',
        width: 20,
    },
    nextButton: {
        backgroundColor: '#F2780D',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
        justifyContent: 'center',
    },
    nextButtonText: {
        color: '#121212',
        fontSize: 18,
        fontWeight: 'bold',
    },
    adBadge: {
        backgroundColor: '#666',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 12,
        alignSelf: 'flex-start',
        marginBottom: 8
    },
    adBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    adText: {
        color: '#CCC',
        fontSize: 12,
    },
});

export default DashboardScreen;
