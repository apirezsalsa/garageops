import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, ActionSheetIOS } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllMaintenances, getMaintenanceHistory } from '../services/maintenanceService';
import { getVehicles } from '../services/vehicleService';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Share2, FileText, Image as ImageIcon, ChevronRight, Search, ClipboardList, History } from 'lucide-react-native';
import SpotlightOverlay from '../components/SpotlightOverlay';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HistoryScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { vehicleId } = route.params || {};
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vehicleMap, setVehicleMap] = useState({});

    // Spotlight Onboarding State
    const [showSpotlight, setShowSpotlight] = useState(false);

    const historySteps = [
        {
            title: 'spotlight_history_1_title',
            description: 'spotlight_history_1_desc',
            icon: 'history'
        },
        {
            title: 'spotlight_history_2_title',
            description: 'spotlight_history_2_desc',
            icon: 'share'
        }
    ];

    useFocusEffect(
        useCallback(() => {
            const checkOnboarding = async () => {
                try {
                    // Only show if it matches the global history (no vehicleId)
                    if (vehicleId) return;

                    const hasSeen = await AsyncStorage.getItem('hasSeenSpotlightHistory');
                    if (hasSeen !== 'true') {
                        setTimeout(() => setShowSpotlight(true), 1000);
                    }
                } catch (e) {
                    console.log('Error checking history onboarding', e);
                }
            };
            checkOnboarding();
        }, [vehicleId])
    );

    const handleFinishSpotlight = async () => {
        try {
            await AsyncStorage.setItem('hasSeenSpotlightHistory', 'true');
            setShowSpotlight(false);
        } catch (e) {
            setShowSpotlight(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const fetchData = async () => {
                setLoading(true);
                try {
                    // Fetch vehicles for name mapping
                    const vehicles = await getVehicles();
                    const vMap = {};
                    vehicles.forEach(v => vMap[v.id] = v);
                    setVehicleMap(vMap);

                    // Fetch logs
                    let data = [];
                    if (vehicleId) {
                        data = await getMaintenanceHistory(vehicleId);
                    } else {
                        data = await getAllMaintenances();
                    }
                    setLogs(data);
                } catch (error) {
                    console.error('Error loading history:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }, [vehicleId])
    );

    const getVehicleName = (id) => vehicleMap[id]?.name || t('unknown_vehicle');
    const getVehicleColor = (id) => vehicleMap[id]?.color || '#F2780D'; // Default or from map if available

    const handleLogPress = (log) => {
        const vehicle = vehicleMap[log.vehicleId];
        const itemWithVehicle = {
            ...log,
            vehicleName: vehicle?.name || t('unknown_vehicle'),
            trackingType: vehicle?.trackingType
        };
        // Ensure MaintenanceDetail is in the navigation stack.
        // If it's in a different stack, we might need to specify the stack name, e.g. 'garage'.
        // Assuming it's in the same stack or global.
        navigation.navigate('MaintenanceDetail', { item: itemWithVehicle });
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

    const generatePDF = async (mode) => {
        try {
            setLoading(true);
            const title = vehicleId ? t('history_vehicle', { name: getVehicleName(vehicleId) }) : t('history_global');
            const dateStr = new Date().toLocaleDateString();

            let contentHtml = '';

            if (mode === 'summary') {
                // Table Format
                const rows = logs.map(log => `
                    <tr>
                        <td>${log.date?.toDate ? log.date.toDate().toLocaleDateString() : '-'}</td>
                        <td>${getVehicleName(log.vehicleId)}</td>
                        <td>${t(log.type)}</td>
                        <td style="text-align:right">${log.totalCost > 0 ? log.totalCost.toFixed(2) + '€' : '-'}</td>
                    </tr>
                `).join('');

                contentHtml = `
                    <div class="section">
                        <table>
                            <thead>
                                <tr>
                                    <th>${t('date')}</th>
                                    <th>${t('vehicle')}</th>
                                    <th>${t('work')}</th>
                                    <th style="text-align:right">${t('cost')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                // Detailed Format (Card per item)
                contentHtml = logs.map(log => {
                    const partsHtml = log.parts && log.parts.length > 0 ? `
                        <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                            <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 5px;">${t('materials')}</div>
                            <table style="font-size: 12px;">
                                ${log.parts.map(p => `
                                    <tr>
                                        <td style="padding: 2px 0;">${p.name}</td>
                                        <td style="padding: 2px 0; color: #666;">${p.qty || 1} ${p.stockUnit || ''}</td>
                                        <td style="padding: 2px 0; text-align: right;">${p.price ? p.price + '€' : '-'}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                    ` : '';

                    return `
                        <div class="card">
                            <div class="card-header">
                                <span class="date">${log.date?.toDate ? log.date.toDate().toLocaleDateString() : '-'}</span>
                                <span class="vehicle">${getVehicleName(log.vehicleId)}</span>
                            </div>
                            <div class="card-body">
                                <div class="task">${t(log.type)}</div>
                                <div class="usage">${log.usage} ${vehicleMap[log.vehicleId]?.trackingType === 'h' ? 'h' : 'km'}</div>
                                ${log.notes ? `<div class="notes">"${log.notes}"</div>` : ''}
                                ${partsHtml}
                                <div class="cost">${t('total')}: ${log.totalCost > 0 ? log.totalCost.toFixed(2) + '€' : '-'}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>${title}</title>
                    <style>
                        body { font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
                        h1 { color: #F2780D; border-bottom: 2px solid #F2780D; padding-bottom: 10px; }
                        .meta { color: #888; font-size: 12px; margin-bottom: 30px; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { text-align: left; background: #f4f4f4; padding: 8px; font-size: 12px; text-transform: uppercase; }
                        td { border-bottom: 1px solid #eee; padding: 8px; font-size: 14px; }
                        
                        .card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
                        .card-header { background: #f9f9f9; padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-weight: bold; }
                        .card-body { padding: 15px; }
                        .task { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
                        .usage { color: #888; font-size: 12px; margin-bottom: 10px; }
                        .notes { font-style: italic; color: #555; background: #f0f0f0; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
                        .cost { text-align: right; font-weight: bold; font-size: 16px; margin-top: 10px; color: #F2780D; }
                        .vehicle { color: #F2780D; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <div class="meta">${t('generated')} ${dateStr}</div>
                    ${contentHtml}
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            console.error("Error creating PDF:", error);
            Alert.alert(t('error'), t('generate_pdf_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{vehicleId ? t('history_vehicle_title') : t('history_global_title')}</Text>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity style={[styles.searchButton, { marginRight: 10 }]} onPress={handleShare}>
                        <Share2 size={24} color="#F2780D" />
                    </TouchableOpacity>
                    {/* Search not implemented yet */}
                    <TouchableOpacity style={styles.searchButton}>
                        <Search size={24} color="#E0E0E0" />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F2780D" />
                    <Text style={{ color: '#666', marginTop: 10 }}>{t('generating')}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContainer}>
                    {logs.length === 0 ? (
                        <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>{t('no_records')}</Text>
                    ) : (
                        logs.map((log) => (
                            <TouchableOpacity key={log.id} style={styles.card} onPress={() => handleLogPress(log)}>
                                <View style={styles.logHeader}>
                                    <View style={[styles.vehicleBadge, { backgroundColor: '#333' }]}>
                                        <View style={[styles.dot, { backgroundColor: '#F2780D' }]} />
                                        <Text style={[styles.vehicleName, { color: '#E0E0E0' }]}>{getVehicleName(log.vehicleId)}</Text>
                                    </View>
                                    <Text style={styles.dateText}>
                                        {log.date?.toDate ? log.date.toDate().toLocaleDateString() : t('invalid_date')}
                                    </Text>
                                </View>

                                <View style={styles.logBody}>
                                    <View>
                                        <Text style={styles.taskTitle}>{t(log.type)}</Text>
                                        <Text style={styles.taskValue}>{log.usage} {vehicleMap[log.vehicleId]?.trackingType === 'h' ? 'h' : 'km'}</Text>
                                    </View>
                                    <View style={styles.iconContainer}>
                                        <ChevronRight size={20} color="#555" />
                                    </View>
                                </View>

                                {/* Footer details */}
                                {(log.totalCost > 0 || log.parts?.length > 0) && (
                                    <View style={styles.cardFooter}>
                                        {log.totalCost > 0 && (
                                            <Text style={{ color: '#4CAF50', fontWeight: 'bold', marginRight: 10 }}>
                                                {log.totalCost} €
                                            </Text>
                                        )}
                                        {log.parts?.length > 0 && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <ImageIcon size={14} color="#888" />
                                                <Text style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
                                                    {log.parts.length} {t('pieces')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}
            <SpotlightOverlay
                visible={showSpotlight}
                steps={historySteps}
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
    searchButton: {
        padding: 8,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
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
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
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
    logBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    taskTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 4,
    },
    taskValue: {
        color: '#888',
        fontSize: 14,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingTop: 12,
    },
    thumbnailPlaceholder: {
        width: 24,
        height: 24,
        backgroundColor: '#333',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    receiptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    receiptText: {
        color: '#AAA',
        fontSize: 10,
        marginLeft: 4,
    },
});

export default HistoryScreen;
