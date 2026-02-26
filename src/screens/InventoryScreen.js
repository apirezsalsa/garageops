import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, Share, Platform, ActionSheetIOS } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, CheckCircle2, AlertTriangle, Clock, Search, X, Calendar, Wrench, Map, Share2 } from 'lucide-react-native';
import { getAllMaintenances } from '../services/maintenanceService';
import { getVehicles } from '../services/vehicleService';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

const MaintenanceListScreen = ({ navigation, route }) => {
    const { t } = useTranslation();
    const [vehicles, setVehicles] = useState([]);
    const [allLogs, setAllLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vehicleMap, setVehicleMap] = useState({});

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);

    // Handle route params for initial filter
    useEffect(() => {
        if (route.params?.vehicleId) {
            setSelectedVehicleId(route.params.vehicleId);
        }
    }, [route.params]);

    // Fetch Data
    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Vehicles
            const vList = await getVehicles();
            setVehicles(vList);
            const vMap = {};
            vList.forEach(v => vMap[v.id] = v);
            setVehicleMap(vMap);

            // 2. Fetch Logs
            const logs = await getAllMaintenances(0); // 0 = no limit
            setAllLogs(logs);
        } catch (error) {
            console.error("Error loading history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    useEffect(() => {
        let result = allLogs;

        if (selectedVehicleId) {
            result = result.filter(log => log.vehicleId === selectedVehicleId);
        }

        // Filter out "Actualización de Lectura" logs as requested
        result = result.filter(log => log.type !== 'Actualización de Lectura');

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(log =>
                log.type.toLowerCase().includes(lowerQuery) ||
                (log.notes && log.notes.toLowerCase().includes(lowerQuery)) ||
                (vehicleMap[log.vehicleId]?.name.toLowerCase().includes(lowerQuery))
            );
        }

        setFilteredLogs(result);
    }, [allLogs, selectedVehicleId, searchQuery, vehicleMap]);

    const getStatusColor = (status) => {
        // Status logic not really needed for history logs unless we calculate it
        // For history, we just show date and details.
        return '#888';
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        if (timestamp.toDate) return timestamp.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
        return new Date(timestamp).toLocaleDateString();
    };

    const handleShare = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [t('cancel'), t('summary_list'), t('detailed_list')],
                    cancelButtonIndex: 0,
                    userInterfaceStyle: 'dark',
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) generatePDF('summary');
                    else if (buttonIndex === 2) generatePDF('detailed');
                }
            );
        } else {
            Alert.alert(
                t('share_history_title'),
                t('share_format_title'),
                [
                    { text: t('cancel'), style: "cancel" },
                    { text: t('summary_list'), onPress: () => generatePDF('summary') },
                    { text: t('detailed_list'), onPress: () => generatePDF('detailed') }
                ]
            );
        }
    };

    const generatePDF = async (mode = 'summary') => {
        if (filteredLogs.length === 0) {
            Alert.alert(t('export_notice'), t('no_records_export'));
            return;
        }

        const totalFilteredCost = filteredLogs.reduce((acc, log) => acc + (log.totalCost || 0), 0);
        const vehicleName = selectedVehicleId ? vehicleMap[selectedVehicleId]?.name : t('all_vehicles_title');

        let contentBody = '';

        if (mode === 'summary') {
            contentBody = `
                <table>
                    <thead>
                        <tr>
                            <th>${t('date')}</th>
                            <th>${t('vehicle')}</th>
                            <th>${t('work')}</th>
                            <th>${t('usage_control')}</th>
                            <th class="cost-col">${t('cost')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredLogs.map(log => {
                const vName = vehicleMap[log.vehicleId]?.name || '---';
                const dateStr = formatDate(log.date);
                return `
                                <tr>
                                    <td>${dateStr}</td>
                                    <td>${vName}</td>
                                    <td>${t(log.type)}</td>
                                    <td>${log.usage ? log.usage + (vehicleMap[log.vehicleId]?.trackingType === 'h' ? 'h' : 'km') : '-'}</td>
                                    <td class="cost-col">${(log.totalCost || 0).toFixed(2)}€</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            // Detailed View
            contentBody = filteredLogs.map(log => {
                const vName = vehicleMap[log.vehicleId]?.name || '---';
                const dateStr = formatDate(log.date);
                const partsHtml = log.parts && log.parts.length > 0 ? `
                    <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                        <div style="font-size: 10px; font-weight: bold; color: #666; margin-bottom: 5px; text-transform: uppercase;">${t('materials_upper')}</div>
                        <table style="margin-top:0;">
                            ${log.parts.map(p => `
                                <tr>
                                    <td style="padding: 2px 0; border: none;">${p.name} <span style="color:#888; font-size:10px;">${p.ref ? '(' + p.ref + ')' : ''}</span></td>
                                    <td style="padding: 2px 0; border: none; color: #666;">${p.qty || 1} ${p.stockUnit || ''}</td>
                                    <td style="padding: 2px 0; border: none; text-align: right;">${p.price > 0 ? p.price + '€' : '-'}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                ` : '';

                return `
                    <div class="card">
                        <div class="card-header">
                            <span class="date">${dateStr}</span>
                            <span class="vehicle">${vName}</span>
                        </div>
                        <div class="card-body">
                            <div class="task">${t(log.type)}</div>
                            <div class="usage">${t('usage_control')}: ${log.usage} ${vehicleMap[log.vehicleId]?.trackingType === 'h' ? 'h' : 'km'}</div>
                            ${log.notes ? `<div class="notes">"${log.notes}"</div>` : ''}
                            ${partsHtml}
                            <div class="cost">${t('total')}: ${(log.totalCost || 0).toFixed(2)}€</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${t('history_global')}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #F2780D; padding-bottom: 10px; }
                    .title { font-size: 24px; font-weight: bold; color: #121212; margin: 0; }
                    .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                    
                    .summary-box { background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; }
                    .summary-item { text-align: center; }
                    .summary-value { font-size: 18px; font-weight: bold; color: #F2780D; display: block; }
                    .summary-label { font-size: 12px; color: #888; text-transform: uppercase; }

                    /* Table Styles */
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; font-weight: bold; color: #333; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .cost-col { text-align: right; font-weight: bold; }

                    /* Card Styles (Detailed) */
                    .card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; page-break-inside: avoid; background: #fff; }
                    .card-header { background: #f9f9f9; padding: 8px 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; color: #555; }
                    .card-body { padding: 12px; }
                    .task { font-size: 16px; font-weight: bold; margin-bottom: 4px; color: #000; }
                    .usage { color: #888; font-size: 12px; margin-bottom: 8px; }
                    .notes { font-style: italic; color: #555; background: #f0f0f0; padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 12px; }
                    .cost { text-align: right; font-weight: bold; font-size: 14px; margin-top: 8px; color: #F2780D; border-top: 1px solid #eee; padding-top: 8px; }
                    .vehicle { color: #F2780D; }
                    
                    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #aaa; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">GarageOps</h1>
                    <div class="subtitle">${t('history_global')}</div>
                </div>

                <div class="summary-box">
                    <div class="summary-item">
                        <span class="summary-value">${vehicleName}</span>
                        <span class="summary-label">${t('current_filter')}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${filteredLogs.length}</span>
                        <span class="summary-label">${t('records')}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${totalFilteredCost.toFixed(2)}€</span>
                        <span class="summary-label">${t('total_cost')}</span>
                    </div>
                </div>

                ${contentBody}

                <div class="footer">
                    ${t('generated_on')} ${new Date().toLocaleDateString()}
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

    const renderLogItem = ({ item }) => {
        const vehicle = vehicleMap[item.vehicleId];
        const vehicleName = vehicle?.name || t('unknown_vehicle');
        const vehicleColor = vehicle?.color || '#F2780D';
        const trackingUnit = vehicle?.trackingType === 'h' ? 'h' : 'km';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('MaintenanceDetail', {
                    item: {
                        ...item,
                        vehicleName,
                        trackingType: vehicle?.trackingType,
                        trackingUnit
                    }
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.vehicleBadge, { backgroundColor: vehicleColor + '20' }]}>
                        <View style={[styles.dot, { backgroundColor: vehicleColor }]} />
                        <Text style={[styles.vehicleName, { color: vehicleColor }]}>{vehicleName}</Text>
                    </View>
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                </View>

                <View style={styles.mainInfo}>
                    <Text style={styles.partName}>{t(item.type)}</Text>
                    <View style={styles.detailsRow}>
                        <View style={styles.detailItem}>
                            {vehicle?.trackingType === 'h' ? <Clock size={14} color="#888" /> : <Map size={14} color="#888" />}
                            <Text style={styles.detailText}>{item.usage} {trackingUnit}</Text>
                        </View>
                        {item.totalCost > 0 && (
                            <Text style={styles.costText}>{item.totalCost.toFixed(2)} €</Text>
                        )}
                    </View>
                </View>

                {item.parts && item.parts.length > 0 && (
                    <View style={styles.partsPreview}>
                        <Wrench size={12} color="#666" style={{ marginRight: 6 }} />
                        <Text style={styles.partsText} numberOfLines={1}>
                            {item.parts.length} {item.parts.length !== 1 ? t('parts_counts') : t('parts_count')}: {item.parts.map(p => p.name).join(', ')}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('history_title')}</Text>
                <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                    <Share2 size={24} color="#F2780D" />
                </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Search size={20} color="#888" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('search_placeholder')}
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={20} color="#888" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                    <TouchableOpacity
                        style={[styles.filterChip, !selectedVehicleId && styles.filterChipActive]}
                        onPress={() => setSelectedVehicleId(null)}
                    >
                        <Text style={[styles.filterChipText, !selectedVehicleId && styles.filterChipTextActive]}>{t('filter_all')}</Text>
                    </TouchableOpacity>
                    {vehicles.map(v => (
                        <TouchableOpacity
                            key={v.id}
                            style={[styles.filterChip, selectedVehicleId === v.id && styles.filterChipActive]}
                            onPress={() => setSelectedVehicleId(v.id === selectedVehicleId ? null : v.id)}
                        >
                            <Text style={[styles.filterChipText, selectedVehicleId === v.id && styles.filterChipTextActive]}>{v.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F2780D" />
                </View>
            ) : (
                <FlatList
                    data={filteredLogs}
                    renderItem={renderLogItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>{t('no_records_found')}</Text>
                        </View>
                    }
                />
            )}
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
    shareButton: {
        padding: 4,
    },
    filterSection: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        color: '#E0E0E0',
        marginLeft: 10,
        fontSize: 16,
    },
    chipsContainer: {
        flexDirection: 'row',
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#1E1E1E',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    filterChipActive: {
        backgroundColor: '#F2780D',
        borderColor: '#F2780D',
    },
    filterChipText: {
        color: '#888',
        fontWeight: '600',
        fontSize: 14,
    },
    filterChipTextActive: {
        color: '#121212',
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    vehicleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    vehicleName: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    dateText: {
        color: '#888',
        fontSize: 12,
    },
    mainInfo: {
        marginBottom: 12,
    },
    partName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 6,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        color: '#888',
        fontSize: 14,
        marginLeft: 6,
    },
    costText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 16,
    },
    partsPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#2A2A2A',
    },
    partsText: {
        color: '#666',
        fontSize: 12,
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        fontStyle: 'italic',
    },
});

export default MaintenanceListScreen;
