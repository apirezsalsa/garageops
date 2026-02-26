import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, FlatList, Switch, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2, ChevronDown, Check, Package, Clock, Map, AlertTriangle, Calendar, Camera, Search, X } from 'lucide-react-native';
import { addMaintenance, updateMaintenance, deleteMaintenance } from '../services/maintenanceService';
import { getParts, addPart } from '../services/partsService';
import { uploadImage } from '../services/uploadService';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

const MOTO_CATEGORIES = [
    { id: 'revisiones', label: 'cat_revisions', types: ['type_revision_a', 'type_revision_b', 'type_revision_general'] },
    { id: 'motor', label: 'cat_motor', types: ['type_oil_change', 'type_oil_filter', 'type_piston', 'type_valves', 'type_spark_plug', 'type_clutch', 'type_coolant', 'type_timing_chain'] },
    { id: 'chasis', label: 'cat_chassis', types: ['type_chain_kit', 'type_front_pads', 'type_rear_pads', 'type_brake_fluid', 'type_suspension', 'type_bearings', 'type_greasing'] },
    { id: 'ruedas', label: 'cat_wheels', types: ['type_front_tire', 'type_rear_tire', 'type_tube', 'type_mousse', 'type_spokes', 'type_pressure'] },
    { id: 'aire', label: 'cat_intake', types: ['type_air_filter_clean', 'type_air_filter_new', 'type_carb_injection'] },
    { id: 'electrico', label: 'cat_electrical', types: ['type_battery', 'type_starter_motor', 'type_lights', 'type_fuses'] },
    { id: 'otro', label: 'cat_general', types: ['type_wash', 'type_itv', 'type_insurance', 'type_tax'] },
];

const CAR_CATEGORIES = [
    { id: 'revisiones', label: 'cat_revisions', types: ['type_revision_a', 'type_revision_b', 'type_revision_general'] },
    { id: 'motor', label: 'cat_motor', types: ['type_oil_change', 'type_oil_filter', 'type_fuel_filter', 'type_timing_belt', 'type_water_pump', 'type_accessory_belt', 'type_coolant', 'type_adblue'] },
    { id: 'frenos', label: 'cat_brakes', types: ['type_front_pads', 'type_front_discs', 'type_rear_pads', 'type_rear_discs', 'type_brake_fluid'] },
    { id: 'neumaticos', label: 'cat_tires', types: ['type_front_tires', 'type_rear_tires', 'type_rotation', 'type_alignment', 'type_pressure'] },
    { id: 'filtros', label: 'cat_filters', types: ['type_engine_air_filter', 'type_cabin_filter'] },
    { id: 'electrico', label: 'cat_electrical', types: ['type_battery', 'type_glow_plugs', 'type_lights', 'type_wipers'] },
    { id: 'otro', label: 'cat_general', types: ['type_wash', 'type_itv', 'type_insurance', 'type_tax'] },
];

const getCategories = (vehicleType) => {
    if (!vehicleType) return MOTO_CATEGORIES;
    const type = vehicleType.toLowerCase();
    if (['coche', 'furgoneta', 'camion'].includes(type)) {
        return CAR_CATEGORIES;
    }
    return MOTO_CATEGORIES;
};

