import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Plus, Trash2, Edit2, Wrench, X, Share2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SpotlightOverlay from '../components/SpotlightOverlay';
import { getParts, addPart, deletePart, updatePart } from '../services/partsService';
import { getVehicles } from '../services/vehicleService';
import { useAuth } from '../context/AuthContext';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

const PartsScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isActive = user?.isActive !== false;
    const [parts, setParts] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState(null); // Filter by vehicle ID

    // Add/Edit Modal
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [modalData, setModalData] = useState({ name: '', ref: '', price: '', vehicleId: '', stockQty: '', stockUnit: 'ud' });
    const [saving, setSaving] = useState(false);

    // Spotlight Onboarding State
    const [showSpotlight, setShowSpotlight] = useState(false);
    const { width, height } = Dimensions.get('window');

    const partsSteps = [
        {
            title: 'spotlight_parts_2_title',
            description: 'spotlight_parts_2_desc',
            icon: 'wrench'
        },
        {
            title: 'spotlight_parts_1_title',
            description: 'spotlight_parts_1_desc',
            icon: 'plus'
        }
    ];

    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('hasSeenSpotlightParts');
                if (hasSeen !== 'true') {
                    setTimeout(() => setShowSpotlight(true), 1000);
                }
            } catch (e) {
                console.log('Error checking parts onboarding', e);
            }
        };
        checkOnboarding();
    }, []);

    const handleFinishSpotlight = async () => {
        try {
            await AsyncStorage.setItem('hasSeenSpotlightParts', 'true');
            setShowSpotlight(false);
        } catch (e) {
            setShowSpotlight(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const [partsData, vehiclesData] = await Promise.all([
                getParts(),
                getVehicles()
            ]);
            setParts(partsData);
            setVehicles(vehiclesData);
        } catch (error) {
            console.error("Error fetching parts/vehicles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!isActive) {
            Alert.alert(t('inactive_modal_title'), t('inactive_modal_desc'));
            return;
        }
        if (!modalData.name) {
            Alert.alert(t('error'), t('error_name_required'));
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: modalData.name,
                ref: modalData.ref,
                price: modalData.price ? parseFloat(modalData.price) : 0, // Default to 0 if empty
                stockQty: modalData.stockQty ? parseFloat(modalData.stockQty) : 1,
                stockUnit: modalData.stockUnit || 'ud',
                vehicleId: modalData.vehicleId
            };

            if (isEditing) {
                await updatePart(currentItem.id, payload);
            } else {
                await addPart(payload);
            }

            setShowModal(false);
            fetchData();
        } catch (error) {
            Alert.alert(t('error'), t('error_save_part'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        if (!isActive) {
            Alert.alert(t('inactive_modal_title'), t('inactive_modal_desc'));
            return;
        }
        Alert.alert(
            t('delete_part_title'),
            t('delete_part_confirm'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deletePart(id);
                            fetchData();
                        } catch (error) {
                            Alert.alert(t('error'), t('delete_error'));
                        }
                    }
                }
            ]
        );
    };

    const editItem = (item) => {
        setIsEditing(true);
        setCurrentItem(item);
        setModalData({
            name: item.name,
            ref: item.ref || '',
            price: item.price ? String(item.price) : '',
            stockQty: item.stockQty ? String(item.stockQty) : '1',
            stockUnit: item.stockUnit || 'ud',
            vehicleId: item.vehicleId || ''
        });
        setShowModal(true);
    };

    const openNewModal = () => {
        if (!isActive) {
            Alert.alert(t('inactive_modal_title'), t('inactive_modal_desc'));
            return;
        }
        setIsEditing(false);
        setCurrentItem(null);
        setModalData({ name: '', ref: '', price: '', vehicleId: '', stockQty: '', stockUnit: 'ud' });
        setShowModal(true);
    };

    const filteredParts = parts.filter(part => {
        const matchesSearch = part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (part.ref && part.ref.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesVehicle = selectedVehicle ? part.vehicleId === selectedVehicle : true;

        return matchesSearch && matchesVehicle;
    });

    const getVehicleName = (id) => {
        const v = vehicles.find(v => v.id === id);
        return v ? v.name : t('general');
    };

    const generatePDF = async () => {
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('pdf_title')}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                h1 { text-align: center; color: #F2780D; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8f8f8; font-weight: bold; color: #121212; }
                tr:hover { background-color: #f5f5f5; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; }
            </style>
        </head>
        <body>
            <h1>${t('pdf_title')}</h1>
            <p>${t('vehicle')}: ${selectedVehicle ? getVehicleName(selectedVehicle) : t('all')}</p>
            <table>
                <thead>
                    <tr>
                        <th>${t('name')}</th>
                        <th>${t('reference')}</th>
                        <th>${t('quantity')}</th>
                        <th>${t('vehicle')}</th>
                        <th>${t('price')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredParts.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.ref || '-'}</td>
                            <td>${item.stockQty || '1'} ${item.stockUnit || 'ud'}</td>
                            <td>${getVehicleName(item.vehicleId)}</td>
                            <td>${item.price} €</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                ${t('generated_by')}
            </div>
        </body>
        </html>
    `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert(t('error'), t('generate_pdf_error'));
            console.error(error);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View style={styles.iconBg}>
                    <Wrench size={20} color="#F2780D" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemName}>
                        {item.name}
                        {item.stockQty && (
                            <Text style={{ fontSize: 14, fontWeight: 'normal', color: '#F2780D' }}>
                                {`  •  ${item.stockQty} ${item.stockUnit || ''}`}
                            </Text>
                        )}
                    </Text>
                    {item.ref ? <Text style={styles.itemRef}>Ref: {item.ref}</Text> : null}
                    <Text style={styles.itemVehicle}>{getVehicleName(item.vehicleId)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemPrice}>{item.price} €</Text>
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={() => isActive ? editItem(item) : Alert.alert(t('inactive_modal_title'), t('inactive_modal_desc'))} style={[styles.actionBtn, !isActive && { opacity: 0.5 }]}>
                            <Edit2 size={16} color="#888" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => isActive ? handleDelete(item.id) : Alert.alert(t('inactive_modal_title'), t('inactive_modal_desc'))} style={[styles.actionBtn, { marginLeft: 12 }, !isActive && { opacity: 0.5 }]}>
                            <Trash2 size={16} color="#FF5252" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('parts')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={{ padding: 8, marginRight: 8 }} onPress={generatePDF}>
                        <Share2 size={24} color="#F2780D" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.addButton, !isActive && { opacity: 0.5 }]} onPress={openNewModal}>
                        <Plus size={24} color="#121212" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search & Filter */}
            <View style={styles.filters}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#666" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('search_part')}
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleFilter}>
                    <TouchableOpacity
                        style={[styles.filterChip, !selectedVehicle && styles.filterChipActive]}
                        onPress={() => setSelectedVehicle(null)}
                    >
                        <Text style={[styles.filterText, !selectedVehicle && styles.filterTextActive]}>{t('all')}</Text>
                    </TouchableOpacity>
                    {vehicles.map(v => (
                        <TouchableOpacity
                            key={v.id}
                            style={[styles.filterChip, selectedVehicle === v.id && styles.filterChipActive]}
                            onPress={() => setSelectedVehicle(v.id)}
                        >
                            <Text style={[styles.filterText, selectedVehicle === v.id && styles.filterTextActive]}>{v.make} {v.model}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#F2780D" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filteredParts}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>{t('no_parts')}</Text>
                        </View>
                    }
                />
            )}

            {/* Add/Edit Modal */}
            <Modal
                visible={showModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{isEditing ? t('edit_part') : t('new_part')}</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <X size={24} color="#E0E0E0" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.label}>{t('name')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('name_placeholder')}
                                placeholderTextColor="#666"
                                value={modalData.name}
                                onChangeText={t => setModalData({ ...modalData, name: t })}
                            />

                            <Text style={styles.label}>{t('ref_optional')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('ref_placeholder')}
                                placeholderTextColor="#666"
                                value={modalData.ref}
                                onChangeText={t => setModalData({ ...modalData, ref: t })}
                            />

                            <Text style={styles.label}>{t('qty_unit')}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 12 }]}
                                    placeholder="Ej. 1000"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={modalData.stockQty}
                                    onChangeText={t => setModalData({ ...modalData, stockQty: t })}
                                />
                                <View style={{ flexDirection: 'row' }}>
                                    {['ud', 'L', 'ml'].map(u => (
                                        <TouchableOpacity
                                            key={u}
                                            style={[
                                                styles.unitChip,
                                                modalData.stockUnit === u && styles.unitChipActive
                                            ]}
                                            onPress={() => setModalData({ ...modalData, stockUnit: u })}
                                        >
                                            <Text style={[
                                                styles.unitChipText,
                                                modalData.stockUnit === u && styles.unitChipTextActive
                                            ]}>{u}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <Text style={styles.label}>{t('price')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={modalData.price}
                                onChangeText={t => setModalData({ ...modalData, price: t })}
                            />

                            <Text style={styles.label}>{t('vehicle_optional')}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                                <TouchableOpacity
                                    style={[styles.vehicleChip, !modalData.vehicleId && styles.vehicleChipActive]}
                                    onPress={() => setModalData({ ...modalData, vehicleId: '' })}
                                >
                                    <Text style={[styles.vehicleChipText, !modalData.vehicleId && styles.vehicleChipTextActive]}>{t('general')}</Text>
                                </TouchableOpacity>
                                {vehicles.map(v => (
                                    <TouchableOpacity
                                        key={v.id}
                                        style={[styles.vehicleChip, modalData.vehicleId === v.id && styles.vehicleChipActive]}
                                        onPress={() => setModalData({ ...modalData, vehicleId: v.id })}
                                    >
                                        <Text style={[styles.vehicleChipText, modalData.vehicleId === v.id && styles.vehicleChipTextActive]}>
                                            {v.make} {v.model}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#121212" />
                                ) : (
                                    <Text style={styles.saveBtnText}>{t('save')}</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            <SpotlightOverlay
                visible={showSpotlight}
                steps={partsSteps}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    addButton: {
        backgroundColor: '#F2780D',
        padding: 12,
        borderRadius: 12,
    },
    filters: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        color: '#E0E0E0',
        marginLeft: 10,
        fontSize: 16,
    },
    vehicleFilter: {
        flexDirection: 'row',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1E1E1E',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    filterChipActive: {
        backgroundColor: '#F2780D',
        borderColor: '#F2780D',
    },
    filterText: {
        color: '#888',
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#121212',
    },
    listContent: {
        padding: 20,
        paddingTop: 0,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 2,
    },
    itemRef: {
        fontSize: 12,
        color: '#888',
        marginBottom: 2,
    },
    itemVehicle: {
        fontSize: 12,
        color: '#555',
        fontStyle: 'italic',
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F2780D',
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
    },
    actionBtn: {
        padding: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    label: {
        color: '#F2780D',
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 8,
    },
    input: {
        backgroundColor: '#121212',
        color: '#E0E0E0',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 16,
    },
    vehicleChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#121212',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    vehicleChipActive: {
        backgroundColor: 'rgba(242, 120, 13, 0.2)',
        borderColor: '#F2780D',
    },
    vehicleChipText: {
        color: '#888',
    },
    vehicleChipTextActive: {
        color: '#F2780D',
        fontWeight: 'bold',
    },
    saveBtn: {
        backgroundColor: '#F2780D',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 40,
    },
    saveBtnText: {
        color: '#121212',
        fontSize: 18,
        fontWeight: 'bold',
    },
    unitChip: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#121212',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    unitChipActive: {
        backgroundColor: 'rgba(242, 120, 13, 0.2)',
        borderColor: '#F2780D',
    },
    unitChipText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 14,
    },
    unitChipTextActive: {
        color: '#F2780D',
    },
});

export default PartsScreen;
