import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // --- BRIDGE: DISTRITO ENDURO INTEGRATION (WEB ONLY) ---
        if (Platform.OS === 'web') {
            const distritoSession = localStorage.getItem('distrito_v2_session');
            if (distritoSession) {
                try {
                    const sessionData = JSON.parse(distritoSession);
                    if (sessionData && sessionData.user) {
                        console.log("🔗 Bridge Auth: Logged in using Distrito Enduro Session", sessionData.user);
                        const mockedUser = {
                            uid: `distrito_${sessionData.user.id}`,
                            email: sessionData.user.email,
                            displayName: `${sessionData.user.nombre} ${sessionData.user.apellidos || ''}`,
                            isDistritoUser: true,
                            isActive: sessionData.user.isActive // Extraído de la sesión de Distrito
                        };
                        setUser(mockedUser);
                        setUserProfile({
                            ...sessionData.user,
                            isPremium: sessionData.user.isActive, // Premium solo si ha pagado
                            source: 'distrito'
                        });
                        setLoading(false);
                        return; // Bypass original Firebase Auth
                    }
                } catch (e) {
                    console.error("Error parsing Distrito session:", e);
                }
            }
            
            // Si es plataforma web y no hay sesión de Distrito Enduro, redirigimos al login
            // Evitamos totalmente mostrar el Firebase Auth Login
            console.log("🔴 No valid Distrito session found. Redirecting to login...");
            window.location.href = '/login.html';
            return;
        }
        // --- END BRIDGE ---

        let unsubscribeProfile = () => { };

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Subscribe to real-time profile updates
                const docRef = doc(db, "users", currentUser.uid);
                unsubscribeProfile = onSnapshot(docRef, (doc) => {
                    if (doc.exists()) {
                        setUserProfile({ ...doc.data(), isPremium: true });
                    } else {
                        setUserProfile({ isPremium: true });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Profile snapshot error:", error);
                    setLoading(false);
                });
            } else {
                setUserProfile(null);
                unsubscribeProfile();
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeProfile();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, userProfile, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
