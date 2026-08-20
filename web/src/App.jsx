import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { auth, db, functions, storage, getMessagingIfSupported, VAPID_KEY } from './firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getToken, onMessage } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { 
  Home, 
  Bike, 
  Wrench, 
  History, 
  User, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Zap,
  Search,
  FileText,
  Gauge,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  ArrowUpRight,
  ShieldAlert,
  Sliders,
  Trash2,
  Edit2,
  Shield,
  Users,
  BarChart3,
  Lock,
  HelpCircle,
  Bell,
  X,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { TRANSLATIONS, translateCategory } from './locales';
import { computePlanStats } from './utils/billing';
import {
  PLAN_COLOR_STYLES,
  DEFAULT_PLAN_COLOR,
  PLAN_LANGUAGES,
  getLocalizedPlanText,
  getLocalizedPlanList,
  PAYMENT_GATEWAY_ENABLED,
  SEED_PLANS,
} from './utils/plans';
import { toDateMs, addMonths, computeNextRenewal, getInspectionLabel, getInspectionStatus } from './utils/dates';
import { optimizeImageFile, optimizeReceiptImage } from './utils/image';
import { CURRENCIES, DEFAULT_CURRENCY, getCurrencySymbol } from './utils/currency';
import { OnboardingTour } from './components/OnboardingTour';
import { ChangelogModal } from './components/ChangelogModal';
import { APP_VERSION, CHANGELOG } from './changelog';
import { NavItem } from './components/NavItem';
import { MobileNavItem } from './components/MobileNavItem';
import { MetricBento } from './components/MetricBento';
import { VehicleBentoCard } from './components/VehicleBentoCard';
import { AdminBackoffice } from './components/AdminBackoffice';
import { ProfileSettings } from './components/ProfileSettings';
import { HistoryView } from './components/HistoryView';
import { GarageList } from './components/GarageList';
import { PartsView } from './components/PartsView';
import { DashboardView } from './components/DashboardView';
import { VehicleDetailView } from './components/VehicleDetailView';
import { identifyUser, resetAnalyticsUser, trackEvent } from './analytics';

