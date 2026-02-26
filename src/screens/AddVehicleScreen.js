import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, FlatList, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Camera, ChevronDown, Check, Map, Watch } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { addVehicle } from '../services/vehicleService';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadImage } from '../services/uploadService';

const AddVehicleScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { user, userProfile } = useAuth();
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [usage, setUsage] = useState('');
    const [trackingType, setTrackingType] = useState('h'); // 'h' or 'km'
    const [type, setType] = useState('moto');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showTypeModal, setShowTypeModal] = useState(false);

    const vehicleTypes = [
        { id: 'moto', label: t('type_moto'), icon: <Text style={{ fontSize: 20 }}>🏍️</Text> },
        { id: 'coche', label: t('type_coche'), icon: <Text style={{ fontSize: 20 }}>🚗</Text> },
        { id: 'furgoneta', label: t('type_furgoneta'), icon: <Text style={{ fontSize: 20 }}>🚐</Text> },
        { id: 'camion', label: t('type_camion'), icon: <Text style={{ fontSize: 20 }}>🚛</Text> },
        { id: 'quad', label: t('type_quad'), icon: <Text style={{ fontSize: 20 }}>🚜</Text> },
    ];

    const handleImagePick = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('permission_denied'), t('gallery_permission_vehicle'));
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error("Error creating image picker:", error);
            Alert.alert(t('error'), t('error_gallery'));
        }
    };

    const getPreviewSource = () => {
        if (image) return { uri: image };
        return require('../../assets/icon.png'); // Fallback to app icon or a default placeholder if available
        // Ideally: return type === 'moto' ? require('../../assets/moto-placeholder.png') : ...
    };

    const handleSave = async () => {
        if (!make || !model) {
            Alert.alert(t('error'), t('error_make_model'));
            return;
        }

        // --- CHECK LIMIT FOR FREE USERS ---
        if (!userProfile?.isPremium) {
            try {
                const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
                const snapshot = await getCountFromServer(q);
                const count = snapshot.data().count;

                if (count >= 2) {
                    Alert.alert(
                        t('limit_reached'),
                        t('limit_desc'),
                        [
                            { text: t('cancel'), style: "cancel" },
                            { text: t('see_premium'), onPress: () => navigation.navigate("Paywall") }
                        ]
                    );
                    return;
                }
            } catch (error) {
                console.error("Error checking vehicle limit:", error);
            }
        }
        // ----------------------------------

        if (loading) return;

        setLoading(true);
        try {
            // Upload image to Storage if exists
            let vehicleImage = `DEFAULT_${type.toUpperCase()}`;
            if (image) {
                const storagePath = `vehicles/${user.uid}_${Date.now()}`;
                vehicleImage = await uploadImage(image, storagePath);
            }

            console.log('Saving vehicle...', { make, model, vehicleImage });

            await addVehicle({
                type,
                make,
                model,
                year,
                usage,
                trackingType,
                name: `${make} ${model}`,
                image: vehicleImage,
                color: '#F2780D',
            });
            console.log('Vehicle saved successfully');

            // Navigate explicitly to the Vehicles list (Garaje tab)
            navigation.navigate('garage', { screen: 'VehiclesList' });
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert(t('error'), t('error_save_vehicle'));
        } finally {
            setLoading(false);
        }
    };

    const getSelectedTypeLabel = () => {
        const selected = vehicleTypes.find(t => t.id === type);
        return selected ? selected.label : t('select_type');
    };

    const renderTypeItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.modalItem, type === item.id && styles.modalItemActive]}
            onPress={() => {
                setType(item.id);
                setShowTypeModal(false);
            }}
        >
            <View style={styles.modalItemContent}>
                {item.icon}
                <Text style={[styles.modalItemText, type === item.id && styles.modalItemTextActive]}>
                    {item.label}
                </Text>
            </View>
            {type === item.id && <Check size={20} color="#F2780D" />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <X size={24} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('new_vehicle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Image Upload Section */}
                    <TouchableOpacity style={styles.imageUpload} onPress={handleImagePick}>
                        <Image source={getPreviewSource()} style={styles.previewImage} resizeMode="cover" />
                        <View style={styles.cameraOverlay}>
                            <Camera size={24} color="#FFF" />
                            <Text style={styles.cameraText}>{t('change_photo')}</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Type Selection Dropdown */}
                    <Text style={styles.label}>{t('vehicle_type')}</Text>
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setShowTypeModal(true)}
                    >
                        <Text style={styles.dropdownText}>{getSelectedTypeLabel()}</Text>
                        <ChevronDown size={20} color="#888" />
                    </TouchableOpacity>

                    {/* Make, Model, Year */}
                    <Text style={styles.label}>{t('details')}</Text>
                    <View style={[styles.inputGroup, { zIndex: 1 }]}>
                        <TextInput
                            style={[styles.input, { height: 50 }]}
                            placeholder={t('make_placeholder')}
                            placeholderTextColor="#666"
                            value={make}
                            onChangeText={setMake}
                            autoComplete="off"
                            textContentType="none"
                            importantForAutofill="no"
                        />
                        <View style={styles.row}>
                            <TextInput
                                style={[styles.input, { flex: 2, marginRight: 12, height: 50 }]}
                                placeholder={t('model_placeholder')}
                                placeholderTextColor="#666"
                                value={model}
                                onChangeText={setModel}
                                autoComplete="off"
                                textContentType="none"
                                importantForAutofill="no"
                            />
                            <TextInput
                                style={[styles.input, { flex: 1, height: 50 }]}
                                placeholder={t('year_placeholder')}
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={year}
                                onChangeText={setYear}
                                autoComplete="off"
                                textContentType="none"
                                importantForAutofill="no"
                            />
                        </View>
                    </View>

                    {/* Tracking Configuration */}
                    <Text style={styles.label}>{t('usage_control')}</Text>
                    <View style={styles.trackingContainer}>
                        <TouchableOpacity
                            style={[styles.trackingOption, trackingType === 'km' && styles.trackingOptionActive]}
                            onPress={() => setTrackingType('km')}
                        >
                            <Map size={20} color={trackingType === 'km' ? '#fff' : '#888'} />
                            <Text style={[styles.trackingText, trackingType === 'km' && styles.trackingTextActive]}>{t('km')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.trackingOption, trackingType === 'h' && styles.trackingOptionActive]}
                            onPress={() => setTrackingType('h')}
                        >
                            <Watch size={20} color={trackingType === 'h' ? '#fff' : '#888'} />
                            <Text style={[styles.trackingText, trackingType === 'h' && styles.trackingTextActive]}>{t('hours')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.helperText}>
                            {t('current_value')} ({trackingType === 'km' ? 'km' : t('hours').toLowerCase()})
                        </Text>
                        <TextInput
                            style={[styles.input, styles.usageInput]}
                            placeholder="0"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={usage}
                            onChangeText={setUsage}
                        />
                        <Text style={styles.helperSubtext}>
                            {t('update_usage_helper')}
                        </Text>
                    </View>

                    <View style={{ height: 20 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#121212" />
                    ) : (
                        <Text style={styles.saveButtonText}>{t('save_vehicle')}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Type Selection Modal */}
            <Modal
                visible={showTypeModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTypeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_type')}</Text>
                            <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                                <X size={24} color="#E0E0E0" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={vehicleTypes}
                            renderItem={renderTypeItem}
                            keyExtractor={item => item.id}
                        />
                    </View>
                </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 24,
    },
    imageUpload: {
        width: '100%',
        height: 180,
        borderRadius: 24,
        backgroundColor: '#1E1E1E',
        overflow: 'hidden',
        marginBottom: 24,
        position: 'relative',
        borderWidth: 1,
        borderColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    cameraText: {
        color: '#FFF',
        marginTop: 8,
        fontWeight: '600',
    },
    label: {
        fontSize: 14,
        color: '#F2780D',
        fontWeight: 'BOLD',
        marginBottom: 12,
        marginTop: 8,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 24,
    },
    dropdownText: {
        fontSize: 16,
        color: '#E0E0E0',
        fontWeight: '500',
    },
    inputGroup: {
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
    },
    input: {
        backgroundColor: '#1E1E1E',
        color: '#E0E0E0',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 12,
    },
    trackingContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: '#1E1E1E', // Container background
        borderRadius: 16,
        padding: 4,
    },
    trackingOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    trackingOptionActive: {
        backgroundColor: '#333',
    },
    trackingText: {
        color: '#888',
        marginLeft: 8,
        fontWeight: '600',
    },
    trackingTextActive: {
        color: '#FFF',
    },
    helperText: {
        color: '#888',
        marginBottom: 8,
        fontSize: 14,
    },
    usageInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F2780D',
        textAlign: 'center',
    },
    helperSubtext: {
        color: '#555',
        fontSize: 12,
        textAlign: 'center',
    },
    footer: {
        padding: 20,
        paddingBottom: 30, // Extra padding for safe area if not using hooks
        backgroundColor: '#121212',
        borderTopWidth: 1,
        borderTopColor: '#1E1E1E',
    },
    saveButton: {
        backgroundColor: '#F2780D',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#121212',
        fontSize: 18,
        fontWeight: 'bold',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        maxHeight: '70%',
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
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    modalItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalItemActive: {
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    modalItemText: {
        fontSize: 16,
        color: '#E0E0E0',
        marginLeft: 16,
    },
    modalItemTextActive: {
        color: '#F2780D',
        fontWeight: 'bold',
    },
});

export default AddVehicleScreen;
