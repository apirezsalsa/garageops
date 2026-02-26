import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Package, AlertTriangle, Share2, Clock, Calendar, CheckCircle2, Edit, RotateCcw } from 'lucide-react-native';

const MaintenanceDetailScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { item } = route.params;

    // Helper to format date
    const formatDate = (date) => {
        if (!date) return '';
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
        return new Date(date).toLocaleDateString();
    };

    const totalCost = item.totalCost || 0;
    const parts = item.parts || [];
    const isCostIncomplete = parts.some(p => !p.price || p.price === 0);

    const handleEdit = () => {
        navigation.navigate('garage', {
            screen: 'AddMaintenance',
            params: {
                vehicle: {
                    id: item.vehicleId,
                    name: item.vehicleName || t('vehicle'),
                    trackingType: item.trackingType,
                    trackingUnit: item.trackingUnit // Also useful
                },
                maintenanceItem: item,
                isEditing: true
            }
        });
    };

    const handleShare = async () => {
        try {
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${t('maintenance_report')}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                        .header { border-bottom: 2px solid #F2780D; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                        .brand { font-size: 24px; font-weight: bold; color: #F2780D; }
                        .doc-title { font-size: 18px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
                        
                        .section { margin-bottom: 30px; }
                        .section-title { font-size: 14px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                        
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                        .info-item { margin-bottom: 10px; }
                        .label { font-size: 12px; color: #888; display: block; margin-bottom: 2px; }
                        .value { font-size: 16px; font-weight: 600; color: #111; }

                        .notes-box { background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #F2780D; font-style: italic; color: #555; }

                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
                        th { background-color: #f8f8f8; font-weight: 600; color: #444; font-size: 14px; }
                        td { font-size: 14px; color: #333; }
                        tr:last-child td { border-bottom: none; }
                        .text-right { text-align: right; }
                        .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #333; color: #000; padding-top: 15px; }
                        .total-label { text-align: right; }
                        
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="brand">GarageOps</div>
                        <div class="doc-title">${t('maintenance_report')}</div>
                    </div>

                    <div class="section">
                        <div class="grid">
                            <div class="info-item">
                                <span class="label">${t('vehicle').toUpperCase()}</span>
                                <span class="value">${item.vehicleName || t('vehicle')}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">${t('date').toUpperCase()}</span>
                                <span class="value">${formatDate(item.date)}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">${t('maintenance_type')}</span>
                                <span class="value">${t(item.type)}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">${t('registered_usage')}</span>
                                <span class="value">${item.usage || '--'} ${item.trackingUnit || ''}</span>
                            </div>
                        </div>
                    </div>

                    ${item.notes ? `
                    <div class="section">
                        <div class="section-title">${t('notes')}</div>
                        <div class="notes-box">
                            "${item.notes}"
                        </div>
                    </div>
                    ` : ''}

                    <div class="section">
                        <div class="section-title">${t('materials_costs_pdf')}</div>
                        ${parts.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>${t('concept')}</th>
                                    <th>${t('ref_abbr')}</th>
                                    <th>${t('qty_abbr')}</th>
                                    <th class="text-right">${t('price')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parts.map(p => `
                                <tr>
                                    <td>${p.name}</td>
                                    <td>${p.ref || '-'}</td>
                                    <td>${p.qty || 1} ${p.stockUnit || 'ud'}</td>
                                    <td class="text-right">${p.price > 0 ? parseFloat(p.price).toFixed(2) + '€' : '-'}</td>
                                </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="3" class="total-label">${t('total').toUpperCase()}</td>
                                    <td class="text-right">${totalCost.toFixed(2)}€</td>
                                </tr>
                            </tbody>
                        </table>
                        ` : '<p style="color: #888; font-style: italic;">' + t('no_materials_registered') + '</p>'}
                    </div>

                    <div class="footer">
                        ${t('generated_on_by', { date: new Date().toLocaleDateString() })}
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert(t('error'), t('generate_pdf_error'));
            console.error(error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('maintenance_detail')}</Text>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={handleEdit} style={[styles.shareButton, { marginRight: 16 }]}>
                        <Edit size={24} color="#F2780D" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                        <Share2 size={24} color="#F2780D" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Main Info Card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <Text style={styles.maintenanceName}>{t(item.type)}</Text>
                        <Text style={[styles.vehicleName, { color: '#F2780D' }]}>{item.vehicleName || t('vehicle')}</Text>
                    </View>

                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Calendar size={20} color="#888" style={{ marginBottom: 8 }} />
                            <Text style={styles.infoLabel}>{t('date')}</Text>
                            <Text style={styles.infoValue}>{formatDate(item.date)}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Clock size={20} color="#888" style={{ marginBottom: 8 }} />
                            <Text style={styles.infoLabel}>{t('usage_control')}</Text>
                            <Text style={styles.infoValue}>{item.usage || '--'}</Text>
                        </View>
                    </View>

                    {item.alertEnabled && (
                        <View style={styles.section}>
                            <View style={styles.infoItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <RotateCcw size={20} color="#F2780D" style={{ marginRight: 8 }} />
                                    <Text style={styles.infoLabel}>{t('schedule')}</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={styles.infoValue}>
                                        {t('every')} {item.alertInterval} {item.trackingType === 'h' ? 'h' : 'km'}
                                    </Text>
                                    <Text style={{ color: '#888', marginTop: 4 }}>
                                        {t('next_maintenance_due')} {(parseFloat(item.usage) + parseFloat(item.alertInterval))} {item.trackingType === 'h' ? 'h' : 'km'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {item.notes && (
                        <View style={styles.notesBox}>
                            <Text style={styles.notesText}>"{item.notes}"</Text>
                        </View>
                    )}
                </View>

                {/* Parts & Cost */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>{t('materials_costs')}</Text>
                        {isCostIncomplete && (
                            <View style={styles.incompleteBadge}>
                                <AlertTriangle size={12} color="#FFC107" />
                                <Text style={styles.incompleteText}>{t('cost_inc')}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.partsList}>
                        {parts.map((part, index) => (
                            <View key={index} style={styles.partRow}>
                                <View style={styles.partIcon}>
                                    <Package size={16} color="#888" />
                                </View>
                                <View style={styles.partInfo}>
                                    <Text style={styles.partName}>{part.name}</Text>
                                    <Text style={styles.partRef}>
                                        {part.qty || 1} {part.stockUnit || 'ud'} • {part.ref || t('no_ref')}
                                    </Text>
                                </View>
                                <Text style={[styles.partPrice, !part.price && { color: '#FFC107' }]}>
                                    {part.price > 0 ? `${parseFloat(part.price).toFixed(2)}€` : '-- €'}
                                </Text>
                            </View>
                        ))}
                        {parts.length === 0 && (
                            <View style={{ padding: 16 }}>
                                <Text style={{ color: '#666', fontStyle: 'italic' }}>{t('no_assigned_parts')}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>{t('estimated_total')}</Text>
                        <Text style={styles.totalValue}>{totalCost.toFixed(2)}€</Text>
                    </View>
                </View>

            </ScrollView>
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
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    backButton: {
        padding: 4,
    },
    shareButton: {
        padding: 4,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    statusCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    maintenanceName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#E0E0E0',
        flex: 1,
    },
    vehicleName: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 4,
    },
    progressContainer: {

    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressLabel: {
        color: '#888',
        fontSize: 14,
    },
    timeLeft: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    progressBackground: {
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressValue: {
        color: '#666',
        fontSize: 12,
        alignSelf: 'flex-end',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    infoGrid: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    infoItem: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 16,
        marginRight: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    infoLabel: {
        color: '#888',
        marginBottom: 4,
        fontSize: 12,
    },
    infoValue: {
        color: '#E0E0E0',
        fontSize: 16,
        fontWeight: 'bold',
    },
    notesBox: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#F2780D',
    },
    notesText: {
        color: '#CCC',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    incompleteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    incompleteText: {
        color: '#FFC107',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    partsList: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    partRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    partIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    partInfo: {
        flex: 1,
    },
    partName: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '600',
    },
    partRef: {
        color: '#888',
        fontSize: 12,
    },
    partPrice: {
        color: '#E0E0E0',
        fontWeight: 'bold',
        fontSize: 14,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        paddingHorizontal: 16,
    },
    totalLabel: {
        color: '#E0E0E0',
        fontSize: 18,
        fontWeight: 'bold',
    },
    totalValue: {
        color: '#F2780D',
        fontSize: 24,
        fontWeight: 'bold',
    },
});

export default MaintenanceDetailScreen;
