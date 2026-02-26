import React, { createContext, useState, useEffect, useContext } from 'react';
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
