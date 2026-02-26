import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

const LegalScreen = ({ navigation, route }) => {
    const { t } = useTranslation();
    const { type } = route.params || { type: 'terms' }; // 'terms' or 'privacy'

    const content = type === 'privacy' ? {
        title: t('legal_privacy_title'),
        text: t('legal_privacy_text')
    } : {
        title: t('legal_terms_title'),
        text: t('legal_terms_text')
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.title}>{content.title}</Text>
                <View style={{ width: 28 }} />
            </View>
            <ScrollView style={styles.content}>
                <Text style={styles.text}>{content.text}</Text>
                <View style={{ height: 40 }} />
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
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    text: {
        color: '#BBBBBB',
        fontSize: 14,
        lineHeight: 22,
    }
});

export default LegalScreen;