export { PLAN_COLOR_STYLES };

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [photoPreviewModal, setPhotoPreviewModal] = useState(null);
  
  // Estado de Autenticación Firebase
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userProfile, setUserProfile] = useState(null); // Perfil real leído de Firestore
  // Tour de bienvenida: se muestra solo una vez (marcado en Firestore) y se puede reabrir a mano con el botón de ayuda
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  // Modal de "Novedades": se muestra a usuarios ya existentes cuando hay cambios sin ver desde
  // su último acceso (ver src/changelog.js). Los usuarios nuevos arrancan con lastSeenVersion
  // ya al día (fijado al crear su documento), así que nunca lo ven.
  const [changelogEntries, setChangelogEntries] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '', rememberMe: true });
  const [loginError, setLoginError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Referencia mutable al plan por defecto vigente (se sincroniza más abajo, una vez cargados los planes),
  // para poder leer siempre su valor más reciente dentro del callback de auth sin resuscribir el listener.
  const defaultPlanIdRef = useRef('starter');

  // Listener de sesión Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setUserEmail(user?.email || '');
      setAuthLoading(false);

      if (user) {
        // Garantizar que la cuenta actual existe en la colección de usuarios de Firestore
        const isApiRez = user.email && user.email.toLowerCase() === 'apirezsalsa@gmail.com';
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const existingSnap = await getDoc(userDocRef);
          if (!existingSnap.exists()) {
            // Solo se fija el plan en la creación inicial del documento: si ya existe, no lo
            // pisamos en cada login (pisaba pases-regalo y downgrades hechos por el admin).
            await setDoc(userDocRef, {
              email: user.email,
              role: isApiRez ? 'admin' : 'user',
              plan: isApiRez ? 'unlimited' : defaultPlanIdRef.current,
              billingCycle: 'monthly',
              planStartDate: serverTimestamp(),
              pendingPlanChange: null,
              lastSeenVersion: APP_VERSION,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            await setDoc(userDocRef, {
              email: user.email,
              role: isApiRez ? 'admin' : (existingSnap.data().role || 'user'),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (e) {
          console.warn('Error al sincronizar documento de usuario en Firestore:', e);
        }

        // Escuchar perfil real en tiempo real desde Firestore
        const unsubProfile = onSnapshot(userDocRef, (profileSnap) => {
          if (profileSnap && profileSnap.exists()) {
            const data = profileSnap.data();
            // Si el usuario tiene el rol 'admin', su plan efectivo siempre es 'unlimited' sin pagar
            if (data.role === 'admin' && data.plan !== 'unlimited') {
              updateDoc(userDocRef, { plan: 'unlimited', updatedAt: serverTimestamp() }).catch(err => console.warn('Error updating admin plan:', err));
              data.plan = 'unlimited';
            }
            setUserProfile(data);
            identifyUser(user.uid, { email: data.email, plan: data.plan, role: data.role });
          }
        }, (e) => console.warn('Error al leer perfil de Firestore:', e));
        return () => unsubProfile();
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Muestra el tour de bienvenida una sola vez por usuario (se marca en Firestore al terminarlo o saltarlo)
  useEffect(() => {
    if (firebaseUser && userProfile && userProfile.hasSeenOnboarding !== true) {
      setOnboardingStep(0);
      setShowOnboarding(true);
    }
  }, [firebaseUser, userProfile?.hasSeenOnboarding]);

  // Embudo de onboarding: qué paso ve cada usuario, para detectar en qué pantalla abandonan
  const ONBOARDING_LAST_STEP = 4;
  useEffect(() => {
    if (showOnboarding) trackEvent('onboarding_step_viewed', { step: onboardingStep });
  }, [showOnboarding, onboardingStep]);

  const closeOnboarding = (isFinished = false) => {
    trackEvent(onboardingStep >= ONBOARDING_LAST_STEP ? 'onboarding_completed' : 'onboarding_skipped', { step: onboardingStep });
    setShowOnboarding(false);
    if (firebaseUser) {
      updateDoc(doc(db, 'users', firebaseUser.uid), { hasSeenOnboarding: true, updatedAt: serverTimestamp() })
        .catch(err => console.warn('Error al guardar que se vio el tour de bienvenida:', err));
    }
    if (isFinished && vehicles.length === 0) {
      openAddVehicleModal();
    }
  };

  // Muestra el modal de "Novedades" a usuarios que ya conocen la app (vieron el onboarding) en
  // cuanto detectamos que hay versiones con cambios que no ha visto todavía.
  useEffect(() => {
    if (!firebaseUser || !userProfile) return;
    if (userProfile.hasSeenOnboarding !== true) return; // el tour de bienvenida ya cubre lo nuevo
    if (userProfile.lastSeenVersion === APP_VERSION) return;

    const lastSeenIndex = CHANGELOG.findIndex(c => c.version === userProfile.lastSeenVersion);
    const entries = lastSeenIndex === -1
      ? [CHANGELOG[CHANGELOG.length - 1]] // versión desconocida (usuarios previos a esta función): solo lo último, no todo el histórico
      : CHANGELOG.slice(lastSeenIndex + 1);

    if (entries.length > 0) setChangelogEntries(entries);
  }, [firebaseUser, userProfile?.hasSeenOnboarding, userProfile?.lastSeenVersion]);

  const closeChangelog = () => {
    setChangelogEntries(null);
    if (firebaseUser) {
      updateDoc(doc(db, 'users', firebaseUser.uid), { lastSeenVersion: APP_VERSION, updatedAt: serverTimestamp() })
        .catch(err => console.warn('Error al guardar la versión de novedades vista:', err));
    }
  };

  // Detectar si el usuario intenta acceder vía backdoor / admin directo (?admin o #admin en la URL)
  const isAdminDirectURL = 
    window.location.hash.toLowerCase() === '#admin' || 
    window.location.search.toLowerCase().includes('admin');

  // Acceso al Backoffice: únicamente usuarios con role 'admin' o el email principal apirezsalsa@gmail.com
  const isSuperAdmin = 
    userProfile?.role === 'admin' ||
    userEmail?.toLowerCase() === 'apirezsalsa@gmail.com';

  // Si entra por la URL especial de admin y se verifica que es SuperAdmin, redirigir directamente al Backoffice
  useEffect(() => {
    if (isAdminDirectURL && isSuperAdmin && firebaseUser) {
      setActiveTab('admin');
    }
  }, [isAdminDirectURL, isSuperAdmin, firebaseUser]);

  // Planes de suscripción configurables desde el Backoffice (Firestore: colección 'plans')
  const [plans, setPlans] = useState([]);
  const plansById = useMemo(() => Object.fromEntries(plans.map(p => [p.id, p])), [plans]);
  const defaultPlanId = useMemo(() => plans.find(p => p.isDefaultSignup && p.active !== false)?.id || 'starter', [plans]);
  useEffect(() => { defaultPlanIdRef.current = defaultPlanId; }, [defaultPlanId]);

  // Listener global de planes + siembra inicial (una sola vez, hecha por el SuperAdmin si la colección está vacía)
  useEffect(() => {
    if (!firebaseUser) return;
    const plansQuery = query(collection(db, 'plans'), orderBy('order'));
    const unsubPlans = onSnapshot(plansQuery, async (snap) => {
      if (snap.empty) {
        setPlans(SEED_PLANS);
        if (isSuperAdmin) {
          try {
            for (const seed of SEED_PLANS) {
              const { id, ...data } = seed;
              await setDoc(doc(db, 'plans', id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            }
          } catch (err) {
            console.warn('Error al sembrar planes iniciales:', err);
          }
        }
        return;
      }
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Firestore plans listener fallback:', err));
    return () => unsubPlans();
  }, [firebaseUser, isSuperAdmin]);

  const [allUsersList, setAllUsersList] = useState([]);
  const [vehicleCountsByUser, setVehicleCountsByUser] = useState({}); // { uid: count }
  const [transactions, setTransactions] = useState([]);
  const [inspectingUser, setInspectingUser] = useState(null); // usuario siendo inspeccionado en modo soporte
  // uid que realmente debe usarse para leer/escribir datos: el del usuario inspeccionado si hay uno activo, si no el del admin autenticado
  const effectiveUserId = inspectingUser ? inspectingUser.id : firebaseUser?.uid;

  // Estado del permiso de notificaciones push: 'default' | 'granted' | 'denied' | 'unsupported'
  const [pushPermissionStatus, setPushPermissionStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [pushRequestInFlight, setPushRequestInFlight] = useState(false);
  const [testPushInFlight, setTestPushInFlight] = useState(false);

  // Escucha pushes que llegan con la app en primer plano (el navegador no muestra el toast del
  // sistema automáticamente en foreground, así que lo mostramos nosotros vía NoticeModal).
  useEffect(() => {
    let unsubscribe;
    (async () => {
      const messaging = await getMessagingIfSupported();
      if (!messaging) return;
      unsubscribe = onMessage(messaging, (payload) => {
        setNoticeModal({
          title: payload.notification?.title || 'MyGarageOps',
          message: payload.notification?.body || '',
          type: 'info'
        });
      });
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const handleEnablePushNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setPushPermissionStatus('unsupported');
      return;
    }
    setPushRequestInFlight(true);
    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging) {
        setPushPermissionStatus('unsupported');
        return;
      }
      const permission = await Notification.requestPermission();
      setPushPermissionStatus(permission);
      if (permission !== 'granted') return;

      const swRegistration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
      if (token && effectiveUserId) {
        await updateDoc(doc(db, 'users', effectiveUserId), { fcmTokens: arrayUnion(token) });
      }
    } catch (err) {
      console.warn('Error activando notificaciones push:', err);
    } finally {
      setPushRequestInFlight(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushInFlight(true);
    try {
      const sendTestPushNotification = httpsCallable(functions, 'sendTestPushNotification');
      await sendTestPushNotification();
      setNoticeModal({
        title: language === 'es' ? 'Prueba enviada' : language === 'en' ? 'Test sent' : language === 'it' ? 'Test inviato' : language === 'fr' ? 'Test envoyé' : language === 'de' ? 'Test gesendet' : 'Teste enviado',
        message: language === 'es' ? 'Si tienes las notificaciones activadas en este dispositivo, deberías recibirla en unos segundos.' : language === 'en' ? 'If notifications are enabled on this device, you should receive it in a few seconds.' : language === 'it' ? 'Se le notifiche sono attive su questo dispositivo, dovresti riceverla tra pochi secondi.' : language === 'fr' ? 'Si les notifications sont activées sur cet appareil, vous devriez la recevoir dans quelques secondes.' : language === 'de' ? 'Wenn Benachrichtigungen auf diesem Gerät aktiviert sind, solltest du sie in wenigen Sekunden erhalten.' : 'Se as notificações estiverem ativas neste dispositivo, deverás recebê-la em alguns segundos.',
        type: 'info'
      });
    } catch (err) {
      console.warn('Error enviando push de prueba:', err);
      setNoticeModal({
        title: language === 'es' ? 'Error' : language === 'en' ? 'Error' : language === 'it' ? 'Errore' : language === 'fr' ? 'Erreur' : language === 'de' ? 'Fehler' : 'Erro',
        message: language === 'es' ? 'No se pudo enviar la notificación de prueba.' : language === 'en' ? 'Could not send the test notification.' : language === 'it' ? 'Impossibile inviare la notifica di prova.' : language === 'fr' ? "Impossible d'envoyer la notification de test." : language === 'de' ? 'Die Testbenachrichtigung konnte nicht gesendet werden.' : 'Não foi possível enviar a notificação de teste.',
        type: 'error'
      });
    } finally {
      setTestPushInFlight(false);
    }
  };

  // Registra en Firestore quién hizo qué mientras estaba en Modo Inspección (auditoría)
  const logInspectionAction = async (action, colName, docId, data) => {
    if (!inspectingUser || !firebaseUser) return;
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action, // 'create' | 'update' | 'delete'
        collection: colName,
        docId: String(docId),
        data: data || null,
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || null,
        targetUid: inspectingUser.id,
        targetEmail: inspectingUser.email || null,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('No se pudo registrar el log de auditoría:', err);
    }
  };
  const [noticeModal, setNoticeModal] = useState(null); // Modal de notificaciones personalizadas

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginForm.email || !loginForm.password) {
      setLoginError('Por favor completa todos los campos');
      return;
    }
    try {
      if (isRegisterMode) {
        const cred = await createUserWithEmailAndPassword(auth, loginForm.email, loginForm.password);
        // Crear perfil en Firestore
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: loginForm.email,
          plan: defaultPlanIdRef.current,
          billingCycle: 'monthly',
          planStartDate: serverTimestamp(),
          pendingPlanChange: null,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      }
    } catch (err) {
      const errorMap = {
        'auth/email-already-in-use': 'Este correo ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email': 'Correo electrónico no válido',
        'auth/invalid-credential': 'Correo o contraseña incorrectos',
        'auth/user-not-found': 'No existe una cuenta con ese correo',
        'auth/wrong-password': 'Contraseña incorrecta'
      };
      setLoginError(errorMap[err.code] || err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setLoginError(language === 'es' ? 'No se pudo iniciar sesión con Google' : language === 'en' ? 'Could not sign in with Google' : language === 'it' ? 'Impossibile accedere con Google' : language === 'fr' ? 'Impossible de se connecter avec Google' : language === 'de' ? 'Anmeldung mit Google fehlgeschlagen' : 'Não foi possível iniciar sessão com o Google');
      }
    }
  };

  const handleAppleLogin = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, new OAuthProvider('apple.com'));
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setLoginError(language === 'es' ? 'No se pudo iniciar sesión con Apple' : language === 'en' ? 'Could not sign in with Apple' : language === 'it' ? 'Impossibile accedere con Apple' : language === 'fr' ? 'Impossible de se connecter avec Apple' : language === 'de' ? 'Anmeldung mit Apple fehlgeschlagen' : 'Não foi possível iniciar sessão com a Apple');
      }
    }
  };

  const handleLogout = async () => {
    resetAnalyticsUser();
    await signOut(auth);
  };

  // Datos sincronizados con Firestore (por usuario)
  const [vehicles, setVehicles] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [parts, setParts] = useState([]);

  // Helper: referencia a colección raíz filtrada por usuario
  const userCol = useCallback((colName) => {
    if (!firebaseUser) return null;
    return collection(db, colName);
  }, [firebaseUser]);

  // Listeners Firestore en tiempo real — colecciones raíz filtradas por userId
  useEffect(() => {
    if (!firebaseUser) {
      setVehicles([]);
      setMaintenances([]);
      setParts([]);
      return;
    }

    const uid = effectiveUserId;
    const localVehKey = `garageops_vehicles_${uid}`;
    const localMaintKey = `garageops_maintenances_${uid}`;
    const localPartsKey = `garageops_parts_${uid}`;

    // Cargar datos guardados previamente en local por si falla Firestore
    const savedVeh = localStorage.getItem(localVehKey);
    const savedMaint = localStorage.getItem(localMaintKey);
    const savedParts = localStorage.getItem(localPartsKey);

    setVehicles(savedVeh ? JSON.parse(savedVeh) : []);
    setMaintenances(savedMaint ? JSON.parse(savedMaint) : []);
    setParts(savedParts ? JSON.parse(savedParts) : []);

    // Colecciones raíz filtradas por el userId del usuario autenticado
    const vehiclesQuery = query(collection(db, 'vehicles'), where('userId', '==', uid));
    const maintQuery = query(collection(db, 'maintenances'), where('userId', '==', uid));
    const partsQuery = query(collection(db, 'parts'), where('userId', '==', uid));

    // Helper para convertir cualquier objeto Timestamp de Firestore a string legible
    const sanitizeValue = (val) => {
      if (!val) return val;
      if (typeof val === 'object') {
        if (typeof val.seconds === 'number') {
          return new Date(val.seconds * 1000).toISOString().split('T')[0];
        }
        if (val instanceof Date) {
          return val.toISOString().split('T')[0];
        }
        if (Array.isArray(val)) {
          return val.map(sanitizeValue);
        }
        const sanitizedObj = {};
        for (const [k, v] of Object.entries(val)) {
          sanitizedObj[k] = sanitizeValue(v);
        }
        return sanitizedObj;
      }
      return val;
    };

    const sanitizeDoc = (d) => {
      const data = d.data();
      const res = { id: d.id };
      for (const [k, v] of Object.entries(data)) {
        res[k] = sanitizeValue(v);
      }
      return res;
    };

    const unsub1 = onSnapshot(vehiclesQuery, (snap) => {
      const list = snap.docs.map(sanitizeDoc);
      setVehicles(list);
      localStorage.setItem(localVehKey, JSON.stringify(list));
    }, (err) => console.warn('Firestore vehicles listener fallback:', err));

    const unsub2 = onSnapshot(maintQuery, (snap) => {
      const items = snap.docs.map(sanitizeDoc);
      items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      setMaintenances(items);
      localStorage.setItem(localMaintKey, JSON.stringify(items));
    }, (err) => console.warn('Firestore maintenances listener fallback:', err));

    const unsub3 = onSnapshot(partsQuery, (snap) => {
      const list = snap.docs.map(sanitizeDoc);
      setParts(list);
      localStorage.setItem(localPartsKey, JSON.stringify(list));
    }, (err) => console.warn('Firestore parts listener fallback:', err));

    // Listener de colección de usuarios reales de Firestore para el Backoffice
    const allUsersCol = collection(db, 'users');
    const allVehiclesCol = collection(db, 'vehicles');

    // Conteo real de vehículos por userId
    const unsub5 = onSnapshot(allVehiclesCol, (vehSnap) => {
      const countsByUser = {};
      vehSnap.docs.forEach(d => {
        const uid = d.data().userId;
        if (uid) countsByUser[uid] = (countsByUser[uid] || 0) + 1;
      });
      setVehicleCountsByUser(countsByUser);
    }, (err) => console.warn('Firestore vehicles count listener fallback:', err));

    const unsub4 = onSnapshot(allUsersCol, (snap) => {
      if (!snap.empty) {
        const realUsers = snap.docs.map(d => {
          const data = d.data();

          // Extraer fecha de registro
          let regDate = null;
          if (data.createdAt) {
            if (typeof data.createdAt.seconds === 'number') {
              regDate = new Date(data.createdAt.seconds * 1000);
            } else if (typeof data.createdAt === 'string') {
              regDate = new Date(data.createdAt);
            }
          } else if (data.updatedAt && typeof data.updatedAt.seconds === 'number') {
            regDate = new Date(data.updatedAt.seconds * 1000);
          }

          // Extraer última conexión
          let lastLogin = null;
          if (data.updatedAt) {
            if (typeof data.updatedAt.seconds === 'number') {
              lastLogin = new Date(data.updatedAt.seconds * 1000);
            } else if (typeof data.updatedAt === 'string') {
              lastLogin = new Date(data.updatedAt);
            }
          }

          return {
            id: d.id,
            email: data.email || `user_${d.id.slice(0, 5)}@garageops.io`,
            role: data.role || 'user',
            plan: data.plan || defaultPlanId,
            billingCycle: data.billingCycle || 'monthly',
            pendingPlanChange: data.pendingPlanChange || null,
            giftDays: data.giftDays || 0,
            giftPlanExpiry: data.giftPlanExpiry || null,
            status: data.status || 'active',
            registered: regDate,
            lastLogin: lastLogin
          };
        });
        setAllUsersList(realUsers);
      } else {
        setAllUsersList([]);
      }
    }, (err) => console.warn('Firestore users collection listener fallback:', err));

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [firebaseUser, inspectingUser]);

  // Histórico de transacciones de Stripe (altas, modificaciones y bajas), solo para el Backoffice
  useEffect(() => {
    if (!firebaseUser || !isSuperAdmin) return;
    const transactionsQuery = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(300));
    const unsubTransactions = onSnapshot(transactionsQuery, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Firestore transactions listener fallback:', err));
    return () => unsubTransactions();
  }, [firebaseUser, isSuperAdmin]);


  // Historial de pagos del propio usuario, para mostrar en "Ajustes & Suscripción"
  const [myTransactions, setMyTransactions] = useState([]);
  useEffect(() => {
    if (!firebaseUser) return;
    const myTransactionsQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubMyTransactions = onSnapshot(myTransactionsQuery, (snap) => {
      setMyTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Firestore my-transactions listener fallback:', err));
    return () => unsubMyTransactions();
  }, [firebaseUser]);

  // Helpers para guardar/actualizar/borrar — colecciones raíz con userId
  const firestoreAdd = async (colName, data) => {
    const uid = effectiveUserId;
    const newItem = { ...data, id: String(Date.now()), createdAtMs: Date.now(), userId: uid };

    // Actualizar estado local inmediatamente
    if (colName === 'vehicles') setVehicles(prev => [newItem, ...prev]);
    if (colName === 'maintenances') setMaintenances(prev => [newItem, ...prev]);
    if (colName === 'parts') setParts(prev => [newItem, ...prev]);

    if (uid) {
      const key = `garageops_${colName}_${uid}`;
      try {
        // Usamos setDoc con ID determinista para que el ID local coincida con el
        // ID del documento en Firestore (addDoc generaba uno distinto, provocando
        // que update/delete inmediatos tras crear apuntaran al doc equivocado).
        const ref = doc(db, colName, newItem.id);
        await setDoc(ref, newItem);
        await logInspectionAction('create', colName, newItem.id, data);
        return newItem.id;
      } catch (err) {
        console.warn(`Firestore add ${colName} error, saving locally:`, err);
        // Persistir en localStorage por usuario
        const currentLocal = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([newItem, ...currentLocal]));
      }
    }
    return newItem.id;
  };

  const firestoreUpdate = async (colName, docId, data) => {
    // Actualizar estado local inmediatamente
    if (colName === 'vehicles') setVehicles(prev => prev.map(v => v.id === docId ? { ...v, ...data } : v));
    if (colName === 'maintenances') setMaintenances(prev => prev.map(m => m.id === docId ? { ...m, ...data } : m));
    if (colName === 'parts') setParts(prev => prev.map(p => p.id === docId ? { ...p, ...data } : p));

    if (firebaseUser) {
      const uid = effectiveUserId;
      const key = `garageops_${colName}_${uid}`;
      try {
        const ref = doc(db, colName, String(docId));
        await updateDoc(ref, data);
        await logInspectionAction('update', colName, docId, data);
      } catch (err) {
        console.warn(`Firestore update ${colName} error:`, err);
        const currentLocal = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = currentLocal.map(item => String(item.id) === String(docId) ? { ...item, ...data } : item);
        localStorage.setItem(key, JSON.stringify(updated));
      }
    }
  };

  const firestoreDelete = async (colName, docId) => {
    // Actualizar estado local inmediatamente
    if (colName === 'vehicles') setVehicles(prev => prev.filter(v => v.id !== docId));
    if (colName === 'maintenances') setMaintenances(prev => prev.filter(m => m.id !== docId));
    if (colName === 'parts') setParts(prev => prev.filter(p => p.id !== docId));

    if (firebaseUser) {
      const uid = effectiveUserId;
      const key = `garageops_${colName}_${uid}`;
      try {
        const ref = doc(db, colName, String(docId));
        await deleteDoc(ref);
        await logInspectionAction('delete', colName, docId, null);
      } catch (err) {
        console.warn(`Firestore delete ${colName} error:`, err);
        const currentLocal = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = currentLocal.filter(item => String(item.id) !== String(docId));
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  };

  // Estado de Idioma (es, en, it) con persistencia local
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('garageops_language') || 'es';
  });

  const t = (key) => {
    return (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.es[key] || key;
  };

  React.useEffect(() => {
    localStorage.setItem('garageops_language', language);
  }, [language]);

  // Moneda de visualización para importes introducidos por el usuario (mantenimientos, repuestos).
  // Sin conversión de cambio: un registro ya guardado conserva el símbolo con el que se creó, esto
  // solo decide qué símbolo se usa para lo nuevo. Persistencia local, igual que el idioma.
  const [currency, setCurrency] = useState(() => localStorage.getItem('garageops_currency') || DEFAULT_CURRENCY);
  const currencySymbol = getCurrencySymbol(currency);
  useEffect(() => {
    localStorage.setItem('garageops_currency', currency);
  }, [currency]);

  // Estado de Plan Activo y Frecuencia de Facturación
  const activeUserPlan = (userProfile?.role === 'admin' || userEmail?.toLowerCase() === 'apirezsalsa@gmail.com') 
    ? 'unlimited' 
    : (userProfile?.plan || localStorage.getItem('garageops_plan') || 'starter');

  const [currentPlan, setCurrentPlan] = useState(activeUserPlan);

  useEffect(() => {
    setCurrentPlan(activeUserPlan);
  }, [activeUserPlan]);

  // Ciclo de facturación realmente contratado (persistido en Firestore); por defecto mensual
  const activeBillingCycle = userProfile?.billingCycle || 'monthly';
  // Selector de la UI de Ajustes: qué ciclo se está previsualizando/eligiendo (empieza igualado al contratado)
  const [billingCycle, setBillingCycle] = useState(activeBillingCycle);
  useEffect(() => {
    setBillingCycle(activeBillingCycle);
  }, [activeBillingCycle]);

  // Definición del plan activo y límite de vehículos derivados de la configuración dinámica (colección 'plans')
  const currentPlanDef = plansById[currentPlan];
  const maxVehiclesAllowed = currentPlanDef ? (currentPlanDef.maxVehicles === -1 ? Infinity : currentPlanDef.maxVehicles) : 999;
  const maxVehiclesLabel = maxVehiclesAllowed === Infinity ? '∞' : String(maxVehiclesAllowed);

  React.useEffect(() => {
    localStorage.setItem('garageops_plan', currentPlan);
  }, [currentPlan]);

  // Fecha de alta del plan (ancla de facturación) y próxima renovación calculada a partir de ella
  const planStartMs = toDateMs(userProfile?.planStartDate, Date.now());
  const nextRenewalDate = useMemo(
    () => computeNextRenewal(planStartMs, activeBillingCycle),
    [planStartMs, activeBillingCycle]
  );

  // Cambio de plan/ciclo pendiente (programado para hacerse efectivo en la próxima renovación, sin devoluciones ni prorrateos)
  const pendingPlanChange = userProfile?.pendingPlanChange || null;

  // Cuando la renovación programada ya se ha cumplido, aplica el cambio de plan pendiente
  useEffect(() => {
    if (!firebaseUser || !pendingPlanChange?.effectiveAt) return;
    const effectiveMs = new Date(pendingPlanChange.effectiveAt).getTime();
    if (isNaN(effectiveMs) || Date.now() < effectiveMs) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    updateDoc(userDocRef, {
      plan: pendingPlanChange.planId,
      billingCycle: pendingPlanChange.billingCycle || 'monthly',
      planStartDate: Timestamp.fromDate(new Date(effectiveMs)),
      pendingPlanChange: null,
      updatedAt: serverTimestamp()
    }).catch(err => console.warn('Error al aplicar el cambio de plan programado:', err));
  }, [firebaseUser, pendingPlanChange]);

  // Al volver de Stripe Checkout/Portal, informa al usuario del resultado y limpia el parámetro de la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get('checkout');
    if (!checkoutResult) return;
    if (checkoutResult === 'success') {
      setNoticeModal({
        title: language === 'es' ? 'Pago confirmado' : language === 'en' ? 'Payment confirmed' : language === 'it' ? 'Pagamento confermato' : language === 'fr' ? 'Paiement confirmé' : language === 'de' ? 'Zahlung bestätigt' : 'Pagamento confirmado',
        message: language === 'es' ? 'Tu suscripción se está activando. Puede tardar unos segundos en reflejarse.' : language === 'en' ? 'Your subscription is being activated. It may take a few seconds to show up.' : language === 'it' ? 'Il tuo abbonamento si sta attivando. Potrebbe richiedere alcuni secondi.' : language === 'fr' ? 'Votre abonnement est en cours d\'activation. Cela peut prendre quelques secondes.' : language === 'de' ? 'Dein Abo wird gerade aktiviert. Das kann ein paar Sekunden dauern.' : 'A tua subscrição está a ser ativada. Pode demorar alguns segundos a refletir-se.',
        type: 'success'
      });
    } else if (checkoutResult === 'cancelled') {
      setNoticeModal({
        title: language === 'es' ? 'Pago cancelado' : language === 'en' ? 'Payment cancelled' : language === 'it' ? 'Pagamento annullato' : language === 'fr' ? 'Paiement annulé' : language === 'de' ? 'Zahlung storniert' : 'Pagamento cancelado',
        message: language === 'es' ? 'No se ha realizado ningún cargo.' : language === 'en' ? 'No charge was made.' : language === 'it' ? 'Non è stato addebitato alcun importo.' : language === 'fr' ? 'Aucun montant n\'a été débité.' : language === 'de' ? 'Es wurde kein Betrag abgebucht.' : 'Não foi efetuada nenhuma cobrança.',
        type: 'warning'
      });
    }
    params.delete('checkout');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
  }, []);

  // Redirige a Stripe Checkout para contratar un plan de pago nuevo (la activación real la hace el webhook al completarse el pago)
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const handleStripeCheckout = async (targetPlanId, targetBillingCycle) => {
    if (!firebaseUser || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const { data } = await createCheckoutSession({ planId: targetPlanId, billingCycle: targetBillingCycle });
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error('Error al iniciar el checkout de Stripe:', err);
      setNoticeModal({
        title: 'Error',
        message: language === 'es' ? 'No se pudo iniciar el proceso de pago. Inténtalo de nuevo.' : language === 'en' ? 'Could not start checkout. Please try again.' : language === 'it' ? 'Non è stato possibile avviare il pagamento. Riprova.' : language === 'fr' ? 'Impossible de démarrer le paiement. Réessayez.' : language === 'de' ? 'Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuche es erneut.' : 'Não foi possível iniciar o processo de pagamento. Tenta novamente.',
        type: 'warning'
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Abre el Portal de Facturación de Stripe para que el usuario gestione o cancele su suscripción activa
  const handleOpenBillingPortal = async () => {
    if (!firebaseUser || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const createPortalSession = httpsCallable(functions, 'createPortalSession');
      const { data } = await createPortalSession();
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error('Error al abrir el portal de facturación:', err);
      setNoticeModal({
        title: 'Error',
        message: language === 'es' ? 'No se pudo abrir el portal de facturación.' : language === 'en' ? 'Could not open the billing portal.' : language === 'it' ? 'Non è stato possibile aprire il portale di fatturazione.' : language === 'fr' ? 'Impossible d\'ouvrir le portail de facturation.' : language === 'de' ? 'Das Rechnungsportal konnte nicht geöffnet werden.' : 'Não foi possível abrir o portal de faturação.',
        type: 'warning'
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Programa un cambio de plan y/o ciclo de facturación para la próxima renovación (nunca inmediato, nunca con devolución/prorrateo)
  const handlePlanSelection = async (targetPlanId, targetBillingCycle) => {
    if (!firebaseUser) return;
    const targetPlanDef = plansById[targetPlanId];
    if (!PAYMENT_GATEWAY_ENABLED && (targetPlanDef?.priceMonthly || 0) > 0) {
      trackEvent('paywall_hit', { context: 'plan_selection', plan: currentPlan, targetPlan: targetPlanId });
      setNoticeModal({
        title: language === 'es' ? 'Mejora de Plan Aún No Disponible' : language === 'en' ? 'Plan Upgrade Not Available Yet' : language === 'it' ? 'Aggiornamento Piano Non Disponibile' : language === 'fr' ? 'Mise à Niveau du Plan Pas Encore Disponible' : language === 'de' ? 'Plan-Upgrade Noch Nicht Verfügbar' : 'Atualização de Plano Ainda Não Disponível',
        message: language === 'es'
          ? `Todavía no tenemos activada la pasarela de pago. Escríbenos a soporte y te activaremos manualmente el plan ${targetPlanDef?.name || targetPlanId}.`
          : language === 'en'
            ? `Our payment gateway isn't live yet. Contact support and we'll manually activate the ${targetPlanDef?.name || targetPlanId} plan for you.`
            : language === 'it'
              ? `Il nostro gateway di pagamento non è ancora attivo. Contatta il supporto per attivare manualmente il piano ${targetPlanDef?.name || targetPlanId}.`
              : language === 'fr'
                ? `Notre passerelle de paiement n'est pas encore active. Contactez le support et nous activerons manuellement le plan ${targetPlanDef?.name || targetPlanId} pour vous.`
                : language === 'de'
                  ? `Unser Zahlungsgateway ist noch nicht aktiv. Kontaktiere den Support, und wir aktivieren manuell den Plan ${targetPlanDef?.name || targetPlanId} für dich.`
                  : `Ainda não temos o gateway de pagamento ativado. Contacta o suporte e ativaremos manualmente o plano ${targetPlanDef?.name || targetPlanId} para ti.`,
        type: 'info'
      });
      return;
    }
    // Con la pasarela activa, contratar un plan de pago nuevo se hace vía Stripe Checkout, no por escritura directa en Firestore
    if (PAYMENT_GATEWAY_ENABLED && (targetPlanDef?.priceMonthly || 0) > 0) {
      trackEvent('paywall_hit', { context: 'plan_selection', plan: currentPlan, targetPlan: targetPlanId });
      handleStripeCheckout(targetPlanId, targetBillingCycle);
      return;
    }
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      await updateDoc(userDocRef, {
        pendingPlanChange: {
          planId: targetPlanId,
          billingCycle: targetBillingCycle,
          effectiveAt: nextRenewalDate.toISOString()
        },
        updatedAt: serverTimestamp()
      });
      const planName = plansById[targetPlanId]?.name || targetPlanId;
      const renewalLabel = nextRenewalDate.toLocaleDateString(language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : language === 'it' ? 'it-IT' : language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : 'pt-PT');
      setNoticeModal({
        title: language === 'es' ? 'Cambio de Plan Programado' : language === 'en' ? 'Plan Change Scheduled' : language === 'it' ? 'Cambio Pianificato' : language === 'fr' ? 'Changement de Plan Programmé' : language === 'de' ? 'Planwechsel Geplant' : 'Mudança de Plano Agendada',
        message: language === 'es'
          ? `Tu plan cambiará a ${planName} a partir de tu próxima renovación (${renewalLabel}). Los cambios de plan nunca son inmediatos ni generan devoluciones o prorrateos del importe ya abonado.`
          : language === 'en'
            ? `Your plan will change to ${planName} starting your next renewal (${renewalLabel}). Plan changes are never immediate and no refunds or prorated credits are issued.`
            : language === 'it'
              ? `Il tuo piano cambierà in ${planName} a partire dal prossimo rinnovo (${renewalLabel}). Nessun rimborso o storno per i cambi di piano.`
              : language === 'fr'
                ? `Votre plan changera pour ${planName} à partir de votre prochain renouvellement (${renewalLabel}). Les changements de plan ne sont jamais immédiats et ne génèrent aucun remboursement ni prorata du montant déjà payé.`
                : language === 'de'
                  ? `Dein Plan wechselt zu ${planName} ab deiner nächsten Verlängerung (${renewalLabel}). Planwechsel erfolgen nie sofort und es werden keine Rückerstattungen oder anteiligen Gutschriften für bereits gezahlte Beträge ausgestellt.`
                  : `O teu plano vai mudar para ${planName} a partir da tua próxima renovação (${renewalLabel}). As mudanças de plano nunca são imediatas nem geram reembolsos ou créditos proporcionais do valor já pago.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error al programar el cambio de plan:', err);
      setNoticeModal({ title: 'Error', message: 'No se pudo programar el cambio de plan.', type: 'warning' });
    }
  };

  // Cancela un cambio de plan/ciclo previamente programado, volviendo a dejar el plan actual sin cambios futuros
  const handleCancelPendingPlanChange = async () => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), { pendingPlanChange: null, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('Error al cancelar el cambio de plan programado:', err);
    }
  };
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showAddMaintenanceModal, setShowAddMaintenanceModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [showKmModal, setShowKmModal] = useState(null);
  const [newKmValue, setNewKmValue] = useState('');
  // Lectura secundaria opcional del vehículo (p.ej. km en una moto de enduro que lleva las horas
  // como medidor principal). Es solo informativa: no genera alertas ni tiene su propio historial.
  const [newSecondaryKmValue, setNewSecondaryKmValue] = useState('');

  // Estado para Modal de Alertas Programadas por Vehículo
  const [showAlertModal, setShowAlertModal] = useState(null); // guarda el vehículo target
  const [newAlertForm, setNewAlertForm] = useState({
    type: 'usage', // 'usage' (horas/km) o 'date' (fecha concreta)
    title: '',
    targetUsage: '',
    advanceNotice: '5', // umbral de aviso previo (ej: avisa 5 hrs / 500 km antes)
    targetDate: ''
  });

  const handleAddVehicleAlert = async (e) => {
    e.preventDefault();
    if (!showAlertModal || !newAlertForm.title) return;

    let alertItem;
    if (newAlertForm.type === 'date') {
      if (!newAlertForm.targetDate) return;
      alertItem = {
        id: Date.now(),
        type: 'date',
        title: newAlertForm.title,
        targetDate: newAlertForm.targetDate
      };
    } else {
      if (!newAlertForm.targetUsage) return;
      const targetVal = parseFloat(newAlertForm.targetUsage);
      if (isNaN(targetVal)) return;
      const advanceVal = parseFloat(newAlertForm.advanceNotice) || 0;
      alertItem = {
        id: Date.now(),
        type: 'usage',
        title: newAlertForm.title,
        targetUsage: targetVal,
        advanceNotice: advanceVal
      };
    }

    const updatedAlerts = [...(showAlertModal.alerts || []), alertItem];

    setVehicles(prev => prev.map(v => v.id === showAlertModal.id ? { ...v, alerts: updatedAlerts } : v));

    if (selectedVehicle && selectedVehicle.id === showAlertModal.id) {
      setSelectedVehicle(prev => ({ ...prev, alerts: updatedAlerts }));
    }

    await firestoreUpdate('vehicles', showAlertModal.id, { alerts: updatedAlerts });

    setShowAlertModal(null);
    setNewAlertForm({ type: 'usage', title: '', targetUsage: '', advanceNotice: '5', targetDate: '' });
  };

  const handleDeleteVehicleAlert = async (vehicleId, alertId) => {
    const targetVehicle = vehicles.find(v => v.id === vehicleId) || (selectedVehicle && selectedVehicle.id === vehicleId ? selectedVehicle : null);
    const updatedAlerts = (targetVehicle?.alerts || []).filter(a => a.id !== alertId);

    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, alerts: updatedAlerts } : v));

    if (selectedVehicle && selectedVehicle.id === vehicleId) {
      setSelectedVehicle(prev => ({ ...prev, alerts: updatedAlerts }));
    }

    await firestoreUpdate('vehicles', vehicleId, { alerts: updatedAlerts });
  };

  // Form State para Nuevo Vehículo
  const [newVehicleForm, setNewVehicleForm] = useState({
    name: '',
    category: 'Mantenimiento por Km',
    unit: 'km',
    icon: '🏍️',
    photo: '',
    usageNum: '',
    nextInspectionDate: '',
    licensePlate: '',
    insuranceCompany: ''
  });

  const openAddVehicleModal = () => {
    setEditingVehicleId(null);
    setNewVehicleForm({
      name: '',
      category: 'Mantenimiento por Km',
      unit: 'km',
      icon: '🏍️',
      photo: '',
      usageNum: '',
      nextInspectionDate: '',
      licensePlate: '',
      insuranceCompany: ''
    });
    setShowAddVehicleModal(true);
  };

  const openEditVehicleModal = (v) => {
    setEditingVehicleId(v.id);
    setNewVehicleForm({
      name: v.name || '',
      category: v.category || 'Mantenimiento por Km',
      unit: v.unit || 'km',
      icon: v.icon || '🏍️',
      photo: v.photo || '',
      usageNum: (v.usageNum || 0).toString(),
      nextInspectionDate: v.nextInspectionDate || '',
      licensePlate: v.licensePlate || '',
      insuranceCompany: v.insuranceCompany || ''
    });
    setShowAddVehicleModal(true);
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicleForm.name) return;

    if (editingVehicleId) {
      const updatedData = {
        name: newVehicleForm.name,
        category: newVehicleForm.category,
        icon: newVehicleForm.icon,
        photo: newVehicleForm.photo || null,
        usage: `${newVehicleForm.usageNum || 0} ${newVehicleForm.unit}`,
        usageNum: parseFloat(newVehicleForm.usageNum) || 0,
        unit: newVehicleForm.unit,
        nextInspectionDate: newVehicleForm.nextInspectionDate || null,
        licensePlate: newVehicleForm.licensePlate || null,
        insuranceCompany: newVehicleForm.insuranceCompany || null
      };

      await firestoreUpdate('vehicles', editingVehicleId, updatedData);

      if (selectedVehicle?.id === editingVehicleId) {
        setSelectedVehicle(prev => ({ ...prev, ...updatedData }));
      }

      setShowAddVehicleModal(false);
      setEditingVehicleId(null);
      setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '', nextInspectionDate: '', licensePlate: '', insuranceCompany: '' });
      return;
    }

    // Validación de límites según el plan
    if (vehicles.length >= maxVehiclesAllowed) {
      trackEvent('paywall_hit', { context: 'add_vehicle_limit', plan: currentPlan, maxVehicles: maxVehiclesAllowed });
      setNoticeModal({
        title: 'Límite de Vehículos Alcanzado',
        message: language === 'es'
          ? `Has alcanzado el límite de ${maxVehiclesLabel} vehículos de tu plan (${currentPlanDef?.name || currentPlan.toUpperCase()}). Actualiza tu suscripción en Perfil & Ajustes para añadir más.`
          : language === 'en'
            ? `You reached the limit of ${maxVehiclesLabel} vehicles for your plan (${currentPlanDef?.name || currentPlan.toUpperCase()}). Please upgrade in Profile & Settings.`
            : language === 'it'
              ? `Hai raggiunto il limite di ${maxVehiclesLabel} veicoli del tuo piano (${currentPlanDef?.name || currentPlan.toUpperCase()}). Aggiorna il tuo abbonamento in Profilo & Impostazioni per aggiungerne altri.`
              : language === 'fr'
                ? `Vous avez atteint la limite de ${maxVehiclesLabel} véhicules de votre plan (${currentPlanDef?.name || currentPlan.toUpperCase()}). Mettez à niveau votre abonnement dans Profil & Paramètres pour en ajouter davantage.`
                : language === 'de'
                  ? `Du hast das Limit von ${maxVehiclesLabel} Fahrzeugen deines Plans (${currentPlanDef?.name || currentPlan.toUpperCase()}) erreicht. Aktualisiere dein Abo in Profil & Einstellungen, um mehr hinzuzufügen.`
                  : `Atingiste o limite de ${maxVehiclesLabel} veículos do teu plano (${currentPlanDef?.name || currentPlan.toUpperCase()}). Atualiza a tua subscrição em Perfil & Definições para adicionar mais.`,
        type: 'warning'
      });
      return;
    }

    const newVehicle = {
      name: newVehicleForm.name,
      category: newVehicleForm.category,
      icon: newVehicleForm.icon,
      photo: newVehicleForm.photo || null,
      usage: `${newVehicleForm.usageNum || 0} ${newVehicleForm.unit}`,
      usageNum: parseFloat(newVehicleForm.usageNum) || 0,
      unit: newVehicleForm.unit,
      nextInspectionDate: newVehicleForm.nextInspectionDate || null,
      licensePlate: newVehicleForm.licensePlate || null,
      insuranceCompany: newVehicleForm.insuranceCompany || null,
      nextService: `Próximo servicio`,
      status: 'ok',
      statusText: 'Al día',
      accentColor: 'from-emerald-500/10 to-teal-500/5',
      borderColor: 'border-emerald-500/30'
    };

    await firestoreAdd('vehicles', newVehicle);
    trackEvent('vehicle_added', { category: newVehicle.category });
    setShowAddVehicleModal(false);
    setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '', nextInspectionDate: '', licensePlate: '', insuranceCompany: '' });
  };

  const handleUpdateKm = async (e) => {
    e.preventDefault();
    if (!showKmModal) return;

    const newNum = parseFloat(newKmValue) || 0;
    const secondaryNum = newSecondaryKmValue !== '' ? parseFloat(newSecondaryKmValue) : null;
    const secondaryValid = secondaryNum !== null && !isNaN(secondaryNum);

    await firestoreUpdate('vehicles', showKmModal.id, {
      usage: `${newNum} ${showKmModal.unit}`,
      usageNum: newNum,
      secondaryUsageNum: secondaryValid ? secondaryNum : null
    });

    if (selectedVehicle && selectedVehicle.id === showKmModal.id) {
      setSelectedVehicle(prev => ({
        ...prev,
        usage: `${newNum} ${prev.unit}`,
        usageNum: newNum,
        secondaryUsageNum: secondaryValid ? secondaryNum : null
      }));
    }

    setShowKmModal(null);
    setNewKmValue('');
    setNewSecondaryKmValue('');
  };

  // Estado para Modal Personalizado de Confirmación de Borrado
  const [confirmModal, setConfirmModal] = useState(null);

  const requestDeleteVehicle = (vehicleId) => {
    const v = vehicles.find(item => item.id === vehicleId);
    setConfirmModal({
      title: '¿Eliminar Vehículo?',
      message: `¿Seguro que deseas eliminar "${v?.name || 'este vehículo'}" de tu garaje? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        await firestoreDelete('vehicles', vehicleId);
        if (selectedVehicle?.id === vehicleId) {
          setSelectedVehicle(null);
        }
      }
    });
  };

  const requestDeleteMaintenance = (maintId) => {
    const m = maintenances.find(item => item.id === maintId);
    setConfirmModal({
      title: '¿Borrar Registro de Mantenimiento?',
      message: `¿Seguro que deseas eliminar el registro "${m?.title || 'esta intervención'}"?`,
      onConfirm: async () => {
        await firestoreDelete('maintenances', maintId);
        // Borrar también las fotos de ticket/factura asociadas, para no dejar archivos huérfanos en Storage
        for (const receipt of m?.receipts || []) {
          if (receipt.path) {
            try {
              await deleteObject(storageRef(storage, receipt.path));
            } catch (err) {
              console.warn('No se pudo borrar una foto de recibo huérfana:', err);
            }
          }
        }
      }
    });
  };

  const requestDeletePart = (partId) => {
    const p = parts.find(item => item.id === partId);
    setConfirmModal({
      title: '¿Eliminar Repuesto?',
      message: `¿Seguro que deseas eliminar el repuesto "${p?.name || 'esta pieza'}" del inventario?`,
      onConfirm: async () => {
        await firestoreDelete('parts', partId);
      }
    });
  };

  // Unidades de medida disponibles para repuestos/consumibles (afecta cómo se descuenta el stock)
  const PART_UNITS = [
    { value: 'ud', label: 'Unidad (ud)' },
    { value: 'L', label: 'Litro (L)' },
    { value: 'ml', label: 'Mililitro (ml)' },
    { value: 'kg', label: 'Kilogramo (kg)' },
    { value: 'g', label: 'Gramo (g)' },
    { value: 'm', label: 'Metro (m)' }
  ];

  // Estado para Modal de Repuestos (Crear/Editar) y Lotes de Compra
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPartId, setEditingPartId] = useState(null);
  // Índice de la fila de "Piezas Usadas" del modal de mantenimiento que abrió el modal de Repuestos
  // para rellenar la ficha completa (precio, stock mínimo, compatibilidad...) — null si se abrió
  // directamente desde la pantalla de Repuestos, sin vincular con ninguna intervención.
  const [partLinkRowIndex, setPartLinkRowIndex] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(null);

  const [newPartForm, setNewPartForm] = useState({
    name: '',
    reference: '',
    unit: 'ud',
    compatibleVehicles: [],
    minStock: '1',
    lowStockAlertEnabled: true,
    initialQty: '1',
    initialPrice: '',
    initialSupplier: '',
    initialDate: '2026-07-25'
  });

  const [newBatchForm, setNewBatchForm] = useState({
    qty: '1',
    pricePerUnit: '',
    supplier: '',
    date: '2026-07-25'
  });

  const handleCreateOrUpdatePart = async (e) => {
    e.preventDefault();
    if (!newPartForm.name) return;

    const minStockNum = parseInt(newPartForm.minStock) || 0;

    if (editingPartId) {
      await firestoreUpdate('parts', editingPartId, {
        name: newPartForm.name,
        reference: newPartForm.reference || null,
        unit: newPartForm.unit || 'ud',
        compatibleVehicles: newPartForm.compatibleVehicles.length > 0 ? newPartForm.compatibleVehicles : ['Universal'],
        minStock: minStockNum,
        lowStockAlertEnabled: newPartForm.lowStockAlertEnabled !== false
      });
    } else {
      const initialQtyNum = parseFloat(newPartForm.initialQty) || 0;
      const initialPriceNum = parseFloat(newPartForm.initialPrice) || 0;

      const initialPurchase = initialQtyNum > 0 ? [{
        id: Date.now(),
        qty: initialQtyNum,
        pricePerUnit: initialPriceNum,
        // pricePerUnit se guarda como número puro (para poder sumarlo/compararlo), así que el
        // símbolo con el que se pagó se guarda aparte, por lote — así una compra antigua en otra
        // moneda no cambia de símbolo si más tarde se cambia la moneda por defecto en Ajustes.
        pricePerUnitCurrency: currencySymbol,
        supplier: newPartForm.initialSupplier || 'Taller / Tienda',
        date: newPartForm.initialDate || '2026-07-25'
      }] : [];

      const newPart = {
        name: newPartForm.name,
        reference: newPartForm.reference || null,
        unit: newPartForm.unit || 'ud',
        compatibleVehicles: newPartForm.compatibleVehicles.length > 0 ? newPartForm.compatibleVehicles : ['Universal'],
        minStock: minStockNum,
        lowStockAlertEnabled: newPartForm.lowStockAlertEnabled !== false,
        purchases: initialPurchase
      };

      const newPartId = await firestoreAdd('parts', newPart);
      trackEvent('part_added');

      // Si este repuesto se creó desde una fila de "Piezas Usadas" del modal de mantenimiento
      // (el usuario pulsó "Rellenar ficha completa"), vincula esa fila al repuesto recién creado
      // en vez de dejarlo como texto libre.
      if (partLinkRowIndex !== null) {
        setNewMaintenanceForm(prev => ({
          ...prev,
          partsUsed: prev.partsUsed.map((row, i) => i === partLinkRowIndex
            ? { ...row, selectedPartId: String(newPartId), manualName: '', partNumber: newPart.reference || row.partNumber }
            : row)
        }));
        setPartLinkRowIndex(null);
      }
    }

    setShowAddPartModal(false);
    setEditingPartId(null);
    setNewPartForm({
      name: '',
      reference: '',
      unit: 'ud',
      compatibleVehicles: [],
      minStock: '1',
      lowStockAlertEnabled: true,
      initialQty: '1',
      initialPrice: '',
      initialSupplier: '',
      initialDate: '2026-07-25'
    });
  };

  const handleAddPurchaseBatch = async (e) => {
    e.preventDefault();
    if (!showBatchModal) return;

    const qtyNum = parseFloat(newBatchForm.qty) || 1;
    const priceNum = parseFloat(newBatchForm.pricePerUnit) || 0;

    const newBatch = {
      id: Date.now(),
      qty: qtyNum,
      pricePerUnit: priceNum,
      pricePerUnitCurrency: currencySymbol,
      supplier: newBatchForm.supplier || 'Proveedor Local',
      date: newBatchForm.date || '2026-07-25'
    };

    const targetPart = parts.find(p => p.id === showBatchModal.id);
    if (targetPart) {
      const updatedPurchases = [newBatch, ...(targetPart.purchases || [])];
      await firestoreUpdate('parts', targetPart.id, { purchases: updatedPurchases });
    }

    setShowBatchModal(null);
    setNewBatchForm({ qty: '1', pricePerUnit: '', supplier: '', date: '2026-07-25' });
  };

  const handleEditPart = (p) => {
    setEditingPartId(p.id);
    setNewPartForm({
      name: p.name,
      reference: p.reference || '',
      unit: p.unit || 'ud',
      compatibleVehicles: p.compatibleVehicles || (p.vehicle ? [p.vehicle] : ['Universal']),
      minStock: String(p.minStock || 1),
      lowStockAlertEnabled: p.lowStockAlertEnabled !== false,
      initialQty: '0',
      initialPrice: '',
      initialSupplier: '',
      initialDate: '2026-07-25'
    });
    setShowAddPartModal(true);
  };

  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);
  const [receiptUploading, setReceiptUploading] = useState(false);

  // Formulario en blanco para "Nuevo Registro de Mantenimiento" — reutilizado al abrir el modal en
  // modo creación y al cerrarlo, para que no arrastre datos de una edición previa sin guardar.
  const blankMaintenanceForm = (vehicleName) => ({
    vehicle: vehicleName || vehicles[0]?.name || '',
    title: '',
    category: 'Motor & Transmisión',
    usageAtService: '',
    secondaryReading: '',
    partsUsed: [{ selectedPartId: '', manualName: '', partNumber: '', qty: '1' }],
    receipts: [],
    partsCost: '',
    laborCost: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Preventivo',
    notes: '',
    mechanic: ''
  });

  // Form State para Nuevo Mantenimiento Ampliado con Repuesto Consumido
  const [newMaintenanceForm, setNewMaintenanceForm] = useState(blankMaintenanceForm());

  // Sube una o varias fotos de ticket/factura a Storage (redimensionadas, sin recortar) y las añade
  // al formulario. Se suben en cuanto se seleccionan (no se espera a guardar el mantenimiento) para
  // poder mostrar la miniatura y el progreso de subida de inmediato.
  const handleAddReceiptPhotos = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0 || !effectiveUserId) return;
    setReceiptUploading(true);
    try {
      for (const file of files) {
        const blob = await optimizeReceiptImage(file);
        const path = `receipts/${effectiveUserId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob);
        const url = await getDownloadURL(fileRef);
        setNewMaintenanceForm(prev => ({ ...prev, receipts: [...(prev.receipts || []), { url, path }] }));
      }
    } catch (err) {
      console.error('Error subiendo foto de ticket/factura:', err);
      setNoticeModal({ title: 'Error', message: 'No se pudo subir la foto. Inténtalo de nuevo.', type: 'warning' });
    } finally {
      setReceiptUploading(false);
    }
  };

  // Quita una foto ya subida del formulario y la borra de Storage (evita archivos huérfanos)
  const handleRemoveReceiptPhoto = async (index) => {
    const receipt = newMaintenanceForm.receipts[index];
    setNewMaintenanceForm(prev => ({ ...prev, receipts: prev.receipts.filter((_, i) => i !== index) }));
    if (receipt?.path) {
      try {
        await deleteObject(storageRef(storage, receipt.path));
      } catch (err) {
        console.warn('No se pudo borrar la foto de Storage (puede que ya no exista):', err);
      }
    }
  };

  const handleCreateOrUpdateMaintenance = async (e) => {
    e.preventDefault();
    if (!newMaintenanceForm.title) return;

    const targetVehicle = newMaintenanceForm.vehicle || selectedVehicle?.name || vehicles[0]?.name;
    const currentVehObj = vehicles.find(v => v.name.toLowerCase() === targetVehicle.toLowerCase());

    // Procesa cada fila de "piezas usadas": si venía del inventario, descuenta stock FIFO;
    // si era un nombre escrito a mano (sin repuesto existente), crea la ficha en Repuestos con
    // stock 0 para que quede disponible la próxima vez (ver [[project_vehicle_alerts_and_push]]-style
    // decisión: no forzamos al usuario a dar de alta el repuesto antes de poder registrar su uso).
    const partsUsedRows = (newMaintenanceForm.partsUsed || []).filter(row => row.selectedPartId || (row.manualName || '').trim());
    const builtPartsUsed = [];
    for (const row of partsUsedRows) {
      const qty = parseFloat(row.qty) || 1;
      if (row.selectedPartId) {
        const targetPart = parts.find(p => String(p.id) === String(row.selectedPartId));
        if (!targetPart) continue;
        if (!editingMaintenanceId && targetPart.purchases && targetPart.purchases.length > 0) {
          let qtyToDeduct = qty;
          const updatedPurchases = targetPart.purchases.map(batch => {
            if (qtyToDeduct <= 0) return batch;
            if (batch.qty >= qtyToDeduct) {
              const remaining = Math.max(0, parseFloat((batch.qty - qtyToDeduct).toFixed(3)));
              qtyToDeduct = 0;
              return { ...batch, qty: remaining };
            } else {
              qtyToDeduct = parseFloat((qtyToDeduct - batch.qty).toFixed(3));
              return { ...batch, qty: 0 };
            }
          }).filter(b => b.qty > 0);
          await firestoreUpdate('parts', targetPart.id, { purchases: updatedPurchases });
        }
        builtPartsUsed.push({ id: targetPart.id, name: targetPart.name, reference: row.partNumber || targetPart.reference || null, qty: String(qty) });
      } else {
        const manualName = row.manualName.trim();
        const newPartId = await firestoreAdd('parts', {
          name: manualName,
          reference: row.partNumber || null,
          unit: 'ud',
          compatibleVehicles: [targetVehicle],
          purchases: []
        });
        builtPartsUsed.push({ id: newPartId, name: manualName, reference: row.partNumber || null, qty: String(qty) });
      }
    }

    const totalCostNum = (parseFloat(newMaintenanceForm.partsCost) || 0) + (parseFloat(newMaintenanceForm.laborCost) || 0);
    const finalCostStr = totalCostNum > 0 ? `${totalCostNum.toFixed(2)} ${currencySymbol}` : `0.00 ${currencySymbol}`;

    const maintenanceData = {
      vehicle: targetVehicle,
      title: newMaintenanceForm.title,
      category: newMaintenanceForm.category,
      usageAtService: newMaintenanceForm.usageAtService ? `${newMaintenanceForm.usageAtService} ${currentVehObj?.unit || 'km'}` : currentVehObj?.usage || '',
      // Lectura secundaria opcional: el vehículo lleva un medidor principal (km u horas), pero
      // algunos mantenimientos también necesitan anotar el otro (p.ej. una moto de enduro que
      // controla horas de motor, pero donde también interesa dejar constancia del kilometraje).
      // No es un contador que lleve la app ni genera alertas, solo queda anotado en el registro.
      secondaryReading: newMaintenanceForm.secondaryReading
        ? `${newMaintenanceForm.secondaryReading} ${currentVehObj?.unit === 'hrs' ? 'km' : 'hrs'}`
        : '',
      partsUsed: builtPartsUsed,
      receipts: newMaintenanceForm.receipts || [],
      date: newMaintenanceForm.date || new Date().toISOString().split('T')[0],
      cost: finalCostStr,
      partsCost: newMaintenanceForm.partsCost ? `${parseFloat(newMaintenanceForm.partsCost).toFixed(2)} ${currencySymbol}` : `0.00 ${currencySymbol}`,
      laborCost: newMaintenanceForm.laborCost ? `${parseFloat(newMaintenanceForm.laborCost).toFixed(2)} ${currencySymbol}` : `0.00 ${currencySymbol}`,
      type: newMaintenanceForm.type,
      notes: newMaintenanceForm.notes || '',
      mechanic: newMaintenanceForm.mechanic || 'Taller / Propietario',
      badgeColor: newMaintenanceForm.type === 'Preventivo' 
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
        : newMaintenanceForm.type === 'Mejora / Modificación' 
        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        : newMaintenanceForm.type === 'Repuesto' 
        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    };

    if (editingMaintenanceId) {
      await firestoreUpdate('maintenances', editingMaintenanceId, maintenanceData);
    } else {
      await firestoreAdd('maintenances', maintenanceData);
      trackEvent('maintenance_added', { category: maintenanceData.category });
    }

    // Si se especificó una nueva lectura de uso, actualizar el vehículo en Firestore
    if (newMaintenanceForm.usageAtService && currentVehObj) {
      const newNum = parseFloat(newMaintenanceForm.usageAtService);
      if (!isNaN(newNum)) {
        await firestoreUpdate('vehicles', currentVehObj.id, {
          usage: `${newNum} ${currentVehObj.unit}`,
          usageNum: newNum
        });

        if (selectedVehicle && selectedVehicle.id === currentVehObj.id) {
          setSelectedVehicle(prev => ({
            ...prev,
            usage: `${newNum} ${prev.unit}`,
            usageNum: newNum
          }));
        }
      }
    }

    setShowAddMaintenanceModal(false);
    setEditingMaintenanceId(null);
    setNewMaintenanceForm(blankMaintenanceForm(selectedVehicle?.name));
  };

  // --- FUNCIONES DE EXPORTACIÓN PDF / CSV / BACKUP JSON & NOTIFICACIONES ---
  const handleExportPDFCertificate = (targetVehicleObj = null) => {
    trackEvent('export_pdf');
    const veh = targetVehicleObj || selectedVehicle;
    const vehName = veh ? veh.name : 'Flota Completa';
    const listToExport = veh 
      ? maintenances.filter(m => (m.vehicle || '').toLowerCase() === veh.name.toLowerCase())
      : maintenances;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNoticeModal({
        title: 'Permiso de Ventanas Emergentes',
        message: 'Por favor, permite las ventanas emergentes en tu navegador para generar e imprimir el certificado PDF.',
        type: 'warning'
      });
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificado de Mantenimiento - ${vehName}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; margin: 0; padding: 0; color: #1e293b; line-height: 1.3; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 8px; margin-bottom: 12px; }
          .logo { font-size: 15pt; font-weight: bold; color: #ea580c; }
          .veh-info { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
          .veh-info h2 { font-size: 12pt; margin: 0 0 3px 0; color: #0f172a; }
          .veh-info p { margin: 0; font-size: 9pt; color: #475569; white-space: nowrap; }
          h3 { font-size: 10.5pt; margin: 0 0 8px 0; color: #0f172a; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9pt; table-layout: auto; }
          th { background: #1e293b; color: white; text-align: left; padding: 7px 10px; font-size: 9pt; font-weight: bold; white-space: nowrap; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
          .col-date { white-space: nowrap; width: 95px; }
          .col-veh { white-space: nowrap; width: 160px; }
          .col-cost { white-space: nowrap; text-align: right; width: 100px; }
          .col-type { white-space: nowrap; width: 110px; }
          .col-mechanic { white-space: nowrap; width: 160px; }
          th.col-cost { text-align: right; }
          .footer { margin-top: 25px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MyGarageOps — Libro Digital de Servicio</div>
        </div>
        <div class="veh-info">
          <div>
            <h2>${veh ? veh.name : 'Informe de Flota Completa'}</h2>
            ${veh ? `<p><strong>Categoría:</strong> ${veh.category} &nbsp;|&nbsp; <strong>Lectura Actual:</strong> ${veh.usage}${veh.secondaryUsageNum != null ? ` (${veh.secondaryUsageNum} ${veh.unit === 'hrs' ? 'km' : 'hrs'})` : ''}</p>` : ''}
          </div>
          <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <h3>Historial de Intervenciones (${listToExport.length})</h3>
        <table>
          <thead>
            <tr>
              <th class="col-date">Fecha</th>
              <th class="col-veh">Vehículo</th>
              <th>Intervención / Servicio</th>
              <th class="col-type">Tipo</th>
              <th>Taller / Mecánico</th>
              <th class="col-cost">Coste Total</th>
            </tr>
          </thead>
          <tbody>
            ${listToExport.map(m => `
              <tr>
                <td class="col-date">${m.date || '-'}</td>
                <td class="col-veh"><strong>${m.vehicle}</strong></td>
                <td>${m.title}</td>
                <td class="col-type">${m.type}</td>
                <td>${m.mechanic || 'Particular / Taller'}</td>
                <td class="col-cost"><strong>${m.cost}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          Generado automáticamente por MyGarageOps • Mobile First Vehicle Maintenance System
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Genera un PDF de certificado con el detalle completo de UNA sola intervención (no una tabla),
  // para cuando el usuario quiere justificar/entregar un servicio concreto (venta, garantía, etc.)
  const handleExportMaintenanceDetailPDF = (item) => {
    const veh = vehicles.find(v => v.name.toLowerCase() === (item.vehicle || '').toLowerCase());

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNoticeModal({
        title: 'Permiso de Ventanas Emergentes',
        message: 'Por favor, permite las ventanas emergentes en tu navegador para generar e imprimir el certificado PDF.',
        type: 'warning'
      });
      return;
    }

    const row = (label, value) => value ? `
      <tr>
        <td class="label">${label}</td>
        <td class="value">${value}</td>
      </tr>
    ` : '';

    // Compatibilidad con registros antiguos de un solo repuesto (usedPartId/usedPartName/usedPartQty)
    const partsUsedList = item.partsUsed && item.partsUsed.length > 0
      ? item.partsUsed
      : item.usedPartName
        ? [{ name: item.usedPartName, reference: item.partNumber || null, qty: item.usedPartQty || 1 }]
        : [];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificado de Intervención - ${item.title}</title>
        <style>
          @page { size: A4 portrait; margin: 16mm; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; padding: 0; color: #1e293b; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 10px; margin-bottom: 18px; }
          .logo { font-size: 16pt; font-weight: bold; color: #ea580c; }
          .title-block { margin-bottom: 18px; }
          .title-block h2 { font-size: 15pt; margin: 0 0 4px 0; color: #0f172a; }
          .title-block p { margin: 0; font-size: 10pt; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
          td.label { width: 180px; font-weight: bold; color: #475569; background: #f8fafc; }
          td.value { color: #0f172a; }
          .cost-highlight { font-size: 13pt; font-weight: bold; color: #ea580c; }
          .notes { margin-top: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
          .notes h3 { font-size: 10pt; margin: 0 0 6px 0; color: #0f172a; }
          .notes p { margin: 0; font-size: 9.5pt; color: #475569; white-space: pre-wrap; }
          .parts-used { margin-top: 18px; }
          .parts-used h3 { font-size: 10pt; margin: 0 0 6px 0; color: #0f172a; }
          .parts-used table { margin-top: 0; }
          .parts-used th { background: #1e293b; color: white; text-align: left; padding: 7px 10px; font-size: 9pt; }
          .parts-used td { padding: 7px 10px; }
          .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MyGarageOps — Certificado de Intervención</div>
        </div>
        <div class="title-block">
          <h2>${item.title}</h2>
          <p>${item.vehicle}${veh ? ` — ${veh.category}` : ''}</p>
        </div>
        <table>
          ${row('Fecha', item.date)}
          ${row('Tipo de Intervención', item.type)}
          ${row('Categoría', item.category)}
          ${row('Taller / Mecánico', item.mechanic)}
          ${row('Lectura del Vehículo', item.usageAtService)}
          ${row('Lectura Adicional', item.secondaryReading)}
          ${row('Coste de Repuestos', item.partsCost)}
          ${row('Coste de Mano de Obra', item.laborCost)}
          <tr>
            <td class="label">Coste Total</td>
            <td class="value cost-highlight">${item.cost}</td>
          </tr>
        </table>
        ${partsUsedList.length > 0 ? `
          <div class="parts-used">
            <h3>Piezas Utilizadas (${partsUsedList.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Pieza</th>
                  <th>Número de Pieza / Referencia</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                ${partsUsedList.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.reference || '—'}</td>
                    <td>${p.qty || 1}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        ${(item.receipts && item.receipts.length > 0) ? `
          <div class="parts-used">
            <h3>Fotos de Ticket / Factura (${item.receipts.length})</h3>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;">
              ${item.receipts.map(r => `
                <img src="${r.url}" style="width:140px; height:140px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;" />
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${item.notes ? `
          <div class="notes">
            <h3>Notas</h3>
            <p>${item.notes}</p>
          </div>
        ` : ''}
        <div class="footer">
          Generado automáticamente por MyGarageOps • Mobile First Vehicle Maintenance System
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportJSON = () => {
    trackEvent('export_json');
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      vehicles,
      maintenances,
      parts
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `garageops_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    trackEvent('export_csv');
    const headers = ["ID", "Fecha", "Vehiculo", "Titulo", "Tipo", "ManoDeObra", "PiezasCoste", "CosteTotal", "Notas"];
    const rows = maintenances.map(m => [
      m.id,
      `"${m.date || ''}"`,
      `"${m.vehicle || ''}"`,
      `"${(m.title || '').replace(/"/g, '""')}"`,
      `"${m.type || ''}"`,
      `"${m.laborCost || `0.00 ${currencySymbol}`}"`,
      `"${m.partsCost || `0.00 ${currencySymbol}`}"`,
      `"${m.cost || `0.00 ${currencySymbol}`}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `garageops_historial_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.vehicles && Array.isArray(parsed.vehicles)) setVehicles(parsed.vehicles);
          if (parsed.maintenances && Array.isArray(parsed.maintenances)) setMaintenances(parsed.maintenances);
          if (parsed.parts && Array.isArray(parsed.parts)) setParts(parsed.parts);
          alert('¡Copia de seguridad restaurada con éxito!');
          setNoticeModal({
            title: 'Copia Restaurada',
            message: '¡La copia de seguridad ha sido restaurada con éxito en tu garaje!',
            type: 'success'
          });
        } catch (err) {
          setNoticeModal({
            title: 'Error de Importación',
            message: 'Error al importar archivo. Asegúrate de seleccionar un JSON válido generado por MyGarageOps.',
            type: 'error'
          });
        }
      };
    }
  };

  const handleEditMaintenance = (item) => {
    setEditingMaintenanceId(item.id);
    // Compatibilidad con registros antiguos que solo tenían un repuesto (usedPartId/usedPartName/usedPartQty)
    const partsUsedRows = item.partsUsed && item.partsUsed.length > 0
      ? item.partsUsed.map(p => ({ selectedPartId: p.id ? String(p.id) : '', manualName: p.id ? '' : (p.name || ''), partNumber: p.reference || '', qty: String(p.qty || '1') }))
      : item.usedPartId
        ? [{ selectedPartId: String(item.usedPartId), manualName: '', partNumber: item.partNumber || '', qty: String(item.usedPartQty || '1') }]
        : [{ selectedPartId: '', manualName: '', partNumber: '', qty: '1' }];
    setNewMaintenanceForm({
      vehicle: item.vehicle,
      title: item.title,
      category: item.category || 'Motor & Transmisión',
      usageAtService: item.usageAtService ? item.usageAtService.replace(/[^0-9.]/g, '') : '',
      secondaryReading: item.secondaryReading ? item.secondaryReading.replace(/[^0-9.]/g, '') : '',
      partsUsed: partsUsedRows,
      receipts: item.receipts || [],
      partsCost: item.partsCost ? item.partsCost.replace(/[^0-9.]/g, '') : '',
      laborCost: item.laborCost ? item.laborCost.replace(/[^0-9.]/g, '') : '',
      date: item.date || '2026-07-25',
      type: item.type || 'Preventivo',
      notes: item.notes || '',
      mechanic: item.mechanic || ''
    });
    setShowAddMaintenanceModal(true);
  };

  const handleDeleteMaintenance = (id) => {
    requestDeleteMaintenance(id);
  };

  const handleDeletePart = (partId) => {
    requestDeletePart(partId);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-zinc-400">Cargando MyGarageOps...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4 selection:bg-orange-500 selection:text-white">
        <div className="w-full max-w-md space-y-6">
          {/* Logo & Marca */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 overflow-hidden border-2 border-orange-500/40 flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/20">
              <img src="/logo.png" alt="MyGarageOps Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">MyGarageOps</h1>
              <p className="text-xs text-zinc-400 mt-1">
                {language === 'es' ? 'Gestión inteligente de vehículos, repuestos y mantenimientos' : language === 'en' ? 'Smart management of vehicles, parts and maintenance' : language === 'it' ? 'Gestione intelligente di veicoli, ricambi e manutenzioni' : language === 'fr' ? 'Gestion intelligente des véhicules, pièces et entretiens' : language === 'de' ? 'Intelligente Verwaltung von Fahrzeugen, Ersatzteilen und Wartungen' : 'Gestão inteligente de veículos, peças e manutenções'}
              </p>
            </div>
          </div>

          {/* Tarjeta Formulario Login / Registro */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-2xl space-y-5">
            {isAdminDirectURL && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Acceso Backoffice Admin
                </span>
                <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded text-amber-300 font-bold uppercase">Admin Only</span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <h2 className="text-lg font-bold text-white">
                {isRegisterMode ? (language === 'es' ? 'Crear Nueva Cuenta' : language === 'en' ? 'Create Account' : language === 'it' ? 'Crea Nuovo Account' : language === 'fr' ? 'Créer un Nouveau Compte' : language === 'de' ? 'Neues Konto Erstellen' : 'Criar Nova Conta') : (language === 'es' ? 'Iniciar Sesión' : language === 'en' ? 'Sign In' : language === 'it' ? 'Accedi' : language === 'fr' ? 'Se Connecter' : language === 'de' ? 'Anmelden' : 'Iniciar Sessão')}
              </h2>
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[10px]">
                {['es', 'en', 'it', 'fr', 'de', 'pt'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-0.5 rounded-lg font-bold font-mono transition-all ${
                      language === lang ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">
                  {language === 'es' ? 'Correo Electrónico' : language === 'en' ? 'Email Address' : language === 'it' ? 'Indirizzo Email' : language === 'fr' ? 'Adresse E-mail' : language === 'de' ? 'E-Mail-Adresse' : 'Endereço de Email'}
                </label>
                <input 
                  type="email"
                  placeholder="ejemplo@mecanica.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">
                  {language === 'es' ? 'Contraseña' : language === 'en' ? 'Password' : language === 'it' ? 'Password' : language === 'fr' ? 'Mot de Passe' : language === 'de' ? 'Passwort' : 'Palavra-passe'}
                </label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 text-xs select-none">
                  <input 
                    type="checkbox"
                    checked={loginForm.rememberMe}
                    onChange={(e) => setLoginForm({ ...loginForm, rememberMe: e.target.checked })}
                    className="accent-orange-500 w-4 h-4 rounded"
                  />
                  <span>{language === 'es' ? 'Recordar sesión' : language === 'en' ? 'Remember me' : language === 'it' ? 'Ricordami' : language === 'fr' ? 'Se souvenir de moi' : language === 'de' ? 'Angemeldet bleiben' : 'Lembrar-me'}</span>
                </label>

                <button 
                  type="button" 
                  onClick={() => alert(language === 'es' ? 'Se ha enviado un enlace de recuperación a tu correo.' : language === 'en' ? 'Password reset link sent to your email.' : language === 'it' ? 'Ti abbiamo inviato un link di recupero via email.' : language === 'fr' ? 'Un lien de récupération a été envoyé à votre e-mail.' : language === 'de' ? 'Ein Link zum Zurücksetzen wurde an deine E-Mail gesendet.' : 'Foi enviado um link de recuperação para o teu email.')}
                  className="text-xs text-orange-400 hover:underline font-medium"
                >
                  {language === 'es' ? '¿Olvidaste tu clave?' : language === 'en' ? 'Forgot password?' : language === 'it' ? 'Password dimenticata?' : language === 'fr' ? 'Mot de passe oublié ?' : language === 'de' ? 'Passwort vergessen?' : 'Esqueceste-te da palavra-passe?'}
                </button>
              </div>

              {isRegisterMode && (
                <p className="text-[11px] text-zinc-500 -mt-1">
                  {language === 'es'
                    ? <>Al registrarte aceptas los <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Términos y Condiciones</a> y la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Política de Privacidad</a>.</>
                    : language === 'en'
                    ? <>By registering you accept the <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Terms and Conditions</a> and <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Privacy Policy</a>.</>
                    : language === 'it'
                    ? <>Registrandoti accetti i <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Termini e Condizioni</a> e l'<a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Informativa sulla Privacy</a>.</>
                    : language === 'fr'
                    ? <>En vous inscrivant, vous acceptez les <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Conditions Générales</a> et la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Politique de Confidentialité</a>.</>
                    : language === 'de'
                    ? <>Mit der Registrierung akzeptierst du die <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Allgemeinen Geschäftsbedingungen</a> und die <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Datenschutzerklärung</a>.</>
                    : <>Ao registares-te aceitas os <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Termos e Condições</a> e a <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Política de Privacidade</a>.</>}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95 mt-2"
              >
                {isRegisterMode
                  ? (language === 'es' ? 'Registrarse en MyGarageOps' : language === 'en' ? 'Register in MyGarageOps' : language === 'it' ? 'Registrati su MyGarageOps' : language === 'fr' ? "S'inscrire sur MyGarageOps" : language === 'de' ? 'Bei MyGarageOps registrieren' : 'Registar-me no MyGarageOps')
                  : (language === 'es' ? 'Entrar a Mi Garaje' : language === 'en' ? 'Access My Garage' : language === 'it' ? 'Accedi al Mio Garage' : language === 'fr' ? 'Accéder à Mon Garage' : language === 'de' ? 'Zu Meiner Garage' : 'Aceder à Minha Garagem')}
              </button>
            </form>

            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-semibold uppercase">
              <div className="h-px flex-1 bg-zinc-800" />
              <span>{language === 'es' ? 'o' : language === 'en' ? 'or' : language === 'it' ? 'o' : language === 'fr' ? 'ou' : language === 'de' ? 'oder' : 'ou'}</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              {language === 'es' ? 'Continuar con Google' : language === 'en' ? 'Continue with Google' : language === 'it' ? 'Continua con Google' : language === 'fr' ? 'Continuer avec Google' : language === 'de' ? 'Mit Google fortfahren' : 'Continuar com o Google'}
            </button>

            <button
              type="button"
              onClick={handleAppleLogin}
              className="w-full py-3 rounded-2xl bg-black hover:bg-zinc-900 border border-zinc-800 text-white font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              {language === 'es' ? 'Continuar con Apple' : language === 'en' ? 'Continue with Apple' : language === 'it' ? 'Continua con Apple' : language === 'fr' ? 'Continuer avec Apple' : language === 'de' ? 'Mit Apple fortfahren' : 'Continuar com a Apple'}
            </button>

            {/* Google/Apple pueden crear una cuenta nueva en el primer inicio de sesión, así que el aviso
                legal debe verse aquí también, no solo en el formulario de registro con email. */}
            <p className="text-[11px] text-zinc-500 text-center -mt-1">
              {language === 'es'
                ? <>Si es tu primer acceso, aceptas los <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Términos</a> y la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Privacidad</a>.</>
                : language === 'en'
                ? <>If this is your first sign-in, you accept the <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Terms</a> and <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Privacy Policy</a>.</>
                : language === 'it'
                ? <>Se è il tuo primo accesso, accetti i <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Termini</a> e la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Privacy</a>.</>
                : language === 'fr'
                ? <>S'il s'agit de votre première connexion, vous acceptez les <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Conditions</a> et la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Confidentialité</a>.</>
                : language === 'de'
                ? <>Bei deiner ersten Anmeldung akzeptierst du die <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">AGB</a> und den <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Datenschutz</a>.</>
                : <>Se for o teu primeiro acesso, aceitas os <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Termos</a> e a <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Privacidade</a>.</>}
            </p>

            {/* Alternar Registro / Login */}
            <div className="pt-2 border-t border-zinc-800/80 text-center">
              <p className="text-xs text-zinc-400">
                {isRegisterMode ? (
                  <>
                    {language === 'es' ? '¿Ya tienes una cuenta?' : language === 'en' ? 'Already have an account?' : language === 'it' ? 'Hai già un account?' : language === 'fr' ? 'Vous avez déjà un compte ?' : language === 'de' ? 'Du hast bereits ein Konto?' : 'Já tens uma conta?'} {' '}
                    <button onClick={() => setIsRegisterMode(false)} className="text-orange-400 font-bold hover:underline">
                      {language === 'es' ? 'Inicia sesión' : language === 'en' ? 'Sign in' : language === 'it' ? 'Accedi' : language === 'fr' ? 'Connecte-toi' : language === 'de' ? 'Anmelden' : 'Iniciar sessão'}
                    </button>
                  </>
                ) : (
                  <>
                    {language === 'es' ? '¿No tienes cuenta?' : language === 'en' ? "Don't have an account?" : language === 'it' ? 'Non hai un account?' : language === 'fr' ? "Vous n'avez pas de compte ?" : language === 'de' ? 'Du hast noch kein Konto?' : 'Ainda não tens conta?'} {' '}
                    <button onClick={() => setIsRegisterMode(true)} className="text-orange-400 font-bold hover:underline">
                      {language === 'es' ? 'Crea una gratis' : language === 'en' ? 'Create a free one' : language === 'it' ? 'Creane uno gratis' : language === 'fr' ? 'Crées-en un gratuitement' : language === 'de' ? 'Kostenlos erstellen' : 'Cria uma grátis'}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen font-sans selection:bg-orange-500 selection:text-white pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0 antialiased transition-colors duration-300 ${inspectingUser ? 'bg-amber-950 text-amber-50 ring-4 ring-inset ring-amber-500/60' : 'bg-zinc-950 text-zinc-100'}`}
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >

      {/* SIDEBAR DESKTOP (> 768px) */}
      <aside
        className={`hidden md:flex flex-col w-64 border-r p-5 justify-between sticky top-0 h-screen shrink-0 overflow-y-auto transition-colors duration-300 ${inspectingUser ? 'bg-amber-950 border-amber-800/60' : 'bg-zinc-950 border-zinc-800/80'}`}
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          {/* Header & Logo */}
          <div className="flex items-center gap-3 px-2 py-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 overflow-hidden border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <img src="/logo.png" alt="MyGarageOps Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">MyGarageOps</h1>
              <span className="text-[10px] font-mono tracking-wider text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                {language === 'es' ? 'Gestión de Garaje' : language === 'en' ? 'Garage Management' : language === 'it' ? 'Gestione Garage' : language === 'fr' ? 'Gestion du Garage' : language === 'de' ? 'Garagenverwaltung' : 'Gestão de Garagem'}
              </span>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="space-y-1.5">
            <NavItem icon={Home} label={t('dashboard')} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedVehicle(null); }} />
            <NavItem icon={Bike} label={t('garage')} badge={vehicles.length} active={activeTab === 'garage'} onClick={() => { setActiveTab('garage'); setSelectedVehicle(null); }} />
            <NavItem icon={Wrench} label={t('parts')} badge={parts.length} active={activeTab === 'parts'} onClick={() => { setActiveTab('parts'); setSelectedVehicle(null); }} />
            <NavItem icon={History} label={t('history')} active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setSelectedVehicle(null); }} />
            {isSuperAdmin && (
              <NavItem 
                icon={Shield} 
                label="Backoffice Admin" 
                badge="ADMIN" 
                active={activeTab === 'admin'} 
                onClick={() => { setActiveTab('admin'); setSelectedVehicle(null); }} 
              />
            )}
          </nav>
        </div>

        {/* Perfil & Plan Pro */}
        <div className="pt-4 border-t border-zinc-900">
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">{t('activePlan')}</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xs font-bold text-zinc-200">
              {currentPlanDef?.name || currentPlan}
            </p>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full transition-all"
                style={{ width: `${Math.min(100, (vehicles.length / (maxVehiclesAllowed === Infinity ? 100 : maxVehiclesAllowed)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              {vehicles.length} / {maxVehiclesLabel} {t('vehicles').toLowerCase()}
            </p>
          </div>

          <button 
            onClick={() => { setActiveTab('profile'); setSelectedVehicle(null); }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-xl hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-orange-400" />
              <span className="font-medium">{t('settings')}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8">
        
        {/* BANNER MODO INSPECCIÓN SOPORTE ADMIN */}
        {inspectingUser && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl shrink-0">
                👁️
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                  Modo Soporte Técnico / Inspección Activo
                </span>
                <p className="text-xs font-bold text-white mt-0.5">
                  Estás inspeccionando el garaje de: <span className="font-mono text-orange-400 underline">{inspectingUser.email}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setInspectingUser(null)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs shadow transition-all active:scale-95 whitespace-nowrap"
            >
              ✕ Salir de Modo Inspección
            </button>
          </div>
        )}
        
        {/* Header Móvil */}
        <header
          className="flex md:hidden items-center justify-between pb-4 mb-5 border-b border-zinc-900"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 overflow-hidden border border-orange-500/30 flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <img src="/logo.png" alt="MyGarageOps Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">MyGarageOps</span>
              <span className="text-[10px] text-zinc-500 font-medium">Panel Móvil</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }}
              aria-label={t('onboardingHelpAria')}
              title={t('onboardingHelpAria')}
              className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-orange-400 active:scale-95 transition-transform flex items-center justify-center shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setActiveTab('profile'); setSelectedVehicle(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-orange-400 active:scale-95 transition-transform"
            >
              <User className="w-3.5 h-3.5" />
              <span>Perfil</span>
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && !selectedVehicle && (
          <DashboardView
            language={language} t={t} currencySymbol={currencySymbol}
            vehicles={vehicles} parts={parts} maintenances={maintenances}
            setEditingMaintenanceId={setEditingMaintenanceId} blankMaintenanceForm={blankMaintenanceForm} setNewMaintenanceForm={setNewMaintenanceForm} setShowAddMaintenanceModal={setShowAddMaintenanceModal}
            setActiveTab={setActiveTab} setSelectedVehicle={setSelectedVehicle}
            setShowKmModal={setShowKmModal} setNewKmValue={setNewKmValue} setNewSecondaryKmValue={setNewSecondaryKmValue}
            openAddVehicleModal={openAddVehicleModal}
          />
        )}

        {activeTab === 'garage' && selectedVehicle && (
          <VehicleDetailView
            t={t} language={language} currencySymbol={currencySymbol}
            selectedVehicle={selectedVehicle} setSelectedVehicle={setSelectedVehicle}
            handleExportPDFCertificate={handleExportPDFCertificate} openEditVehicleModal={openEditVehicleModal} requestDeleteVehicle={requestDeleteVehicle}
            setPhotoPreviewModal={setPhotoPreviewModal} setVehicles={setVehicles}
            maintenances={maintenances}
            setShowAlertModal={setShowAlertModal} setNewAlertForm={setNewAlertForm}
            setShowKmModal={setShowKmModal} setNewKmValue={setNewKmValue} setNewSecondaryKmValue={setNewSecondaryKmValue}
            setEditingMaintenanceId={setEditingMaintenanceId} blankMaintenanceForm={blankMaintenanceForm} setNewMaintenanceForm={setNewMaintenanceForm} setShowAddMaintenanceModal={setShowAddMaintenanceModal}
            handleDeleteVehicleAlert={handleDeleteVehicleAlert}
            handleEditMaintenance={handleEditMaintenance}
          />
        )}

        {activeTab === 'garage' && !selectedVehicle && (
          <GarageList
            t={t} language={language} currencySymbol={currencySymbol}
            vehicles={vehicles} maintenances={maintenances}
            setEditingVehicleId={setEditingVehicleId} setNewVehicleForm={setNewVehicleForm} setShowAddVehicleModal={setShowAddVehicleModal}
            setSelectedVehicle={setSelectedVehicle}
            setShowKmModal={setShowKmModal} setNewKmValue={setNewKmValue} setNewSecondaryKmValue={setNewSecondaryKmValue}
            requestDeleteVehicle={requestDeleteVehicle}
          />
        )}

        {activeTab === 'parts' && (
          <PartsView
            t={t} language={language} currencySymbol={currencySymbol}
            parts={parts}
            setEditingPartId={setEditingPartId} setNewPartForm={setNewPartForm} setShowAddPartModal={setShowAddPartModal}
            setShowBatchModal={setShowBatchModal} setNewBatchForm={setNewBatchForm}
            handleEditPart={handleEditPart}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            t={t} language={language}
            handleExportPDFCertificate={handleExportPDFCertificate} handleExportCSV={handleExportCSV}
            handleExportMaintenanceDetailPDF={handleExportMaintenanceDetailPDF}
            maintenances={maintenances} handleEditMaintenance={handleEditMaintenance}
            setPhotoPreviewModal={setPhotoPreviewModal}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileSettings
            language={language} setLanguage={setLanguage} t={t}
            currency={currency} setCurrency={setCurrency}
            userEmail={userEmail} handleLogout={handleLogout}
            pushPermissionStatus={pushPermissionStatus} handleEnablePushNotifications={handleEnablePushNotifications} pushRequestInFlight={pushRequestInFlight}
            handleSendTestPush={handleSendTestPush} testPushInFlight={testPushInFlight}
            currentPlanDef={currentPlanDef} currentPlan={currentPlan}
            nextRenewalDate={nextRenewalDate} activeBillingCycle={activeBillingCycle}
            userProfile={userProfile} handleOpenBillingPortal={handleOpenBillingPortal} checkoutLoading={checkoutLoading}
            pendingPlanChange={pendingPlanChange} handleCancelPendingPlanChange={handleCancelPendingPlanChange}
            vehicles={vehicles} maxVehiclesAllowed={maxVehiclesAllowed} maxVehiclesLabel={maxVehiclesLabel}
            billingCycle={billingCycle} setBillingCycle={setBillingCycle}
            plans={plans} plansById={plansById} handlePlanSelection={handlePlanSelection}
            myTransactions={myTransactions}
            handleExportJSON={handleExportJSON} handleExportCSV={handleExportCSV} handleImportJSON={handleImportJSON}
          />
        )}

        {activeTab === 'admin' && isSuperAdmin && (
          <AdminBackoffice
            allUsersList={allUsersList}
            setAllUsersList={setAllUsersList}
            vehicleCountsByUser={vehicleCountsByUser}
            plans={plans}
            plansById={plansById}
            transactions={transactions}
            defaultPlanId={defaultPlanId}
            language={language}
            t={t}
            setNoticeModal={setNoticeModal}
            setConfirmModal={setConfirmModal}
            setInspectingUser={setInspectingUser}
            setActiveTab={setActiveTab}
          />
        )}

      </main>

      {/* NAVEGACIÓN INFERIOR PWA MÓVIL (< 768px) */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 h-16 backdrop-blur-xl border-t flex items-center justify-around px-2 z-40 transition-colors duration-300 ${inspectingUser ? 'bg-amber-950/90 border-amber-800/60' : 'bg-zinc-950/90 border-zinc-800/80'}`}
        style={{
          height: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
        }}
      >
        <MobileNavItem icon={Home} label={t('dashboard')} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={Bike} label={t('garage')} active={activeTab === 'garage'} onClick={() => { setActiveTab('garage'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={Wrench} label={t('parts')} active={activeTab === 'parts'} onClick={() => { setActiveTab('parts'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={History} label={t('history')} active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={User} label={t('profileTitle').split('&')[0].trim()} active={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setSelectedVehicle(null); }} />
      </nav>

      {/* MODAL BOTTOM SHEET: NUEVA / EDITAR INTERVENCIÓN COMPLETA */}
      {showAddMaintenanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">
                  {editingMaintenanceId ? 'Modificar Registro de Mantenimiento' : 'Nuevo Registro de Mantenimiento'}
                </h3>
                <p className="text-xs text-zinc-400">Detalla la intervención, costes de recambios y observaciones.</p>
              </div>
              <button
                onClick={() => {
                  setShowAddMaintenanceModal(false);
                  setEditingMaintenanceId(null);
                  setNewMaintenanceForm(blankMaintenanceForm());
                }} 
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateOrUpdateMaintenance} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Vehículo / Máquina</label>
                  <select 
                    value={newMaintenanceForm.vehicle}
                    onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, vehicle: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                  >
                    {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Categoría</label>
                  <select 
                    value={newMaintenanceForm.category}
                    onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, category: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="Motor & Transmisión">Motor & Transmisión</option>
                    <option value="Frenos & Embrague">Frenos & Embrague</option>
                    <option value="Chasis & Suspensión">Chasis & Suspensión</option>
                    <option value="Filtros & Admisión">Filtros & Admisión</option>
                    <option value="Ruedas & Neumáticos">Ruedas & Neumáticos</option>
                    <option value="Sistema Eléctrico">Sistema Eléctrico</option>
                    <option value="Accesorios & Mejoras">Accesorios & Mejoras (Upgrades)</option>
                    <option value="Revisión General / ITV">Revisión General / ITV</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Título de la Reparación / Intervención</label>
                <input 
                  type="text" 
                  placeholder="Ej: Cambio de bomba de embrague Brembo 9mm" 
                  value={newMaintenanceForm.title}
                  onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Lectura (Km/Hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ej: 48.5"
                    value={newMaintenanceForm.usageAtService}
                    onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, usageAtService: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                {(() => {
                  const formVehObj = vehicles.find(v => v.name === newMaintenanceForm.vehicle);
                  const secondaryUnit = formVehObj?.unit === 'hrs' ? 'km' : 'hrs';
                  return (
                    <div>
                      <label className="block text-zinc-400 font-medium mb-1">
                        {secondaryUnit === 'km' ? 'Km' : 'Horas'} (opcional)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder={secondaryUnit === 'km' ? 'Ej: 12500' : 'Ej: 48.5'}
                        value={newMaintenanceForm.secondaryReading}
                        onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, secondaryReading: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  );
                })()}
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Tipo Servicio</label>
                  <select 
                    value={newMaintenanceForm.type}
                    onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, type: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="Preventivo">Preventivo</option>
                    <option value="Mejora / Modificación">Mejora / Modificación</option>
                    <option value="Repuesto">Repuesto</option>
                    <option value="Correctivo">Correctivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Fecha</label>
                  <input 
                    type="date" 
                    value={newMaintenanceForm.date}
                    onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, date: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                  />
                </div>
              </div>

              {/* Piezas usadas: cada fila puede venir del inventario (descuenta stock) o ser un nombre
                  escrito a mano (se crea en Repuestos con stock 0 para poder reponerla más adelante) */}
              <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-orange-400 font-bold uppercase tracking-wider">📦 Piezas Usadas (Opcional)</span>
                </div>

                {newMaintenanceForm.partsUsed.map((row, idx) => {
                  const pObj = row.selectedPartId ? parts.find(p => String(p.id) === String(row.selectedPartId)) : null;
                  const updateRow = (patch) => {
                    const next = newMaintenanceForm.partsUsed.map((r, i) => i === idx ? { ...r, ...patch } : r);
                    setNewMaintenanceForm({ ...newMaintenanceForm, partsUsed: next });
                  };
                  return (
                    <div key={idx} className="space-y-2 pb-3 border-b border-zinc-800/60 last:border-0 last:pb-0">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <select
                            value={row.selectedPartId}
                            onChange={(e) => {
                              const partIdStr = e.target.value;
                              if (!partIdStr) {
                                updateRow({ selectedPartId: '' });
                                return;
                              }
                              const selected = parts.find(p => String(p.id) === String(partIdStr));
                              updateRow({
                                selectedPartId: partIdStr,
                                manualName: '',
                                partNumber: !row.partNumber && selected?.reference ? selected.reference : row.partNumber
                              });
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                          >
                            <option value="">-- Escribir pieza manualmente (sin inventario) --</option>
                            {parts.map(p => {
                              const purchases = p.purchases || [];
                              const rawStock = purchases.reduce((sum, b) => sum + (b.qty || 0), 0);
                              const totalStock = parseFloat(rawStock.toFixed(3));
                              const activeBatch = purchases.find(b => b.qty > 0);
                              const unitPrice = activeBatch ? activeBatch.pricePerUnit : 0;
                              const unitPriceCurrency = activeBatch?.pricePerUnitCurrency || '€';
                              const isCurrentSelected = String(p.id) === String(row.selectedPartId);
                              return (
                                <option key={p.id} value={String(p.id)} disabled={totalStock <= 0 && !isCurrentSelected}>
                                  {p.name} (Stock: {totalStock} {p.unit || 'ud'} | {unitPrice > 0 ? `${unitPrice.toFixed(2)} ${unitPriceCurrency}/${p.unit || 'ud'}` : 'Sin precio'}) {totalStock <= 0 ? '- ¡AGOTADO!' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder={`Cant. (1 ${pObj?.unit || 'ud'})`}
                            value={row.qty}
                            onChange={(e) => updateRow({ qty: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                      </div>
                      {!row.selectedPartId && (
                        <input
                          type="text"
                          placeholder="Nombre de la pieza (Ej: Disco de freno delantero)"
                          value={row.manualName}
                          onChange={(e) => updateRow({ manualName: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Número de pieza / referencia (Ej: Brembo 110A26310)"
                          value={row.partNumber}
                          onChange={(e) => updateRow({ partNumber: e.target.value })}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                        />
                        {newMaintenanceForm.partsUsed.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewMaintenanceForm({ ...newMaintenanceForm, partsUsed: newMaintenanceForm.partsUsed.filter((_, i) => i !== idx) })}
                            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {!row.selectedPartId && row.manualName.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewPartForm({
                              name: row.manualName.trim(),
                              reference: row.partNumber || '',
                              unit: 'ud',
                              compatibleVehicles: [newMaintenanceForm.vehicle],
                              minStock: '1',
                              initialQty: '0',
                              initialPrice: '',
                              initialSupplier: '',
                              initialDate: new Date().toISOString().split('T')[0]
                            });
                            setPartLinkRowIndex(idx);
                            setShowAddPartModal(true);
                          }}
                          className="text-[11px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Rellenar ficha completa (precio, stock, compatibilidad…)
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setNewMaintenanceForm({ ...newMaintenanceForm, partsUsed: [...newMaintenanceForm.partsUsed, { selectedPartId: '', manualName: '', partNumber: '', qty: '1' }] })}
                  className="w-full py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 text-zinc-300 hover:text-orange-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir otra pieza
                </button>
              </div>

              {/* Desglose Económico */}
              <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider block">Desglose de Costes</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 text-[11px] mb-1">Coste Piezas ({currencySymbol})</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="145.00" 
                      value={newMaintenanceForm.partsCost}
                      onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, partsCost: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[11px] mb-1">Mano de Obra ({currencySymbol})</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="24.00" 
                      value={newMaintenanceForm.laborCost}
                      onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, laborCost: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Realizado Por / Taller</label>
                <input 
                  type="text" 
                  placeholder="Ej: Taller Oficial KTM / Propio" 
                  value={newMaintenanceForm.mechanic}
                  onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, mechanic: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600" 
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Notas u Observaciones Adicionales</label>
                <textarea 
                  rows={2}
                  placeholder="Ej: Se purgó el circuito con líquido de frenos DOT5.1 y se cambió la junta de estanqueidad." 
                  value={newMaintenanceForm.notes}
                  onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, notes: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600 resize-none" 
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Fotos de Ticket / Factura (Opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {(newMaintenanceForm.receipts || []).map((r, idx) => (
                    <div key={r.path || idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-800 group">
                      <img
                        src={r.url}
                        alt={`Recibo ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPhotoPreviewModal({ urls: newMaintenanceForm.receipts.map(x => x.url), index: idx, title: newMaintenanceForm.title || 'Recibo' })}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveReceiptPhoto(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label className={`w-16 h-16 rounded-xl border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-orange-400 hover:border-orange-500/40 cursor-pointer transition-colors ${receiptUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {receiptUploading ? (
                      <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleAddReceiptPhotos(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  {editingMaintenanceId ? 'Guardar Cambios en Registro' : 'Guardar Registro Completo'}
                </button>
                {editingMaintenanceId && (
                  <button
                    type="button"
                    onClick={() => {
                      const idToDelete = editingMaintenanceId;
                      setShowAddMaintenanceModal(false);
                      setEditingMaintenanceId(null);
                      setNewMaintenanceForm(blankMaintenanceForm());
                      handleDeleteMaintenance(idToDelete);
                    }}
                    className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Registro</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET: AÑADIR NUEVO VEHÍCULO */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">
                  {editingVehicleId ? (language === 'es' ? 'Editar Vehículo' : language === 'en' ? 'Edit Vehicle' : language === 'it' ? 'Modifica Veicolo' : language === 'fr' ? 'Modifier le Véhicule' : language === 'de' ? 'Fahrzeug Bearbeiten' : 'Editar Veículo') : (language === 'es' ? 'Añadir Nuevo Vehículo' : language === 'en' ? 'Add New Vehicle' : language === 'it' ? 'Aggiungi Nuovo Veicolo' : language === 'fr' ? 'Ajouter un Nouveau Véhicule' : language === 'de' ? 'Neues Fahrzeug Hinzufügen' : 'Adicionar Novo Veículo')}
                </h3>
                <p className="text-xs text-zinc-400">
                  {editingVehicleId ? (language === 'es' ? 'Modifica los datos del vehículo' : language === 'en' ? 'Edit vehicle information' : language === 'it' ? 'Modifica i dati del veicolo' : language === 'fr' ? 'Modifiez les données du véhicule' : language === 'de' ? 'Fahrzeugdaten bearbeiten' : 'Edita os dados do veículo') : (language === 'es' ? 'Registra una nueva moto, vehículo o máquina en tu garaje.' : language === 'en' ? 'Register a new bike, car or machine.' : language === 'it' ? 'Registra una nuova moto, auto o macchina nel tuo garage.' : language === 'fr' ? 'Enregistrez une nouvelle moto, voiture ou machine dans votre garage.' : language === 'de' ? 'Registriere ein neues Motorrad, Auto oder Gerät in deiner Garage.' : 'Regista uma nova mota, carro ou máquina na tua garagem.')}
                </p>
              </div>
              <button onClick={() => { setShowAddVehicleModal(false); setEditingVehicleId(null); }} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm">✕</button>
            </div>
            
            <form onSubmit={handleCreateVehicle} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Nombre / Modelo del Vehículo</label>
                <input 
                  type="text" 
                  placeholder="Ej: Honda CRF 250R, Audi A4 2.0 TDI" 
                  value={newVehicleForm.name}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Tipo de Medición</label>
                  <select 
                    value={newVehicleForm.unit}
                    onChange={(e) => setNewVehicleForm({ 
                      ...newVehicleForm, 
                      unit: e.target.value,
                      category: e.target.value === 'hrs' ? 'Enduro • Por Horas' : 'Vehículo • Por Km'
                    })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="km">Kilómetros (km)</option>
                    <option value="hrs">Horas de uso (hrs)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Lectura Inicial</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={newVehicleForm.usageNum}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, usageNum: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Foto del Vehículo (Opcional)</label>
                <div className="flex items-center gap-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  {newVehicleForm.photo ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-700 shrink-0">
                      <img src={newVehicleForm.photo} alt="Previsualización" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shrink-0 text-zinc-500">
                      📸
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="inline-block px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs cursor-pointer border border-zinc-700 transition-colors">
                      {newVehicleForm.photo ? 'Cambiar Foto' : 'Cargar Foto de la Galería'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const optimizedUrl = await optimizeImageFile(file);
                            setNewVehicleForm({ ...newVehicleForm, photo: optimizedUrl });
                          }
                        }}
                      />
                    </label>
                    {newVehicleForm.photo && (
                      <button 
                        type="button" 
                        onClick={() => setNewVehicleForm({ ...newVehicleForm, photo: '' })}
                        className="ml-2 text-rose-400 hover:text-rose-300 text-[11px] underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">
                  {language === 'es' ? `Próxima ${getInspectionLabel(language)} (Opcional)` : language === 'en' ? `Next ${getInspectionLabel(language)} (Optional)` : language === 'it' ? `Prossima ${getInspectionLabel(language)} (Opzionale)` : language === 'fr' ? `Prochain ${getInspectionLabel(language)} (Optionnel)` : language === 'de' ? `Nächste ${getInspectionLabel(language)} (Optional)` : `Próxima ${getInspectionLabel(language)} (Opcional)`}
                </label>
                <input
                  type="date"
                  value={newVehicleForm.nextInspectionDate}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, nextInspectionDate: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  {language === 'es'
                    ? 'Déjalo en blanco si no aplica en tu país o vehículo.'
                    : language === 'en'
                    ? 'Leave it blank if this does not apply in your country or vehicle.'
                    : language === 'it'
                    ? 'Lascialo vuoto se non si applica al tuo paese o veicolo.'
                    : language === 'fr'
                    ? "Laissez vide si cela ne s'applique pas à votre pays ou véhicule."
                    : language === 'de'
                    ? 'Lasse es leer, wenn dies in deinem Land oder für dein Fahrzeug nicht zutrifft.'
                    : 'Deixa em branco se não se aplicar ao teu país ou veículo.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">
                    {language === 'es' ? 'Matrícula (Opcional)' : language === 'en' ? 'License Plate (Optional)' : language === 'it' ? 'Targa (Opzionale)' : language === 'fr' ? "Plaque d'Immatriculation (Optionnel)" : language === 'de' ? 'Kennzeichen (Optional)' : 'Matrícula (Opcional)'}
                  </label>
                  <input
                    type="text"
                    value={newVehicleForm.licensePlate}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, licensePlate: e.target.value.toUpperCase() })}
                    placeholder="1234 ABC"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">
                    {language === 'es' ? 'Aseguradora (Opcional)' : language === 'en' ? 'Insurance Company (Optional)' : language === 'it' ? 'Compagnia Assicurativa (Opzionale)' : language === 'fr' ? "Compagnie d'Assurance (Optionnel)" : language === 'de' ? 'Versicherung (Optional)' : 'Seguradora (Opcional)'}
                  </label>
                  <input
                    type="text"
                    value={newVehicleForm.insuranceCompany}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, insuranceCompany: e.target.value })}
                    placeholder={language === 'es' ? 'Ej. Mapfre' : language === 'en' ? 'e.g. Allstate' : language === 'it' ? 'Es. Generali' : language === 'fr' ? 'Ex. AXA' : language === 'de' ? 'Z.B. Allianz' : 'Ex. Fidelidade'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Icono Representativo</label>
                <div className="flex items-center gap-2">
                  {['🏍️', '🌍', '🛻', '🏎️', '🚜', '🚐'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewVehicleForm({ ...newVehicleForm, icon })}
                      className={`w-10 h-10 rounded-xl border text-xl flex items-center justify-center transition-all ${
                        newVehicleForm.icon === icon 
                          ? 'bg-orange-500/20 border-orange-500 text-white scale-105' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  Guardar Vehículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET: PROGRAMAR NUEVA ALERTA POR VEHÍCULO */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">Programar Alerta / Mantenimiento</h3>
                <p className="text-xs text-zinc-400">{showAlertModal.name}</p>
              </div>
              <button onClick={() => setShowAlertModal(null)} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm">✕</button>
            </div>
            
            <form onSubmit={handleAddVehicleAlert} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Nombre de la Alerta / Trabajo</label>
                <input 
                  type="text" 
                  placeholder="Ej: Cambio de aceite y filtro, Reglaje de válvulas" 
                  value={newAlertForm.title}
                  onChange={(e) => setNewAlertForm({ ...newAlertForm, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-amber-500 font-medium placeholder:text-zinc-600" 
                  required 
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Tipo de Alerta</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAlertForm({ ...newAlertForm, type: 'usage' })}
                    className={`px-3 py-2.5 rounded-xl border font-semibold text-xs transition-all ${newAlertForm.type === 'usage' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {t('alertTypeUsage')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAlertForm({ ...newAlertForm, type: 'date' })}
                    className={`px-3 py-2.5 rounded-xl border font-semibold text-xs transition-all ${newAlertForm.type === 'date' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {t('alertTypeDate')}
                  </button>
                </div>
              </div>

              {newAlertForm.type === 'date' ? (
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">{t('targetDateLabel')}</label>
                  <input
                    type="date"
                    value={newAlertForm.targetDate}
                    onChange={(e) => setNewAlertForm({ ...newAlertForm, targetDate: e.target.value })}
                    className="w-full h-11 appearance-none bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-zinc-200 outline-none focus:border-amber-500 font-mono"
                    style={{ WebkitAppearance: 'none' }}
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Lectura Objetivo ({showAlertModal.unit})</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder={showAlertModal.unit === 'hrs' ? "50" : "75000"}
                      value={newAlertForm.targetUsage}
                      onChange={(e) => setNewAlertForm({ ...newAlertForm, targetUsage: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-amber-500 font-mono"
                      required
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Lectura actual: {showAlertModal.usage}</span>
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Avisar Antes ({showAlertModal.unit})</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder={showAlertModal.unit === 'hrs' ? "5" : "500"}
                      value={newAlertForm.advanceNotice}
                      onChange={(e) => setNewAlertForm({ ...newAlertForm, advanceNotice: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Margen de aviso previo</span>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-lg shadow-amber-500/25 active:scale-95">
                  Guardar Alerta Programada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET: ACTUALIZAR KILOMETRAJE / HORAS */}
      {showKmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">Actualizar Uso Actual</h3>
                <p className="text-xs text-zinc-400">{showKmModal.name}</p>
              </div>
              <button onClick={() => setShowKmModal(null)} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm">✕</button>
            </div>
            
            <form onSubmit={handleUpdateKm} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Nuevo Valor ({showKmModal.unit})</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseFloat(newKmValue) || 0;
                      const step = showKmModal.unit === 'hrs' ? 0.5 : 1;
                      setNewKmValue(Math.max(0, parseFloat((val - step).toFixed(1))).toString());
                    }}
                    className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 flex items-center justify-center font-mono font-bold text-lg active:scale-95 transition-all shrink-0"
                  >
                    -
                  </button>

                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={newKmValue}
                      onChange={(e) => setNewKmValue(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center text-lg font-bold font-mono text-orange-400 outline-none focus:border-orange-500" 
                      required 
                    />
                    <span className="absolute right-3 top-3.5 text-xs text-zinc-500 font-mono uppercase pointer-events-none">{showKmModal.unit}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const val = parseFloat(newKmValue) || 0;
                      const step = showKmModal.unit === 'hrs' ? 0.5 : 1;
                      setNewKmValue(parseFloat((val + step).toFixed(1)).toString());
                    }}
                    className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 flex items-center justify-center font-mono font-bold text-lg active:scale-95 transition-all shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              {(() => {
                const secondaryUnit = showKmModal.unit === 'hrs' ? 'km' : 'hrs';
                return (
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">
                      {secondaryUnit === 'km' ? 'Km' : 'Horas'} (opcional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder={secondaryUnit === 'km' ? 'Ej: 12500' : 'Ej: 48.5'}
                        value={newSecondaryKmValue}
                        onChange={(e) => setNewSecondaryKmValue(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                      />
                      <span className="absolute right-3 top-3.5 text-xs text-zinc-500 font-mono uppercase pointer-events-none">{secondaryUnit}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  Actualizar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET: NUEVA / EDITAR PIEZA DE REPUESTO */}
      {showAddPartModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">
                  {editingPartId ? 'Modificar Repuesto' : 'Añadir Nuevo Repuesto'}
                </h3>
                <p className="text-xs text-zinc-400">Registra repuestos, consumibles y stock de tu taller.</p>
              </div>
              <button
                onClick={() => {
                  setShowAddPartModal(false);
                  setEditingPartId(null);
                  setPartLinkRowIndex(null);
                }}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateOrUpdatePart} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Nombre del Repuesto / Pieza</label>
                <input 
                  type="text" 
                  placeholder="Ej: Aceite Motorex 10W50, Filtro de Aire" 
                  value={newPartForm.name}
                  onChange={(e) => setNewPartForm({ ...newPartForm, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Referencia (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: SKU-12345, REF-OEM-8934"
                  value={newPartForm.reference}
                  onChange={(e) => setNewPartForm({ ...newPartForm, reference: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Vehículos Compatibles (Selección múltiple)</label>
                <div className="flex flex-wrap gap-1.5 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      const current = newPartForm.compatibleVehicles || [];
                      if (current.includes('Universal')) {
                        setNewPartForm({ ...newPartForm, compatibleVehicles: [] });
                      } else {
                        setNewPartForm({ ...newPartForm, compatibleVehicles: ['Universal'] });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      (newPartForm.compatibleVehicles || []).includes('Universal')
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 font-bold'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    🌐 Universal / Todos
                  </button>
                  {vehicles.map(v => {
                    const isSelected = (newPartForm.compatibleVehicles || []).includes(v.name);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          const current = (newPartForm.compatibleVehicles || []).filter(item => item !== 'Universal');
                          if (isSelected) {
                            setNewPartForm({ ...newPartForm, compatibleVehicles: current.filter(item => item !== v.name) });
                          } else {
                            setNewPartForm({ ...newPartForm, compatibleVehicles: [...current, v.name] });
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 font-bold'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <span>{v.icon}</span>
                        <span>{v.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Unidad de Medida</label>
                  <select
                    value={newPartForm.unit}
                    onChange={(e) => setNewPartForm({ ...newPartForm, unit: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                  >
                    {PART_UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Stock Mínimo de Alerta</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={newPartForm.minStock}
                    onChange={(e) => setNewPartForm({ ...newPartForm, minStock: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 bg-zinc-950 p-3 rounded-2xl border border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPartForm.lowStockAlertEnabled}
                  onChange={(e) => setNewPartForm({ ...newPartForm, lowStockAlertEnabled: e.target.checked })}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-xs text-zinc-300 font-medium">
                  Avisar cuando el stock esté bajo
                  <span className="block text-[10px] text-zinc-500 font-normal mt-0.5">Desactívalo para repuestos que no te importa tener agotados (no aparecerá en alertas ni notificaciones)</span>
                </span>
              </label>

              {!editingPartId && (
                <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 space-y-3">
                  <span className="text-[11px] font-mono text-orange-400 font-bold uppercase tracking-wider block">🧾 Datos de la primera compra / lote inicial</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">Cantidad Comprada ({newPartForm.unit || 'ud'})</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="1"
                        value={newPartForm.initialQty}
                        onChange={(e) => setNewPartForm({ ...newPartForm, initialQty: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">Precio Unitario ({currencySymbol})</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="14.50" 
                        value={newPartForm.initialPrice}
                        onChange={(e) => setNewPartForm({ ...newPartForm, initialPrice: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">Proveedor / Tienda</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Amazon, Motosport" 
                        value={newPartForm.initialSupplier}
                        onChange={(e) => setNewPartForm({ ...newPartForm, initialSupplier: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600" 
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">Fecha de Compra</label>
                      <input 
                        type="date" 
                        value={newPartForm.initialDate}
                        onChange={(e) => setNewPartForm({ ...newPartForm, initialDate: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  {editingPartId ? 'Guardar Cambios' : 'Registrar Repuesto y Compra'}
                </button>
                {editingPartId && (
                  <button
                    type="button"
                    onClick={() => {
                      const idToDelete = editingPartId;
                      setShowAddPartModal(false);
                      setEditingPartId(null);
                      handleDeletePart(idToDelete);
                    }}
                    className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Repuesto</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET: AÑADIR NUEVA COMPRA / LOTE DE STOCK */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">Registrar Nueva Compra</h3>
                <p className="text-xs text-zinc-400">{showBatchModal.name}</p>
              </div>
              <button 
                onClick={() => setShowBatchModal(null)} 
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddPurchaseBatch} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Cantidad Adquirida ({showBatchModal.unit || 'ud'})</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="1"
                    value={newBatchForm.qty}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, qty: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Precio Unitario ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="14.50" 
                    value={newBatchForm.pricePerUnit}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, pricePerUnit: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Proveedor / Lugar de Compra</label>
                <input 
                  type="text" 
                  placeholder="Ej: Amazon, Recambios Local, Motosport" 
                  value={newBatchForm.supplier}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, supplier: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-medium placeholder:text-zinc-600" 
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Fecha de Compra</label>
                <input 
                  type="date" 
                  value={newBatchForm.date}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, date: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  Añadir Lote a Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO DE CONFIRMACIÓN DE BORRADO */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-white tracking-tight">{confirmModal.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{confirmModal.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-zinc-700/70 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all active:scale-95"
              >
                Confirmar Borrado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO DE NOTIFICACIÓN / ALERTA CON ESTILO OSCURO */}
      {noticeModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              noticeModal.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
              noticeModal.type === 'error' || noticeModal.type === 'danger' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
              'bg-orange-500/10 border border-orange-500/20 text-orange-400'
            }`}>
              {noticeModal.type === 'success' ? <CheckCircle2 className="w-6 h-6 stroke-[2]" /> :
               noticeModal.type === 'error' || noticeModal.type === 'danger' ? <ShieldAlert className="w-6 h-6 stroke-[2]" /> :
               <Sparkles className="w-6 h-6 stroke-[2]" />}
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-white tracking-tight">{noticeModal.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{noticeModal.message}</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (noticeModal.onConfirm) noticeModal.onConfirm();
                  setNoticeModal(null);
                }}
                className={`w-full py-3 rounded-2xl font-bold text-xs shadow-lg transition-all active:scale-95 ${
                  noticeModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25' :
                  noticeModal.type === 'error' || noticeModal.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25' :
                  'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25'
                }`}
              >
                {noticeModal.buttonText || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO DE PREVISUALIZACIÓN DE FOTO A PANTALLA COMPLETA (soporta galería con varias fotos) */}
      {photoPreviewModal && (() => {
        const urls = photoPreviewModal.urls || [photoPreviewModal.url];
        const index = photoPreviewModal.index || 0;
        const hasMultiple = urls.length > 1;
        return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-zinc-900 rounded-3xl border border-zinc-800 p-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-2">
                <span>📷</span> {photoPreviewModal.title}{hasMultiple ? ` (${index + 1}/${urls.length})` : ''}
              </h3>
              <button
                type="button"
                onClick={() => setPhotoPreviewModal(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="relative max-h-[75vh] overflow-hidden rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-800/80">
              <img
                src={urls[index]}
                alt={photoPreviewModal.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
              />
              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoPreviewModal({ ...photoPreviewModal, index: (index - 1 + urls.length) % urls.length })}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoPreviewModal({ ...photoPreviewModal, index: (index + 1) % urls.length })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {hasMultiple && (
              <div className="flex items-center justify-center gap-1.5 pt-3">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoPreviewModal({ ...photoPreviewModal, index: i })}
                    className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-orange-500' : 'w-1.5 bg-zinc-700'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* BOTÓN FLOTANTE DE AYUDA: reabre el tour de bienvenida cuando se quiera */}
      <button
        type="button"
        onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }}
        aria-label={t('onboardingHelpAria')}
        title={t('onboardingHelpAria')}
        className="hidden md:flex fixed bottom-6 left-6 w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 text-orange-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 shadow-2xl shadow-black/40 items-center justify-center transition-all active:scale-95 z-40"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* TOUR DE BIENVENIDA: aparece solo la primera vez (o al pulsar el botón de ayuda) */}
      {showOnboarding && (
        <OnboardingTour step={onboardingStep} setStep={setOnboardingStep} onClose={closeOnboarding} t={t} />
      )}

      {/* MODAL DE NOVEDADES: cambios de cara al usuario desde su última visita (ver src/changelog.js) */}
      {changelogEntries && (
        <ChangelogModal entries={changelogEntries} language={language} onClose={closeChangelog} />
      )}

    </div>
  );
}
