import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';



const PaywallScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const PAYWALL_FEATURES = [
        t("feature_unlimited"),
        t("feature_history"),
        t("feature_reminders"),
        t("feature_support"),
        t("feature_no_ads")
    ];

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            // MOCK REVENUECAT PURCHASE
            // In a real implementation:
            // 1. const offerings = await Purchases.getOfferings();
            // 2. await Purchases.purchasePackage(offerings.current.annual);

            setTimeout(() => {
                Alert.alert(
                    t('config_required'),
                    t('config_required_desc')
                );
                setLoading(false);
            }, 1000);
        } catch (error) {
            Alert.alert(t('error'), error.message);
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setLoading(true);
        try {
            // await Purchases.restorePurchases();
            Alert.alert(t('restore_alert_title'), t('restore_alert_desc'));
            setTimeout(() => setLoading(false), 1000);
        } catch (error) {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <ChevronLeft size={28} color="#E0E0E0" />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Image
                        source={require('../../assets/icon.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.title}>GarageOps <Text style={{ color: '#F2780D' }}>PRO</Text></Text>
                    <Text style={styles.subtitle}>{t('paywall_subtitle')}</Text>
                </View>

                <View style={styles.features}>
                    {PAYWALL_FEATURES.map((feature, index) => (
                        <View key={index} style={styles.featureRow}>
                            <CheckCircle2 size={20} color="#4CAF50" style={{ marginRight: 12 }} />
                            <Text style={styles.featureText}>{feature}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.offerCard}>
                    <Text style={styles.offerTitle}>{t('plan_annual')}</Text>
                    <Text style={styles.offerPrice}>{t('plan_price')}</Text>
                    <Text style={styles.offerTrial}>{t('plan_trial')}</Text>
                    <Text style={styles.offerNote}>{t('plan_note')}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.subscribeButton, loading && { opacity: 0.7 }]}
                    onPress={handleSubscribe}
                    disabled={loading}
                >
                    <Text style={styles.subscribeButtonText}>
                        {loading ? t("processing") : t("start_trial")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
                    <Text style={styles.restoreText}>{t('restore_purchases')}</Text>
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                    {t('subscription_disclaimer', { platform: Platform.OS === 'ios' ? 'Apple' : 'Google' })}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollContent: {
        padding: 24,
        alignItems: 'center',
    },
    closeButton: {
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 20
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
    },
    features: {
        width: '100%',
        marginBottom: 40,
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    featureText: {
        color: '#E0E0E0',
        fontSize: 16,
    },
    offerCard: {
        alignItems: 'center',
        marginBottom: 30,
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        padding: 20,
        borderRadius: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: '#F2780D',
    },
    offerTitle: {
        color: '#F2780D',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    offerPrice: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    offerTrial: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    offerNote: {
        color: '#888',
        fontSize: 12,
    },
    subscribeButton: {
        backgroundColor: '#F2780D',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#F2780D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    subscribeButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    restoreButton: {
        padding: 10,
        marginBottom: 24,
    },
    restoreText: {
        color: '#888',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    disclaimer: {
        color: '#555',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
    }
});

export default PaywallScreen;
