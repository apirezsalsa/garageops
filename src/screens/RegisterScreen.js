import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Mail, Lock, UserPlus, ChevronLeft, User } from 'lucide-react-native';

export default function RegisterScreen({ navigation }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const onRegister = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert(t('error'), t('register_error_empty'));
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(t('error'), t('register_error_match'));
            return;
        }

        if (password.length < 6) {
            Alert.alert(t('error'), t('register_error_weak'));
            return;
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });

            // Create User Document for Subscription/Profile Data
            await setDoc(doc(db, "users", userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: email,
                displayName: name,
                createdAt: serverTimestamp(),
                isPremium: true
            });

            // Upon successful creation, the AuthContext in App.js will detect the user change
        } catch (error) {
            let msg = error.message;
            if (msg.includes('email-already-in-use')) msg = t('error_email_in_use');
            if (msg.includes('invalid-email')) msg = t('error_invalid_email');
            if (msg.includes('weak-password')) msg = t('error_weak_pass');
            Alert.alert(t('register_error_title'), msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ChevronLeft size={28} color="#E0E0E0" />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.title}>{t('create_account_title')}</Text>
                        <Text style={styles.subtitle}>{t('register_subtitle')}</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <User size={20} color="#888" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('name')}
                                placeholderTextColor="#666"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

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
                        <Text style={styles.passwordHint}>{t('password_hint')}</Text>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color="#888" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('confirm_password_placeholder')}
                                placeholderTextColor="#666"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                        </View>

                        <TouchableOpacity style={styles.registerButton} onPress={onRegister} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.registerButtonText}>{t('create_account_button')}</Text>
                                    <UserPlus size={20} color="#fff" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.loginContainer}>
                            <Text style={styles.loginText}>{t('already_have_account')} </Text>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text style={styles.loginLink}>{t('login_link')}</Text>
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
    backButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
        marginTop: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
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
    passwordHint: {
        color: '#888',
        fontSize: 12,
        marginTop: -8,
        marginBottom: 16,
        marginLeft: 4,
    },
    registerButton: {
        flexDirection: 'row',
        backgroundColor: '#F2780D',
        borderRadius: 12,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        marginTop: 16,
        shadowColor: '#F2780D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    loginText: {
        color: '#888',
        fontSize: 14,
    },
    loginLink: {
        color: '#F2780D',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