const AddMaintenanceScreen = ({ navigation, route }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { vehicle, maintenanceItem, isEditing } = route.params || {};
    const trackingUnit = vehicle?.trackingType === 'h' ? 'h' : 'km';

    // State initialization helper
    const getInitialDateOption = () => {
        if (!isEditing || !maintenanceItem?.date) return 'today';
        // Check if date is today
        const d = maintenanceItem.date.toDate ? maintenanceItem.date.toDate() : new Date(maintenanceItem.date);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'today';

        // Check if date is yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'yesterday';

        return 'custom';
    };

    const getInitialCustomDate = () => {
        if (!isEditing || !maintenanceItem?.date) return new Date();
        const d = maintenanceItem.date.toDate ? maintenanceItem.date.toDate() : new Date(maintenanceItem.date);
        return d;
    };

    // State
    const [currentUsage, setCurrentUsage] = useState(
        isEditing ? (maintenanceItem?.usage || '') // Use saved usage
            : (vehicle?.usage ? String(vehicle.usage).replace(/[^0-9.]/g, '') : '')
    );
    const [dateOption, setDateOption] = useState(getInitialDateOption());
    const [customDate, setCustomDate] = useState(getInitialCustomDate());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Component variables
    const vehicleCategories = getCategories(vehicle?.type);

    // Job Classification
    const [selectedCategory, setSelectedCategory] = useState(
        isEditing
            ? vehicleCategories.find(c => c.id === maintenanceItem?.category) || vehicleCategories[0]
            : null
    );
    // If "type" allows custom string (e.g. "Otro"), handle it
    const initialType = isEditing ? maintenanceItem?.type : null;
    const isStandardType = isEditing && selectedCategory?.types.includes(initialType);

    const [selectedType, setSelectedType] = useState(
        isEditing && isStandardType ? initialType : (isEditing ? 'other' : null)
    );
    const [customType, setCustomType] = useState(
        isEditing && !isStandardType ? initialType : ''
    );

    const [showTypeModal, setShowTypeModal] = useState(false);

    // Components
    // Components logic with Catalog
    const [components, setComponents] = useState(isEditing ? maintenanceItem?.parts || [] : []);
    const [showComponentForm, setShowComponentForm] = useState(false);
    const [compName, setCompName] = useState('');
    const [compPartNumber, setCompPartNumber] = useState('');
    const [compPrice, setCompPrice] = useState('');
    const [compQty, setCompQty] = useState('');
    const [compUnit, setCompUnit] = useState('ud');

    // Parts Catalog Integration
    const [allParts, setAllParts] = useState([]);
    const [showPartsPicker, setShowPartsPicker] = useState(false);
    const [partSearch, setPartSearch] = useState('');
    const [selectedPart, setSelectedPart] = useState(null); // Full part object for calculations

    useEffect(() => {
        loadParts();
    }, []);

    // Auto-calculate price based on quantity and selected part
    useEffect(() => {
        const normalizedQty = compQty ? compQty.replace(',', '.') : '';
        if (selectedPart && normalizedQty && !isNaN(parseFloat(normalizedQty)) && selectedPart.stockQty && selectedPart.price) {
            let qty = parseFloat(normalizedQty);
            const stockQty = parseFloat(selectedPart.stockQty);
            const price = parseFloat(selectedPart.price);

            // Unit conversion logic
            if (selectedPart.stockUnit !== compUnit) {
                if (selectedPart.stockUnit === 'L' && compUnit === 'ml') {
                    qty = qty / 1000;
                } else if (selectedPart.stockUnit === 'ml' && compUnit === 'L') {
                    qty = qty * 1000;
                }
            }

            if (stockQty > 0) {
                const calculatedPrice = (price / stockQty) * qty;
                setCompPrice(calculatedPrice.toFixed(2));
            }
        }
    }, [compQty, selectedPart, compUnit]);

    const loadParts = async () => {
        const p = await getParts();
        setAllParts(p);
    };

    // Receipt Image State
    const [receiptImage, setReceiptImage] = useState(isEditing ? maintenanceItem?.receiptImage : null);

    const handlePickReceipt = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('permission_denied'), t('gallery_permission'));
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setReceiptImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error("Error picking receipt:", error);
            Alert.alert(t('error'), t('error_select_image'));
        }
    };

    const [editingComponentId, setEditingComponentId] = useState(null);

    // ... (rest of state)

    const handleEditComponent = (comp) => {
        setEditingComponentId(comp.id);
        setCompName(comp.name);
        setCompPartNumber(comp.ref || comp.partNumber || '');
        setCompPrice(comp.price ? String(comp.price) : '');

        // Parse quantity string "800 ml" -> qty: 800, unit: ml
        if (comp.quantity) {
            const parts = comp.quantity.split(' ');
            if (parts.length === 2) {
                setCompQty(parts[0]);
                setCompUnit(parts[1]);
            } else {
                setCompQty(comp.quantity);
                setCompUnit('ud'); // Default or try to guess?
            }
        } else {
            setCompQty('');
            setCompUnit('ud');
        }

        setShowComponentForm(true);
    };

    const handleAddComponent = async () => {
        if (!compName) return;

        const componentData = {
            id: editingComponentId || Date.now().toString(),
            name: compName,
            ref: compPartNumber,
            price: compPrice,
            quantity: compQty ? `${compQty} ${compUnit}` : '1'
        };

        if (editingComponentId) {
            setComponents(components.map(c => c.id === editingComponentId ? componentData : c));
        } else {
            setComponents([...components, componentData]);

            // Auto-save to catalog only if new and not editing an existing maintenance item
            const existing = allParts.find(p => p.name.toLowerCase() === compName.toLowerCase());
            if (!existing) {
                try {
                    await addPart({
                        name: compName,
                        ref: compPartNumber,
                        price: parseFloat(compPrice) || 0,
                        vehicleId: vehicle ? vehicle.id : null,
                        stockQty: parseFloat(compQty) || 1,
                        stockUnit: compUnit
                    });
                    loadParts();
                } catch (e) {
                    console.log("Error auto-saving part", e);
                }
            }
        }

        setCompName('');
        setCompPartNumber('');
        setCompPrice('');
        setCompQty('');
        setCompUnit('ud');
        setEditingComponentId(null);
        setSelectedPart(null);
        setShowComponentForm(false);
    };

    const removeComponent = (id) => {
        setComponents(components.filter(c => c.id !== id));
    };

    const selectPartFromCatalog = (part) => {
        setSelectedPart(part);
        setCompName(part.name);
        setCompPartNumber(part.ref || '');
        setCompPrice(''); // Reset price to let calculation fill it
        setCompQty('');
        setCompUnit(part.stockUnit || 'ud');
        setShowPartsPicker(false);
        setShowComponentForm(true);
    };

    const filteredCatalog = allParts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
            (p.ref && p.ref.toLowerCase().includes(partSearch.toLowerCase()));

        // Filter: Show specific parts for this vehicle OR universal parts (no vehicleId)
        // If current vehicle is unknown, show all? Better to be safe.
        const matchesVehicle = !p.vehicleId || (vehicle && p.vehicleId === vehicle.id);

        return matchesSearch && matchesVehicle;
    });

    // Alerts / Interval
    const [isAlertEnabled, setIsAlertEnabled] = useState(isEditing ? !!maintenanceItem?.alertEnabled : false);
    const [alertInterval, setAlertInterval] = useState(isEditing ? (maintenanceItem?.alertInterval || '') : '');
    const [notes, setNotes] = useState(isEditing ? maintenanceItem?.notes : '');
    const [duration, setDuration] = useState(isEditing ? maintenanceItem?.duration : '');
    const [loading, setLoading] = useState(false);

    const getJobTitle = () => {
        if (selectedType === 'other') return customType || t('custom');
        return selectedType ? t(selectedType) : t('select_task');
    };

    const renderTypeItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.modalItem, selectedType === item && styles.modalItemActive]}
            onPress={() => {
                setSelectedType(item);
                if (item !== 'other') setCustomType('');
                setShowTypeModal(false);
            }}
        >
            <Text style={[styles.modalItemText, selectedType === item && styles.modalItemTextActive]}>
                {t(item)}
            </Text>
            {selectedType === item && <Check size={20} color="#F2780D" />}
        </TouchableOpacity>
    );

    const getTypeOptions = () => {
        if (!selectedCategory) return [];
        return [...selectedCategory.types, 'other'];
    };

    const handleSave = async () => {
        if ((!selectedType && !customType) || !currentUsage) {
            Alert.alert(t('error'), t('error_job_reading'));
            return;
        }

        setLoading(true);
        try {

            // Parse Date
            let dateToSave = new Date();
            if (dateOption === 'yesterday') {
                dateToSave.setDate(dateToSave.getDate() - 1);
            } else if (dateOption === 'custom') {
                dateToSave = customDate;
            }

            // Upload image to Storage if exists
            let imageToSave = receiptImage;
            if (receiptImage && (receiptImage.startsWith('file://') || receiptImage.startsWith('content://') || receiptImage.startsWith('data:'))) {
                const storagePath = `receipts/${user.uid}_${Date.now()}`;
                imageToSave = await uploadImage(receiptImage, storagePath);
            }

            const maintenanceData = {
                date: dateToSave,
                category: selectedCategory?.id || 'other',
                type: getJobTitle(),
                usage: currentUsage,
                parts: components,
                alertEnabled: isAlertEnabled,
                alertInterval: alertInterval,
                notes: notes,
                duration: duration,
                totalCost: components.reduce((sum, c) => {
                    // Ensure price is treated as a safe float
                    const priceStr = String(c.price || '0').replace(',', '.');
                    const priceVal = parseFloat(priceStr);
                    return sum + (isNaN(priceVal) ? 0 : priceVal);
                }, 0),
                receiptImage: imageToSave
            };

            if (isEditing) {
                await updateMaintenance(maintenanceItem.id, maintenanceData);
            } else {
                await addMaintenance(vehicle.id, maintenanceData);
            }

            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert(t('error'), t('error_save_maintenance'));
        } finally {
            setLoading(false);
        }
    };
    const handleDelete = () => {
        Alert.alert(
            t('delete_maintenance'),
            t('delete_maintenance_confirm'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteMaintenance(maintenanceItem.id);
                            // Navigate back to history/vehicle detail effectively bypassing the Detail screen which now has deleted data
                            // Assuming stack: VehicleDetail -> MaintenanceDetail -> AddMaintenance
                            // popping 2 would work, or navigating explicitly.
                            navigation.pop(2);
                        } catch (error) {
                            console.error(error);
                            Alert.alert(t('error'), t('delete_error'));
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.title}>{isEditing ? t('edit_maintenance') : t('new_maintenance_title')}</Text>
                {isEditing ? (
                    <TouchableOpacity onPress={handleDelete} style={{ padding: 4 }}>
                        <Trash2 size={24} color="#FF5252" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 28 }} />
                )}
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* 1. Usage Record */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeaderRow}>
                            {trackingUnit === 'h' ? <Clock size={16} color="#F2780D" /> : <Map size={16} color="#2196F3" />}
                            <Text style={styles.sectionTitle}>{t('current_reading')}</Text>
                        </View>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.mainInput}
                                value={currentUsage}
                                onChangeText={setCurrentUsage}
                                keyboardType="numeric"
                                placeholder="0.0"
                                placeholderTextColor="#666"
                            />
                            <Text style={styles.unitSuffix}>{trackingUnit}</Text>
                        </View>
                    </View>

                    {/* 2. Date & Receipt */}
                    <Text style={styles.sectionLabel}>{t('date_documentation')}</Text>
                    <View style={styles.sectionContainer}>
                        {/* Date Selection */}
                        <View style={styles.dateRow}>
                            <TouchableOpacity
                                style={[styles.dateButton, dateOption === 'today' && styles.dateButtonActive]}
                                onPress={() => setDateOption('today')}
                            >
                                <Text style={[styles.dateText, dateOption === 'today' && styles.dateTextActive]}>{t('today')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dateButton, dateOption === 'yesterday' && styles.dateButtonActive]}
                                onPress={() => setDateOption('yesterday')}
                            >
                                <Text style={[styles.dateText, dateOption === 'yesterday' && styles.dateTextActive]}>{t('yesterday')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dateButton, dateOption === 'custom' && styles.dateButtonActive]}
                                onPress={() => {
                                    setDateOption('custom');
                                    setShowDatePicker(true);
                                }}
                            >
                                <Calendar size={16} color={dateOption === 'custom' ? '#121212' : '#888'} />
                                {dateOption === 'custom' ? (
                                    <Text style={[styles.dateText, styles.dateTextActive, { marginLeft: 6 }]}>
                                        {customDate.toLocaleDateString('es-ES')}
                                    </Text>
                                ) : (
                                    <Text style={[styles.dateText, { marginLeft: 6 }]}>{t('other')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Date Picker Modal */}
                        {showDatePicker && (
                            Platform.OS === 'ios' ? (
                                <Modal
                                    transparent={true}
                                    animationType="fade"
                                    visible={showDatePicker}
                                    onRequestClose={() => setShowDatePicker(false)}
                                >
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
                                        <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 20, width: '90%' }}>
                                            <DateTimePicker
                                                value={customDate}
                                                mode="date"
                                                display="inline"
                                                themeVariant="light"
                                                onChange={(event, selectedDate) => {
                                                    if (selectedDate) setCustomDate(selectedDate);
                                                }}
                                                style={{ height: 320 }}
                                            />
                                            <TouchableOpacity
                                                onPress={() => setShowDatePicker(false)}
                                                style={{ backgroundColor: '#F2780D', padding: 12, borderRadius: 10, marginTop: 10, alignItems: 'center' }}
                                            >
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{t('confirm_date')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={customDate}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) {
                                            setCustomDate(selectedDate);
                                        }
                                    }}
                                />
                            )
                        )}

                        <View style={styles.divider} />

                        {receiptImage ? (
                            <View style={styles.receiptPreviewContainer}>
                                <Image source={{ uri: receiptImage }} style={styles.receiptPreview} resizeMode="contain" />
                                <TouchableOpacity
                                    style={styles.removeReceiptButton}
                                    onPress={() => setReceiptImage(null)}
                                >
                                    <X size={20} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.receiptButton} onPress={handlePickReceipt}>
                                <Camera size={20} color="#F2780D" />
                                <Text style={styles.receiptText}>{t('attach_receipt')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* 3. Job Classification */}
                    <Text style={styles.sectionLabel}>{t('job_details')}</Text>

                    {/* Categories */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
                        {vehicleCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.categoryChip, selectedCategory?.id === cat.id && styles.categoryChipActive]}
                                onPress={() => {
                                    setSelectedCategory(cat);
                                    setSelectedType(null);
                                    setCustomType('');
                                }}
                            >
                                <Text style={[styles.categoryText, selectedCategory?.id === cat.id && styles.categoryTextActive]}>
                                    {t(cat.label)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Type Dropdown */}
                    <TouchableOpacity
                        style={[styles.dropdownButton, !selectedCategory && styles.disabledButton]}
                        onPress={() => selectedCategory && setShowTypeModal(true)}
                        disabled={!selectedCategory}
                    >
                        <Text style={[styles.dropdownText, !selectedCategory && { color: '#666' }]}>
                            {getJobTitle()}
                        </Text>
                        <ChevronDown size={20} color={selectedCategory ? "#F2780D" : "#666"} />
                    </TouchableOpacity>

                    {/* Custom Type Input */}
                    {selectedType === 'other' && (
                        <TextInput
                            style={styles.input}
                            placeholder={t('job_name_placeholder')}
                            placeholderTextColor="#666"
                            value={customType}
                            onChangeText={setCustomType}
                            autoFocus
                        />
                    )}

                    {/* 3. Parts & Spares */}
                    {(selectedType || customType) && (
                        <View style={styles.fadeIn}>
                            <View style={styles.componentsHeader}>
                                <Text style={styles.sectionLabel}>{t('parts_spares')}</Text>
                            </View>

                            {/* List of Added Components */}
                            {components.map((comp) => {
                                const isMissingPrice = !comp.price || parseFloat(comp.price) === 0;
                                return (
                                    <View key={comp.id} style={[styles.componentCard, isMissingPrice && { borderColor: '#FFC107', borderWidth: 1 }]}>
                                        <View style={styles.componentIcon}>
                                            <Package size={20} color={isMissingPrice ? "#FFC107" : "#888"} />
                                        </View>
                                        <TouchableOpacity
                                            style={styles.componentInfo}
                                            onPress={() => handleEditComponent(comp)}
                                        >
                                            <Text style={[styles.compName, isMissingPrice && { color: '#FFC107' }]}>{comp.name}</Text>
                                            <Text style={styles.compDetails}>
                                                {comp.quantity && <Text style={{ color: '#F2780D', fontWeight: 'bold' }}>{comp.quantity} • </Text>}
                                                {comp.partNumber ? `Ref: ${comp.partNumber}` : ''}
                                                {isMissingPrice ?
                                                    <Text style={{ color: '#FFC107', fontWeight: 'bold' }}> • {t('missing_price')}</Text>
                                                    : ` • ${comp.price}€`
                                                }
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => removeComponent(comp.id)} style={{ padding: 8 }}>
                                            <Trash2 size={20} color="#FF5252" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}

                            {/* Total Cost Display */}
                            {components.length > 0 && (
                                <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#333', marginTop: 8, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <Text style={{ color: '#888', fontSize: 14 }}>{t('estimated_total')}</Text>
                                        {components.some(c => !c.price || parseFloat(c.price) === 0) && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <AlertTriangle size={12} color="#FFC107" />
                                                <Text style={{ color: '#FFC107', fontSize: 12, marginLeft: 4 }}>{t('missing_prices')}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{
                                        fontSize: 20,
                                        fontWeight: 'bold',
                                        color: components.some(c => !c.price || parseFloat(c.price) === 0) ? '#FFC107' : '#E0E0E0'
                                    }}>
                                        {components.reduce((sum, c) => {
                                            const priceStr = String(c.price || '0').replace(',', '.');
                                            const priceVal = parseFloat(priceStr);
                                            return sum + (isNaN(priceVal) ? 0 : priceVal);
                                        }, 0).toFixed(2)} €
                                    </Text>
                                </View>
                            )}

                            {/* Add Component Button / Form */}
                            {showComponentForm ? (
                                <View style={styles.componentForm}>
                                    <Text style={styles.formTitle}>{editingComponentId ? t('edit_part_fluid') : t('add_part_fluid')}</Text>

                                    <TouchableOpacity
                                        style={styles.catalogSearchButton}
                                        onPress={() => setShowPartsPicker(true)}
                                    >
                                        <Search size={16} color="#121212" />
                                        <Text style={styles.catalogSearchText}>{t('search_my_parts')}</Text>
                                    </TouchableOpacity>

                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 2, marginRight: 10 }]}
                                            placeholder={t('part_name_placeholder')}
                                            placeholderTextColor="#666"
                                            value={compName}
                                            onChangeText={setCompName}
                                        />
                                    </View>

                                    <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                                        <TextInput
                                            style={[styles.input, { flex: 0.8, marginBottom: 0, marginRight: 8, textAlign: 'center' }]}
                                            placeholder={t('qty_abbr')}
                                            placeholderTextColor="#666"
                                            keyboardType="numeric"
                                            value={compQty}
                                            onChangeText={setCompQty}
                                        />

                                        <View style={{ flexDirection: 'row', marginRight: 8 }}>
                                            {['ud', 'L', 'ml'].map(u => (
                                                <TouchableOpacity
                                                    key={u}
                                                    style={[
                                                        styles.unitChipSmall,
                                                        compUnit === u && styles.unitChipActive
                                                    ]}
                                                    onPress={() => setCompUnit(u)}
                                                >
                                                    <Text style={[
                                                        styles.unitChipTextSmall,
                                                        compUnit === u && styles.unitChipTextActive
                                                    ]}>{u}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <TextInput
                                            style={[styles.input, { flex: 1, marginBottom: 0, textAlign: 'right' }]}
                                            placeholder={t('price')}
                                            placeholderTextColor="#666"
                                            keyboardType="numeric"
                                            value={compPrice}
                                            onChangeText={setCompPrice}
                                        />
                                    </View>

                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder={t('ref_optional')}
                                            placeholderTextColor="#666"
                                            value={compPartNumber}
                                            onChangeText={setCompPartNumber}
                                        />
                                    </View>

                                    <View style={styles.formActions}>
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={() => {
                                                setShowComponentForm(false);
                                                setEditingComponentId(null);
                                                setCompName('');
                                                setCompPrice('');
                                                setCompQty('');
                                                setCompPartNumber('');
                                            }}
                                        >
                                            <Text style={styles.cancelText}>{t('cancel')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.confirmButton, !compName && { opacity: 0.5 }]}
                                            onPress={handleAddComponent}
                                            disabled={!compName}
                                        >
                                            <Text style={styles.confirmText}>{editingComponentId ? t('update') : t('add')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.addComponentButtonFull}
                                    onPress={() => setShowComponentForm(true)}
                                >
                                    <Plus size={20} color="#121212" />
                                    <Text style={styles.addComponentTextDark}>{t('add_part')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* 4. Alerts & Intervals */}
                    {/* 4. Alerts & Intervals */}
                    <View style={[styles.sectionContainer, { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                            <AlertTriangle size={16} color="#F2780D" />
                            <Text style={styles.sectionTitle}>{t('schedule_next')}</Text>
                        </View>

                        <View style={styles.alertRow}>
                            <Text style={styles.settingLabel}>{t('remind_repeat')}</Text>
                            <Switch
                                trackColor={{ false: "#333", true: "rgba(242, 120, 13, 0.4)" }}
                                thumbColor={isAlertEnabled ? "#F2780D" : "#f4f3f4"}
                                onValueChange={setIsAlertEnabled}
                                value={isAlertEnabled}
                            />
                        </View>

                        {isAlertEnabled && (
                            <View style={styles.intervalInputContainer}>
                                <Text style={styles.intervalLabel}>{t('repeat_every')}</Text>
                                <TextInput
                                    style={styles.intervalInput}
                                    placeholder={t('repeat_placeholder')}
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={alertInterval}
                                    onChangeText={setAlertInterval}
                                />
                                <Text style={styles.intervalUnit}>{trackingUnit}</Text>
                            </View>
                        )}
                    </View>

                    {/* 5. Notes & Time */}
                    <Text style={styles.sectionLabel}>{t('additional_details')}</Text>
                    <View style={styles.sectionContainer}>
                        <View style={styles.inputWrapper}>
                            <Clock size={20} color="#888" style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.textInputSimple}
                                placeholder={t('time_spent_placeholder')}
                                placeholderTextColor="#666"
                                value={duration}
                                onChangeText={setDuration}
                            />
                        </View>

                        <View style={[styles.inputWrapper, { marginTop: 12, alignItems: 'flex-start', paddingVertical: 12 }]}>
                            <TextInput
                                style={[styles.textInputSimple, { height: 80, textAlignVertical: 'top' }]}
                                placeholder={t('notes_placeholder')}
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                                value={notes}
                                onChangeText={setNotes}
                            />
                        </View>
                    </View>

                    <View style={{ height: 20 }} />
                </ScrollView >
            </KeyboardAvoidingView >

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveMainButton, ((!selectedType && !customType) || loading) && { opacity: 0.5, backgroundColor: '#333' }]}
                    disabled={(!selectedType && !customType) || loading}
                    onPress={handleSave}
                >
                    {loading ? (
                        <ActivityIndicator color="#121212" />
                    ) : (
                        <Text style={styles.saveMainText}>{isEditing ? t('update_maintenance') : t('save_maintenance')}</Text>
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
                            <Text style={styles.modalTitle}>{t('task_of')} {selectedCategory ? t(selectedCategory.label) : ''}</Text>
                            <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                                <Text style={{ color: '#F2780D', fontWeight: 'bold' }}>{t('close')}</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={getTypeOptions()}
                            renderItem={renderTypeItem}
                            keyExtractor={(item, index) => index.toString()}
                        />
                    </View>
                </View>
            </Modal>

            {/* Parts Picker Modal */}
            <Modal
                visible={showPartsPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPartsPicker(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_part')}</Text>
                            <TouchableOpacity onPress={() => setShowPartsPicker(false)}>
                                <X size={24} color="#E0E0E0" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchBar}>
                            <Search size={20} color="#666" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('search')}
                                placeholderTextColor="#666"
                                value={partSearch}
                                onChangeText={setPartSearch}
                            />
                        </View>

                        <FlatList
                            data={filteredCatalog}
                            keyExtractor={item => item.id}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => selectPartFromCatalog(item)}
                                >
                                    <View>
                                        <Text style={styles.modalItemText}>{item.name}</Text>
                                        {item.ref ? <Text style={{ color: '#666', fontSize: 12 }}>Ref: {item.ref}</Text> : null}
                                    </View>
                                    <Text style={{ color: '#F2780D', fontWeight: 'bold' }}>{item.price} €</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>{t('no_parts_found')}</Text>}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    scrollContent: {
        padding: 24,
    },
    sectionContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#E0E0E0',
        fontWeight: 'bold',
        marginLeft: 8,
        fontSize: 14,
        textTransform: 'uppercase',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#121212',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        paddingHorizontal: 16,
    },
    mainInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F2780D',
        paddingVertical: 12,
    },
    unitSuffix: {
        fontSize: 16,
        color: '#888',
        fontWeight: '600',
    },
    sectionLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 12,
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    categoriesRow: {
        marginBottom: 20,
        maxHeight: 50,
    },
    categoryChip: {
        backgroundColor: '#1E1E1E',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#333',
        height: 40,
        justifyContent: 'center',
    },
    categoryChipActive: {
        backgroundColor: '#F2780D',
        borderColor: '#F2780D',
    },
    categoryText: {
        color: '#E0E0E0',
        fontWeight: '600',
        fontSize: 13,
    },
    categoryTextActive: {
        color: '#121212',
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
        marginBottom: 16,
    },
    disabledButton: {
        opacity: 0.5,
    },
    dropdownText: {
        fontSize: 16,
        color: '#E0E0E0',
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#121212',
        color: '#E0E0E0',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 10,
        fontSize: 16,
    },
    componentsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 16,
    },
    addComponentButtonSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    addComponentText: {
        color: '#F2780D',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 4,
    },
    componentForm: {
        backgroundColor: '#1E1E1E',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(242, 120, 13, 0.3)',
    },
    formTitle: {
        color: '#E0E0E0',
        fontWeight: 'bold',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    cancelButton: {
        padding: 10,
        marginRight: 10,
    },
    cancelText: {
        color: '#888',
    },
    confirmButton: {
        backgroundColor: '#F2780D',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    confirmText: {
        color: '#121212',
        fontWeight: 'bold',
    },
    componentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    componentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    componentInfo: {
        flex: 1,
    },
    compName: {
        color: '#E0E0E0',
        fontWeight: 'bold',
        fontSize: 15,
    },
    compDetails: {
        color: '#888',
        fontSize: 13,
        marginTop: 2,
    },
    // Setting Row
    alertRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    settingLabel: {
        color: '#E0E0E0',
        fontSize: 16,
    },
    intervalInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: '#121212',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    intervalLabel: {
        color: '#888',
        marginRight: 12,
    },
    intervalInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        paddingVertical: 12,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    intervalUnit: {
        color: '#F2780D',
        marginLeft: 8,
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        backgroundColor: '#121212',
        borderTopWidth: 1,
        borderTopColor: '#1E1E1E',
    },
    saveMainButton: {
        backgroundColor: '#F2780D',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    saveMainText: {
        color: '#121212',
        fontSize: 18,
        fontWeight: 'bold',
    },
    textInputSimple: {
        flex: 1,
        color: '#E0E0E0',
        fontSize: 16,
    },
    // Date & Receipt Styles
    dateRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    dateButton: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        paddingVertical: 10,
        marginHorizontal: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    dateButtonActive: {
        backgroundColor: '#F2780D',
        borderColor: '#F2780D',
    },
    dateText: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: 'bold',
    },
    dateTextActive: {
        color: '#121212',
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 16,
    },
    receiptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#F2780D',
    },
    receiptText: {
        color: '#F2780D',
        fontWeight: 'bold',
        marginLeft: 10,
    },
    // Modal Overrides
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
        fontSize: 18,
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
    modalItemText: {
        fontSize: 16,
        color: '#E0E0E0',
    },
    modalItemTextActive: {
        color: '#F2780D',
        fontWeight: 'bold',
    },
    // Parts Styles
    catalogSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2780D',
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 16,
    },
    catalogSearchText: {
        color: '#121212',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    addComponentButtonFull: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2780D',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 10,
    },
    addComponentTextDark: {
        color: '#121212',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#121212',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchInput: {
        flex: 1,
        color: '#E0E0E0',
        marginLeft: 8,
        fontSize: 16,
    },
    // Removed Duplicate modalItem style
    fadeIn: {
        marginBottom: 16,
    },
    unitChipSmall: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#1E1E1E',
        marginRight: 4,
        borderWidth: 1,
        borderColor: '#333',
    },
    unitChipActive: {
        backgroundColor: 'rgba(242, 120, 13, 0.2)',
        borderColor: '#F2780D',
    },
    unitChipTextSmall: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    },
    unitChipTextActive: {
        color: '#F2780D',
    },
    // Receipt Preview Styles
    receiptPreviewContainer: {
        marginTop: 12,
        height: 200,
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#333',
    },
    receiptPreview: {
        width: '100%',
        height: '100%',
    },
    removeReceiptButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 6,
        borderRadius: 14,
    },
});

export default AddMaintenanceScreen;
