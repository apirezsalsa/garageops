import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, Linking, Modal, FlatList, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, deleteUser, updateProfile } from 'firebase/auth';
import { doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { uploadImage } from '../services/uploadService';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LogOut, User, Settings, Bell, Shield, ChevronRight, Mail, FileText, Trash2, Globe, Check, Camera, X, PenLine, HelpCircle } from 'lucide-react-native';
import i18n from '../config/i18n';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', label: 'Português', flag: '🇵🇹' }
];

const ProfileScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const user = auth.currentUser;
    const [userProfile, setUserProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [notifStatus, setNotifStatus] = useState(t('loading_status'));
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhoto, setEditPhoto] = useState(null);
    const [saving, setSaving] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            checkNotificationPermissions();
        }, [])
    );

    const checkNotificationPermissions = async () => {
        // Disabled for now to avoid Expo Go crash
        setNotifStatus('granted');
    };

    const handleNotificationToggle = async () => {
        Alert.alert(
            t('notifications'),
            t('notifications_enabled'),
            [
                { text: t('cancel'), style: "cancel" },
                { text: t('go_to_settings'), onPress: () => Linking.openSettings() }
            ]
        );
    };

    useEffect(() => {
        const syncProfile = async () => {
            if (user) {
                setEditName(user.displayName || '');
                setEditPhoto(user.photoURL);

                // Also check Firestore for potentially more recent data
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserProfile({ ...data, isPremium: true });
                        if (data.photoURL) {
                            setEditPhoto(data.photoURL);
                        }
                        if (data.displayName) {
                            setEditName(data.displayName);
                        }
                    } else {
                        setUserProfile({ isPremium: true });
                    }
                } catch (error) {
                    console.error("Error fetching profile:", error);
                } finally {
                    setLoadingProfile(false);
                }
            }
        };
        syncProfile();
    }, [user]);

    const fetchUserProfile = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setUserProfile({ ...docSnap.data(), isPremium: true });
            } else {
                setUserProfile({ isPremium: true });
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoadingProfile(false);
        }
    };

    const getSubscriptionStatus = () => {
        if (!userProfile) return { label: t('free_plan'), color: '#888', active: false };
        if (userProfile.isPremium) return { label: t('premium_plan'), color: '#F2780D', active: true };
        return { label: t('free_plan'), color: '#888', active: false };
    };

    const subStatus = getSubscriptionStatus();

    const handleSubscribe = () => {
        navigation.navigate('Paywall');
    };

    const handleChangeLanguage = async (langCode) => {
        i18n.changeLanguage(langCode);
        try {
            await AsyncStorage.setItem('settings.lang', langCode);
        } catch (e) {
            console.error("Failed to save language", e);
        }
        setShowLanguageModal(false);
    };

    const handleLogout = () => {
        Alert.alert(
            t('logout'),
            t('logout_confirm'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('logout'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await signOut(auth);
                        } catch (error) {
                            Alert.alert(t('error'), error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('delete_account'),
            t('delete_account_confirm'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            if (user) {
                                await deleteDoc(doc(db, "users", user.uid));
                                await deleteUser(user);
                            }
                        } catch (error) {
                            Alert.alert(t('error'), t('reauth_required'));
                        }
                    }
                }
            ]
        );
    };

    // --- Profile Editing Functions ---

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('permission_denied'), t('gallery_permission_photo'));
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setEditPhoto(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert(t('error'), t('error_gallery'));
        }
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            Alert.alert(t('error'), t('name_required'));
            return;
        }
        setSaving(true);
        try {
            // Upload to Firebase Storage if necessary
            const photoToSave = await uploadImage(editPhoto, `profiles/${user.uid}`);

            // Update Auth Profile
            await updateProfile(user, {
                displayName: editName,
                photoURL: photoToSave
            });

            // Update Firestore User Doc
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                displayName: editName,
                photoURL: photoToSave
            }, { merge: true });

            Alert.alert(t('success'), t('profile_updated'));
            setIsEditing(false);
            setEditPhoto(photoToSave); // Update state with the network URL
        } catch (error) {
            console.error(error);
            Alert.alert(t('error'), t('error_update_profile'));
        } finally {
            setSaving(false);
        }
    };

    const toggleEdit = () => {
        if (isEditing) {
            // Cancel editing: reset to current values
            setEditName(user.displayName || '');
            setEditPhoto(user.photoURL);
            setIsEditing(false);
        } else {
            // Start editing
            setIsEditing(true);
        }
    };

    const MenuItem = ({ icon: Icon, label, onPress, destructive = false, value }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={[styles.iconBox, destructive && { backgroundColor: 'rgba(255, 82, 82, 0.1)' }]}>
                <Icon size={20} color={destructive ? '#FF5252' : '#F2780D'} />
            </View>
            <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, destructive && { color: '#FF5252' }]}>{label}</Text>
                {value && <Text style={styles.menuValue}>{value}</Text>}
            </View>
            <ChevronRight size={20} color="#666" />
        </TouchableOpacity>
    );

    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('profile')}</Text>
                <TouchableOpacity onPress={isEditing ? handleSaveProfile : toggleEdit} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator color="#F2780D" />
                    ) : isEditing ? (
                        <Text style={styles.saveText}>{t('save')}</Text>
                    ) : (
                        <PenLine size={24} color="#F2780D" />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* User Card */}
                <View style={[styles.userCard, isEditing && styles.userCardEditing]}>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        disabled={!isEditing}
                        onPress={handlePickImage}
                    >
                        {editPhoto && editPhoto.length > 0 ? (
                            <Image
                                key={editPhoto}
                                source={{ uri: editPhoto }}
                                style={styles.avatar}
                                onError={(e) => {
                                    console.log("Avatar load error for URI:", editPhoto, e.nativeEvent.error);
                                    setEditPhoto(null);
                                }}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={40} color="#F2780D" />
                            </View>
                        )}
                        {isEditing && (
                            <View style={styles.editAvatarOverlay}>
                                <Camera size={20} color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.userInfo}>
                        {isEditing ? (
                            <TextInput
                                style={styles.editNameInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder={t('your_name')}
                                placeholderTextColor="#666"
                                autoFocus
                            />
                        ) : (
                            <Text style={styles.userName}>{user?.displayName || t('default_user')}</Text>
                        )}
                        <Text style={styles.userEmail}>{user?.email}</Text>

                        {!isEditing && (
                            <View style={[styles.roleBadge, { backgroundColor: subStatus.color + '20' }]}>
                                <Shield size={12} color={subStatus.color} />
                                <Text style={[styles.roleText, { color: subStatus.color }]}>{subStatus.label}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {isEditing && (
                    <TouchableOpacity style={styles.cancelEditButton} onPress={toggleEdit}>
                        <X size={20} color="#E0E0E0" />
                        <Text style={styles.cancelEditText}>{t('cancel_edit')}</Text>
                    </TouchableOpacity>
                )}

                {!userProfile?.isPremium && (
                    <TouchableOpacity style={styles.premiumCard} onPress={handleSubscribe}>
                        <View style={styles.premiumContent}>
                            <Text style={styles.premiumTitle}>{t('go_premium')}</Text>
                            <Text style={styles.premiumDesc}>{t('unlock_unlimited')}</Text>
                        </View>
                        <View style={styles.premiumButton}>
                            <Text style={styles.premiumButtonText}>{t('see_plans')}</Text>
                        </View>
                    </TouchableOpacity>
                )}

                <Text style={styles.sectionTitle}>{t('settings')}</Text>
                <View style={styles.menuGroup}>
                    <MenuItem
                        icon={Globe}
                        label={t('language')}
                        value={`${currentLang.flag} ${currentLang.label}`}
                        onPress={() => setShowLanguageModal(true)}
                    />
                    <MenuItem
                        icon={Bell}
                        label={t('notifications')}
                        value={notifStatus === 'granted' ? 'ON' : 'OFF'}
                        onPress={handleNotificationToggle}
                    />
                </View>

                <Text style={styles.sectionTitle}>{t('support')}</Text>
                <View style={styles.menuGroup}>
                    <MenuItem icon={HelpCircle} label={t('help_center', 'Centro de Ayuda')} onPress={() => navigation.navigate('Help')} />
                    <MenuItem icon={Mail} label={t('contact_support')} onPress={() => Linking.openURL('mailto:soporte@garageops.app')} />
                    <MenuItem icon={FileText} label={t('terms')} onPress={() => navigation.navigate('Legal', { type: 'terms' })} />
                    <MenuItem icon={Shield} label={t('privacy')} onPress={() => navigation.navigate('Legal', { type: 'privacy' })} />
                </View>

                <Text style={[styles.sectionTitle, { color: '#FF5252', marginTop: 16 }]}>{t('account_section')}</Text>
                <View style={[styles.menuGroup, { borderColor: '#FF5252' }]}>
                    <MenuItem icon={Trash2} label={t('delete_account')} destructive onPress={handleDeleteAccount} />
                    <MenuItem icon={LogOut} label={t('logout')} onPress={handleLogout} />
                </View>

                <Text style={styles.version}>{t('version')} 1.0.0</Text>
            </ScrollView>

            {/* Language Modal */}
            <Modal
                visible={showLanguageModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowLanguageModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowLanguageModal(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('select_language')}</Text>
                        {LANGUAGES.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={styles.langItem}
                                onPress={() => handleChangeLanguage(lang.code)}
                            >
                                <Text style={styles.langText}>{lang.flag} {lang.label}</Text>
                                {i18n.language === lang.code && <Check size={20} color="#F2780D" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E1E1E', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#E0E0E0' },
    saveText: { fontSize: 16, fontWeight: 'bold', color: '#F2780D' },
    content: { padding: 20 },
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#333' },
    userCardEditing: { borderColor: '#F2780D', backgroundColor: '#1a1a1a' },
    avatarContainer: { marginRight: 16, position: 'relative' },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(242, 120, 13, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F2780D' },
    editAvatarOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#F2780D', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: '#1E1E1E' },
    userInfo: { flex: 1 },
    userName: { fontSize: 20, fontWeight: 'bold', color: '#E0E0E0', marginBottom: 4 },
    editNameInput: { fontSize: 20, fontWeight: 'bold', color: '#E0E0E0', borderBottomWidth: 1, borderBottomColor: '#F2780D', paddingVertical: 4, marginBottom: 4 },
    userEmail: { fontSize: 14, color: '#888', marginBottom: 8 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    roleText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    cancelEditButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#2A2A2A', borderRadius: 12, marginBottom: 24, marginTop: -12 },
    cancelEditText: { color: '#E0E0E0', fontWeight: '600', marginLeft: 8 },
    sectionTitle: { fontSize: 14, color: '#888', fontWeight: 'bold', marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
    menuGroup: { backgroundColor: '#1E1E1E', borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: '#333' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(242, 120, 13, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    menuContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 8 },
    menuLabel: { fontSize: 16, color: '#E0E0E0', fontWeight: '500' },
    menuValue: { fontSize: 14, color: '#666' },
    version: { textAlign: 'center', color: '#444', marginTop: 20, marginBottom: 40 },
    premiumCard: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#F2780D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    premiumContent: { flex: 1, marginRight: 12 },
    premiumTitle: { color: '#F2780D', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
    premiumDesc: { color: '#888', fontSize: 12 },
    premiumButton: { backgroundColor: '#F2780D', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    premiumButtonText: { color: '#121212', fontWeight: 'bold', fontSize: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#E0E0E0', marginBottom: 20, textAlign: 'center' },
    langItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
    langText: { fontSize: 18, color: '#E0E0E0' }
});

export default ProfileScreen;
