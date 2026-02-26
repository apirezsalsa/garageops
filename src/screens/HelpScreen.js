import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, LayoutAnimation, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, HelpCircle, Bike, Wrench, Package, Bell, ShieldCheck, Mail, ArrowLeft, ClipboardList } from 'lucide-react-native';

const HelpItem = ({ title, icon: Icon, children }) => {
    const [expanded, setExpanded] = useState(false);
    const { t } = useTranslation();

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View style={styles.helpItemContainer}>
            <TouchableOpacity
                style={[styles.helpHeader, expanded && styles.helpHeaderExpanded]}
                onPress={toggleExpand}
                activeOpacity={0.7}
            >
                <View style={styles.titleRow}>
                    <View style={styles.iconWrapper}>
                        <Icon size={20} color="#F2780D" />
                    </View>
                    <Text style={styles.helpTitle}>{title}</Text>
                </View>
                {expanded ? <ChevronUp size={20} color="#888" /> : <ChevronDown size={20} color="#888" />}
            </TouchableOpacity>

            {expanded && (
                <View style={styles.helpContent}>
                    {children}
                </View>
            )}
        </View>
    );
};

const HelpScreen = ({ navigation }) => {
    const { t } = useTranslation();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft size={24} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('help_center', 'Centro de Ayuda')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.introSection}>
                    <View style={styles.logoCircle}>
                        <HelpCircle size={40} color="#F2780D" />
                    </View>
                    <Text style={styles.introTitle}>{t('how_can_we_help', '¿Cómo podemos ayudarte?')}</Text>
                    <Text style={styles.introDesc}>
                        {t('help_intro_desc', 'Aprende a sacar el máximo provecho de GarageOps para mantener tus vehículos en perfecto estado.')}
                    </Text>
                </View>

                <HelpItem title={t('help_garage_title', 'Mi Garaje Digital')} icon={Bike}>
                    <Text style={styles.helpText}>
                        {t('help_garage_text', 'Añade tus motos, coches o quads indicando si el uso se mide en Kilómetros o en Horas. Puedes cambiar la foto de cada vehículo pulsando sobre su imagen en el perfil del vehículo.')}
                    </Text>
                    <View style={styles.tipContainer}>
                        <Text style={styles.tipTitle}>💡 TIP:</Text>
                        <Text style={styles.tipText}>{t('help_garage_tip', 'Mantén el odómetro actualizado para que las alertas de mantenimiento sean precisas.')}</Text>
                    </View>
                </HelpItem>

                <HelpItem title={t('help_maint_title', 'Mantenimientos y Tareas')} icon={Wrench}>
                    <Text style={styles.helpText}>
                        {t('help_maint_text', 'Registra cada trabajo realizado. Puedes adjuntar fotos de tus facturas o del proceso. GarageOps guardará un historial completo que aumenta el valor de reventa de tu vehículo.')}
                    </Text>
                    <Text style={styles.helpText}>
                        {t('help_maint_text_2', 'Al crear un mantenimiento, puedes añadir recambios específicos y opcionalmente programar cuándo deberá repetirse la tarea.')}
                    </Text>
                </HelpItem>

                <HelpItem title={t('help_inventory_title', 'Gestión de Recambios')} icon={Package}>
                    <Text style={styles.helpText}>
                        {t('help_inventory_text', 'La sección "Recambios" es tu catálogo de piezas utilizadas. Regístralas para saber exactamente qué recambios necesita cada vehículo cuando tengas que repetir un mantenimiento.')}
                    </Text>
                    <Text style={styles.helpText}>
                        {t('help_inventory_text_2', 'También podrás compartir este listado o consultarlo rápidamente cuando vayas a comprar repuestos nuevos.')}
                    </Text>
                </HelpItem>

                <HelpItem title={t('history_title', 'Historial')} icon={ClipboardList}>
                    <Text style={styles.helpText}>
                        {t('help_history_text', 'El Historial es tu bitácora completa. Aquí se guardan cronológicamente todos los mantenimientos de todos tus vehículos.')}
                    </Text>
                    <Text style={styles.helpText}>
                        {t('help_history_text_2', 'Puedes filtrar por vehículo para ver solo lo que te interesa o pulsar en el icono de compartir para generar un informe PDF profesional con todos los gastos y detalles.')}
                    </Text>
                </HelpItem>

                <HelpItem title={t('help_alerts_title', 'Notificaciones y Alertas')} icon={Bell}>
                    <Text style={styles.helpText}>
                        {t('help_alerts_text', 'Recibirás avisos cuando un mantenimiento esté próximo a caducar según el uso registrado. Asegúrate de tener las notificaciones permitidas en los ajustes de tu teléfono.')}
                    </Text>
                </HelpItem>

                <HelpItem title={t('help_premium_title', 'Cuenta Pro')} icon={ShieldCheck}>
                    <Text style={styles.helpText}>
                        {t('help_premium_text', 'Con la suscripción Pro eliminas el límite de 2 vehículos, desbloqueas el historial ilimitado y eliminas la publicidad. Además, apoyas el desarrollo continuo de la app.')}
                    </Text>
                </HelpItem>

                <View style={styles.supportCard}>
                    <Mail size={24} color="#F2780D" />
                    <View style={styles.supportContent}>
                        <Text style={styles.supportTitle}>{t('still_need_help', '¿Aún necesitas ayuda?')}</Text>
                        <Text style={styles.supportDesc}>{t('contact_us_desc', 'Si tienes algún problema o sugerencia, no dudes en contactarnos.')}</Text>
                        <TouchableOpacity style={styles.supportButton}>
                            <Text style={styles.supportButtonText}>{t('send_email', 'Enviar Correo')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.versionText}>GarageOps v1.0.0</Text>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    introSection: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#1E1E1E',
        marginBottom: 20,
    },
    logoCircle: {
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
    introTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 10,
        textAlign: 'center',
    },
    introDesc: {
        fontSize: 15,
        color: '#888',
        textAlign: 'center',
        lineHeight: 22,
    },
    helpItemContainer: {
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    helpHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
    },
    helpHeaderExpanded: {
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#2A2A2A',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    helpTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    helpContent: {
        padding: 20,
        backgroundColor: '#1A1A1A',
    },
    helpText: {
        fontSize: 14,
        color: '#BBB',
        lineHeight: 22,
        marginBottom: 15,
    },
    tipContainer: {
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        padding: 15,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#F2780D',
    },
    tipTitle: {
        color: '#F2780D',
        fontWeight: 'bold',
        fontSize: 12,
        marginBottom: 4,
    },
    tipText: {
        color: '#E0E0E0',
        fontSize: 13,
        fontStyle: 'italic',
    },
    supportCard: {
        margin: 20,
        padding: 24,
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F2780D',
        flexDirection: 'column',
        alignItems: 'center',
    },
    supportContent: {
        marginTop: 15,
        alignItems: 'center',
    },
    supportTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 8,
    },
    supportDesc: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    supportButton: {
        backgroundColor: '#F2780D',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 12,
    },
    supportButtonText: {
        color: '#121212',
        fontWeight: 'bold',
        fontSize: 15,
    },
    versionText: {
        textAlign: 'center',
        color: '#444',
        fontSize: 12,
        marginTop: 10,
    },
});

export default HelpScreen;
