import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Mail, Lock, LogIn } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const onLogin = async () => {
        // ... (login logic)
        if (!email || !password) {
            Alert.alert(t('error'), t('login_error_empty'));
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            // ...
            Alert.alert(t('login_error_title'), error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Image
                            source={require('../../assets/icon.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>GarageOps</Text>
                        <Text style={styles.subtitle}>{t('login_subtitle')}</Text>
                    </View>

                    <View style={styles.form}>
                        {/* ... inputs ... */}
                        <View style={styles.inputContainer}>
                            <Mail size={20} color="#888" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('email_placeholder')}
                                placeholderTextColor="#666"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color="#888" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('password_placeholder')}
                                placeholderTextColor="#666"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        <TouchableOpacity style={styles.forgotPassword} onPress={async () => {
                            if (!email) {
                                Alert.alert(t('error'), t('forgot_password_enter_email'));
                                return;
                            }
                            try {
                                await sendPasswordResetEmail(auth, email);
                                Alert.alert(t('success'), t('forgot_password_sent'));
                            } catch (error) {
                                Alert.alert(t('error'), error.message);
                            }
                        }}>
                            <Text style={styles.forgotText}>{t('forgot_password')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.loginButton} onPress={onLogin} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.loginButtonText}>{t('login_button')}</Text>
                                    <LogIn size={20} color="#fff" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.registerContainer}>
                            <Text style={styles.registerText}>{t('no_account')} </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text style={styles.registerLink}>{t('register_link')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logo: {
        width: 120,
        height: 120,
        borderRadius: 24, // Matches iOS style rounding slightly
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333'
    },
    title: {
        fontSize: 32, // Reduced slightly to balance with logo
        fontWeight: 'bold',
        color: '#F2780D',
        letterSpacing: 1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: '#333',
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotText: {
        color: '#F2780D',
        fontSize: 14,
    },
    loginButton: {
        flexDirection: 'row',
        backgroundColor: '#F2780D',
        borderRadius: 12,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#F2780D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    registerText: {
        color: '#888',
        fontSize: 14,
    },
    registerLink: {
        color: '#F2780D',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
