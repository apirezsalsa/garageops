import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Plus, Wrench, Clock, Map as MapIcon, FileText, Trash2, Calendar, Edit2, Camera, Image as ImageIcon, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react-native';
import { deleteVehicle, updateVehicle } from '../services/vehicleService';
import { getMaintenanceHistory, addMaintenance } from '../services/maintenanceService';
import { uploadImage } from '../services/uploadService';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';


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

const { width } = Dimensions.get('window');

const VehicleDetailScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { vehicle } = route.params;
    const [currentVehicle, setCurrentVehicle] = useState(vehicle); // Local state for immediate updates
    const [nextMaintenance, setNextMaintenance] = useState(null);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Update Usage State
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [newUsage, setNewUsage] = useState('');
    const [updatingUsage, setUpdatingUsage] = useState(false);

    // Photo Update State
    const [showPhotoOptions, setShowPhotoOptions] = useState(false);
    const [updatingPhoto, setUpdatingPhoto] = useState(false);

    const getVehicleImage = (vehicle) => {
        if (!vehicle.image) return defaultImages.moto;
        if (typeof vehicle.image === 'string' && vehicle.image.startsWith('DEFAULT_')) {
            const type = vehicle.image.replace('DEFAULT_', '').toLowerCase();
            return defaultImages[type] || defaultImages.moto;
        }
        if (typeof vehicle.image === 'string' && vehicle.image.startsWith('http')) return { uri: vehicle.image };
        if (typeof vehicle.image === 'string' && vehicle.image.startsWith('file')) return { uri: vehicle.image };
        return { uri: vehicle.image };
    };

    const fetchHistory = async (updatedVehicle = null) => {
        setLoadingHistory(true);
        const vehicleState = updatedVehicle || currentVehicle;
        try {
            const data = await getMaintenanceHistory(vehicleState.id);

            // Calculate Next Maintenance
            let nextTask = null;
            let minRemaining = Infinity;

            const latestLogsMap = new Map();

            // Filter for alert-enabled logs and keep latest
            data.forEach(log => {
                if (!log.alertEnabled || !log.alertInterval) return;
                const key = `${log.vehicleId}_${log.type}`;
                if (!latestLogsMap.has(key)) {
                    latestLogsMap.set(key, log);
                }
            });

            latestLogsMap.forEach(log => {
                const interval = parseFloat(log.alertInterval);
                if (isNaN(interval)) return;

                const logUsage = parseFloat(log.usage) || 0;
                const currentUsage = parseFloat(vehicleState.usage) || 0;
                const remaining = interval - (currentUsage - logUsage); // Can be negative if overdue

                // We want the most urgent task (smallest remaining value, including negative)
                if (remaining < minRemaining) {
                    minRemaining = remaining;

                    let status = 'good';
                    if (remaining <= 0) status = 'overdue';
                    else if (remaining <= interval * 0.1) status = 'critical';
                    else if (remaining <= interval * 0.25) status = 'warning';

                    nextTask = {
                        title: log.type,
                        remaining: remaining,
                        unit: vehicleState.trackingType === 'h' ? 'h' : 'km',
                        status: status
                    };
                }
            });

            setNextMaintenance(nextTask);

            // Filter out reading updates from the display list
            const filteredData = data.filter(item => item.type !== 'Actualización de Lectura');
            setHistory(filteredData.slice(0, 3)); // Show only top 3
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [currentVehicle.id])
    );

    const handleUpdateUsage = async () => {
        if (!newUsage || isNaN(Number(newUsage))) {
            Alert.alert(t('error'), t('valid_numeric_value_error'));
            return;
        }
        setUpdatingUsage(true);
        try {
            // 1. Update Vehicle
            await updateVehicle(currentVehicle.id, { usage: Number(newUsage) });

            // 2. Add Log Entry
            await addMaintenance(currentVehicle.id, {
                date: new Date(),
                category: 'log',
                type: t('reading_update'),
                usage: Number(newUsage),
                parts: [],
                alertEnabled: false,
                notes: t('quick_reading_note'),
                totalCost: 0
            });

            // 3. Update Local State
            const updatedVehicle = { ...currentVehicle, usage: Number(newUsage) };
            setCurrentVehicle(updatedVehicle);
            setNewUsage('');
            setShowUpdateModal(false);

            // 4. Refresh History to show the new log AND recalculate maintenance with NEW usage
            fetchHistory(updatedVehicle);

            Alert.alert(t('success'), t('reading_updated_success'));
        } catch (error) {
            Alert.alert(t('error'), t('error_update_reading'));
            console.error(error);
        } finally {
            setUpdatingUsage(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                setShowPhotoOptions(false);
                Alert.alert(t('permission_denied'), t('gallery_permission_vehicle'));
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            // Close modal after selection to avoid UI flickers
            setShowPhotoOptions(false);

            if (!result.canceled && result.assets && result.assets.length > 0) {
                saveNewImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error("Error picking image:", error);
            setShowPhotoOptions(false);
            Alert.alert(t('error'), t('error_select_image_problem'));
        }
    };

    const handleResetImage = () => {
        setShowPhotoOptions(false);
        // Default format: DEFAULT_MOTO, DEFAULT_COCHE, etc.
        const defaultTag = `DEFAULT_${currentVehicle.type ? currentVehicle.type.toUpperCase() : 'MOTO'}`;
        saveNewImage(defaultTag);
    };

    const saveNewImage = async (newImageUri) => {
        setUpdatingPhoto(true);
        try {
            // Upload to Storage if it's a local file
            const storagePath = `vehicles/${user.uid}_${currentVehicle.id}_${Date.now()}`;
            const photoToSave = await uploadImage(newImageUri, storagePath);

            await updateVehicle(currentVehicle.id, { image: photoToSave });
            setCurrentVehicle({ ...currentVehicle, image: photoToSave });
            Alert.alert(t('photo_updated'), t('vehicle_image_updated'));
        } catch (error) {
            console.error("Error updating image:", error);
            Alert.alert(t('error'), t('error_update_image'));
        } finally {
            setUpdatingPhoto(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            t('delete_vehicle_title'),
            t('delete_vehicle_confirm'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteVehicle(currentVehicle.id);
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert(t('error'), t('error_delete_vehicle'));
                        }
                    }
                }
            ]
        );
    };



    const renderHistoryItem = (item) => (
        <TouchableOpacity
            key={item.id}
            style={styles.historyItem}
            onPress={() => navigation.navigate('MaintenanceDetail', {
                item: {
                    ...item,
                    vehicleName: currentVehicle.name,
                    vehicleId: currentVehicle.id,
                    trackingType: currentVehicle.trackingType
                }
            })}
        >
            <View style={styles.historyIcon}>
                <Wrench size={20} color="#F2780D" />
            </View>
            <View style={styles.historyInfo}>
                <Text style={styles.historyTask}>{t(item.type)}</Text>
                <Text style={styles.historyDate}>
                    {item.date?.toDate ? item.date.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                </Text>
            </View>
            <Text style={styles.historyValue}>
                {item.usage} {currentVehicle.trackingType === 'h' ? 'h' : 'km'}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('VehiclesList')} style={styles.backButton}>
                    <ChevronLeft size={28} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.title}>{currentVehicle.name}</Text>
                <View style={{ flexDirection: 'row' }}>

                    <TouchableOpacity style={styles.settingsButton} onPress={handleDelete}>
                        <Trash2 size={20} color="#FF5252" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Hero Section */}
                <View style={styles.heroCard}>
                    <Image source={getVehicleImage(currentVehicle)} style={styles.vehicleImage} resizeMode="cover" />
                    <View style={styles.overlay}>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{currentVehicle.status || t('active_status')}</Text>
                        </View>
                        {/* Edit Photo Button */}
                        <TouchableOpacity style={styles.editPhotoButton} onPress={() => setShowPhotoOptions(true)}>
                            <Camera size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsContainer}>
                    <TouchableOpacity
                        style={styles.statBox}
                        onPress={() => {
                            setNewUsage(currentVehicle.usage ? String(currentVehicle.usage) : '');
                            setShowUpdateModal(true);
                        }}
                    >
                        <View style={styles.iconBg}>
                            {currentVehicle.trackingType === 'h' ? <Clock size={20} color="#F2780D" /> : <MapIcon size={20} color="#2196F3" />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.statLabel}>{t('current_usage')}</Text>
                            <Edit2 size={12} color="#666" style={{ marginLeft: 6, marginBottom: 4 }} />
                        </View>
                        <Text style={styles.statValue}>{currentVehicle.usage || 0}</Text>
                    </TouchableOpacity>
                    <View style={styles.statBox}>
                        <View style={[styles.iconBg, { backgroundColor: nextMaintenance && nextMaintenance.status === 'overdue' ? 'rgba(255, 82, 82, 0.1)' : nextMaintenance && (nextMaintenance.status === 'critical' || nextMaintenance.status === 'warning') ? 'rgba(255, 193, 7, 0.1)' : 'rgba(76, 175, 80, 0.1)' }]}>
                            {nextMaintenance && nextMaintenance.status === 'overdue' ?
                                <AlertTriangle size={24} color="#FF5252" /> :
                                nextMaintenance && (nextMaintenance.status === 'critical' || nextMaintenance.status === 'warning') ?
                                    <Wrench size={24} color="#FFC107" /> :
                                    <ShieldCheck size={24} color="#4CAF50" />
                            }
                        </View>
                        <Text style={styles.statLabel}>
                            {nextMaintenance ? t(nextMaintenance.title) : t('status_label')}
                        </Text>
                        <Text style={[styles.statValue, {
                            color: nextMaintenance && nextMaintenance.status === 'overdue' ? '#FF5252' :
                                nextMaintenance && (nextMaintenance.status === 'critical' || nextMaintenance.status === 'warning') ? '#FFC107' :
                                    '#4CAF50',
                            fontSize: 16
                        }]}>
                            {nextMaintenance ?
                                (nextMaintenance.status === 'overdue' ?
                                    `${t('ago_prefix')} ${Math.abs(nextMaintenance.remaining).toFixed(0)} ${nextMaintenance.unit}` :
                                    `${t('in_prefix')} ${nextMaintenance.remaining.toFixed(0)} ${nextMaintenance.unit}`)
                                : t('up_to_date')
                            }
                        </Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('AddMaintenance', { vehicle: currentVehicle })}
                >
                    <Plus size={24} color="#121212" strokeWidth={3} />
                    <Text style={styles.actionText}>{t('new_maintenance_button')}</Text>
                </TouchableOpacity>

                {/* Recent History Preview */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recent_records')}</Text>
                    {/* Link to History tab/screen, ideally filtering by this vehicle */}
                    <TouchableOpacity onPress={() => navigation.navigate('history', { vehicleId: vehicle.id, trackingType: currentVehicle.trackingType })}>
                        <Text style={styles.viewAllText}>{t('view_all')}</Text>
                    </TouchableOpacity>
                </View>

                {loadingHistory ? (
                    <Text style={{ color: '#666', textAlign: 'center', marginTop: 10 }}>{t('loading_history')}</Text>
                ) : history.length > 0 ? (
                    history.map(renderHistoryItem)
                ) : (
                    <Text style={{ color: '#666', textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
                        {t('no_maintenance_records')}
                    </Text>
                )}
            </ScrollView>

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
                        <Text style={styles.modalTitle}>{t('update_reading_title')}</Text>
                        <Text style={styles.modalSubtitle}>
                            {t('enter_current_value')} {currentVehicle.trackingType === 'h' ? t('hours') : t('kilometers')}.
                        </Text>

                        <TextInput
                            style={styles.updateInput}
                            value={newUsage ? String(newUsage) : ''}
                            onChangeText={setNewUsage}
                            keyboardType="numeric"
                            placeholder="0.0"
                            placeholderTextColor="#666"
                            autoFocus={true}
                            selectTextOnFocus={true}
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
                                    {updatingUsage ? t('saving_status') : t('update')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Photo Options Modal */}
            <Modal
                visible={showPhotoOptions}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPhotoOptions(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPhotoOptions(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('edit_image')}</Text>

                        <TouchableOpacity style={styles.photoOption} onPress={handlePickImage} disabled={updatingPhoto}>
                            <ImageIcon size={24} color="#F2780D" />
                            <Text style={styles.photoOptionText}>{t('select_gallery')}</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.photoOption} onPress={handleResetImage} disabled={updatingPhoto}>
                            <RotateCcw size={24} color="#E0E0E0" />
                            <Text style={styles.photoOptionText}>{t('restore_original')}</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={[styles.photoOption, { justifyContent: 'center' }]} onPress={() => setShowPhotoOptions(false)}>
                            <Text style={[styles.photoOptionText, { color: '#FF5252' }]}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    settingsButton: {
        padding: 8,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    heroCard: {
        marginHorizontal: 20,
        height: 200,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
        position: 'relative',
    },
    vehicleImage: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        padding: 16,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    statusBadge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 12,
    },
    editPhotoButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 24,
        justifyContent: 'space-between',
    },
    statBox: {
        width: (width - 56) / 2,
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
    },
    iconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 4,
    },
    statValue: {
        color: '#E0E0E0',
        fontSize: 20,
        fontWeight: 'bold',
    },
    actionButton: {
        marginHorizontal: 20,
        backgroundColor: '#F2780D',
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        shadowColor: '#F2780D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    actionText: {
        color: '#121212',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    viewAllText: {
        fontSize: 14,
        color: '#F2780D',
        fontWeight: '600',
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
    },
    historyIcon: {
        width: 40,
        height: 40,
        backgroundColor: '#252525',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    historyInfo: {
        flex: 1,
    },
    historyTask: {
        color: '#E0E0E0',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    historyDate: {
        color: '#888',
        fontSize: 12,
    },
    historyValue: {
        color: '#E0E0E0',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end', // Align to bottom for ActionSheet style
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 20,
        textAlign: 'center',
    },
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
    // Photo Options Styles
    photoOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    photoOptionText: {
        color: '#E0E0E0',
        fontSize: 16,
        marginLeft: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#2A2A2A',
    }
});

export default VehicleDetailScreen;
