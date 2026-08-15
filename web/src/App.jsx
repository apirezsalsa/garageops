import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { auth, db, functions, getMessagingIfSupported, VAPID_KEY } from './firebase';
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
import { optimizeImageFile } from './utils/image';
import { OnboardingTour } from './components/OnboardingTour';
import { NavItem } from './components/NavItem';
import { MobileNavItem } from './components/MobileNavItem';
import { MetricBento } from './components/MetricBento';
import { VehicleBentoCard } from './components/VehicleBentoCard';

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

  const closeOnboarding = () => {
    setShowOnboarding(false);
    if (firebaseUser) {
      updateDoc(doc(db, 'users', firebaseUser.uid), { hasSeenOnboarding: true, updatedAt: serverTimestamp() })
        .catch(err => console.warn('Error al guardar que se vio el tour de bienvenida:', err));
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
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminUserSort, setAdminUserSort] = useState('alpha');
  const [selectedAdminUser, setSelectedAdminUser] = useState(null); // usuario seleccionado para gestionar en modal
  const [adminSubTab, setAdminSubTab] = useState('users'); // 'users' | 'plans' | 'transactions' — sub-pestaña del Backoffice
  const [transactions, setTransactions] = useState([]);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all'); // 'all' | 'alta' | 'modificacion' | 'baja'
  const [editingPlan, setEditingPlan] = useState(null); // plan siendo creado/editado en el modal de Planes ({} para crear uno nuevo)
  const [planEditLang, setPlanEditLang] = useState('es'); // pestaña de idioma activa en el modal de edición de plan (tagline/features)
  const [giftDaysInput, setGiftDaysInput] = useState('30');
  const [giftPlanInput, setGiftPlanInput] = useState('unlimited');
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

  // Eliminar usuario definitivamente (Firebase Auth + Firestore + sus datos) desde el Backoffice.
  // Usa una Cloud Function con Admin SDK porque el cliente no puede borrar cuentas de Auth de otros usuarios
  // — borrar solo el documento de Firestore dejaba la cuenta viva y el usuario podía volver a entrar.
  const handleDeleteUser = (targetUser) => {
    setConfirmModal({
      title: '¿Eliminar Usuario?',
      message: `¿Seguro que deseas eliminar a ${targetUser.email}? Se borrará su cuenta de acceso y todos sus datos (vehículos, repuestos, mantenimientos) de forma permanente e irreversible.`,
      onConfirm: async () => {
        try {
          const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');
          await deleteUserAccountFn({ targetUid: targetUser.id });
          setAllUsersList(prev => prev.filter(u => u.id !== targetUser.id));
          setNoticeModal({
            title: 'Usuario Eliminado',
            message: `El usuario ${targetUser.email} ha sido eliminado con éxito, incluyendo su cuenta de acceso y sus datos.`,
            type: 'success'
          });
        } catch (err) {
          console.error('Error al eliminar usuario:', err);
          setNoticeModal({
            title: 'Error al Eliminar',
            message: `No se pudo eliminar a ${targetUser.email}: ${err.message || 'error desconocido'}.`,
            type: 'warning'
          });
        }
      }
    });
  };

  // Crea o actualiza un plan de suscripción desde el modal de "Gestión de Planes" del Backoffice
  const handleSavePlanConfig = async () => {
    const draft = editingPlan;
    if (!draft || !draft.name || !draft.name.trim()) {
      setNoticeModal({ title: 'Falta el nombre', message: 'El plan necesita un nombre.', type: 'warning' });
      return;
    }
    const active = draft.active !== false;
    const tagline = {};
    const features = {};
    for (const lang of PLAN_LANGUAGES) {
      tagline[lang] = (draft.taglineByLang?.[lang] || '').trim();
      features[lang] = (draft.featuresTextByLang?.[lang] || '').split('\n').map(f => f.trim()).filter(Boolean);
    }
    const data = {
      name: draft.name.trim(),
      tagline,
      priceMonthly: Number(draft.priceMonthly) || 0,
      priceAnnual: Number(draft.priceAnnual) || 0,
      stripePriceIdMonthly: (draft.stripePriceIdMonthly || '').trim(),
      stripePriceIdAnnual: (draft.stripePriceIdAnnual || '').trim(),
      maxVehicles: draft.unlimited ? -1 : (Number(draft.maxVehicles) || 0),
      badgeColor: draft.badgeColor || DEFAULT_PLAN_COLOR,
      highlight: !!draft.highlight,
      features,
      active,
      // Un plan descontinuado no puede quedar marcado como plan por defecto para nuevos registros
      isDefaultSignup: active && !!draft.isDefaultSignup,
      updatedAt: serverTimestamp()
    };
    try {
      if (draft.id) {
        await updateDoc(doc(db, 'plans', draft.id), data);
      } else {
        await addDoc(collection(db, 'plans'), { ...data, order: plans.length, createdAt: serverTimestamp() });
      }
      // Solo puede haber un plan marcado como "por defecto para nuevos registros"
      if (data.isDefaultSignup) {
        const others = plans.filter(p => p.isDefaultSignup && p.id !== draft.id);
        for (const other of others) {
          await updateDoc(doc(db, 'plans', other.id), { isDefaultSignup: false });
        }
      }
      setEditingPlan(null);
    } catch (err) {
      console.error('Error al guardar el plan:', err);
      setNoticeModal({ title: 'Error', message: 'No se pudo guardar el plan.', type: 'warning' });
    }
  };

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
    setShowAddVehicleModal(false);
    setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '', nextInspectionDate: '', licensePlate: '', insuranceCompany: '' });
  };

  const handleUpdateKm = async (e) => {
    e.preventDefault();
    if (!showKmModal) return;

    const newNum = parseFloat(newKmValue) || 0;

    await firestoreUpdate('vehicles', showKmModal.id, {
      usage: `${newNum} ${showKmModal.unit}`,
      usageNum: newNum
    });

    if (selectedVehicle && selectedVehicle.id === showKmModal.id) {
      setSelectedVehicle(prev => ({
        ...prev,
        usage: `${newNum} ${prev.unit}`,
        usageNum: newNum
      }));
    }

    setShowKmModal(null);
    setNewKmValue('');
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
  const [partSearch, setPartSearch] = useState('');
  const [selectedPartForBatches, setSelectedPartForBatches] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(null);

  const [newPartForm, setNewPartForm] = useState({
    name: '',
    reference: '',
    unit: 'ud',
    compatibleVehicles: [],
    minStock: '1',
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
        minStock: minStockNum
      });
    } else {
      const initialQtyNum = parseFloat(newPartForm.initialQty) || 0;
      const initialPriceNum = parseFloat(newPartForm.initialPrice) || 0;

      const initialPurchase = initialQtyNum > 0 ? [{
        id: Date.now(),
        qty: initialQtyNum,
        pricePerUnit: initialPriceNum,
        supplier: newPartForm.initialSupplier || 'Taller / Tienda',
        date: newPartForm.initialDate || '2026-07-25'
      }] : [];

      const newPart = {
        name: newPartForm.name,
        reference: newPartForm.reference || null,
        unit: newPartForm.unit || 'ud',
        compatibleVehicles: newPartForm.compatibleVehicles.length > 0 ? newPartForm.compatibleVehicles : ['Universal'],
        minStock: minStockNum,
        purchases: initialPurchase
      };

      await firestoreAdd('parts', newPart);
    }

    setShowAddPartModal(false);
    setEditingPartId(null);
    setNewPartForm({
      name: '',
      reference: '',
      unit: 'ud',
      compatibleVehicles: [],
      minStock: '1',
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
      initialQty: '0',
      initialPrice: '',
      initialSupplier: '',
      initialDate: '2026-07-25'
    });
    setShowAddPartModal(true);
  };

  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);

  // Form State para Nuevo Mantenimiento Ampliado con Repuesto Consumido
  const [newMaintenanceForm, setNewMaintenanceForm] = useState({
    vehicle: vehicles[0]?.name || '',
    title: '',
    category: 'Motor & Transmisión',
    usageAtService: '',
    selectedPartId: '',
    partQty: '1',
    partsCost: '',
    laborCost: '',
    date: '2026-07-25',
    type: 'Preventivo',
    notes: '',
    mechanic: ''
  });

  const handleCreateOrUpdateMaintenance = async (e) => {
    e.preventDefault();
    if (!newMaintenanceForm.title) return;

    const targetVehicle = newMaintenanceForm.vehicle || selectedVehicle?.name || vehicles[0]?.name;
    const currentVehObj = vehicles.find(v => v.name.toLowerCase() === targetVehicle.toLowerCase());

    // Si se seleccionó un repuesto del inventario, descontar stock FIFO en Firestore
    if (newMaintenanceForm.selectedPartId && !editingMaintenanceId) {
      const targetPart = parts.find(p => String(p.id) === String(newMaintenanceForm.selectedPartId));
      if (targetPart && targetPart.purchases && targetPart.purchases.length > 0) {
        let qtyToDeduct = parseFloat(newMaintenanceForm.partQty) || 1;
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
    }

    const totalCostNum = (parseFloat(newMaintenanceForm.partsCost) || 0) + (parseFloat(newMaintenanceForm.laborCost) || 0);
    const finalCostStr = totalCostNum > 0 ? `${totalCostNum.toFixed(2)} €` : '0.00 €';

    const selectedPartObj = parts.find(p => String(p.id) === String(newMaintenanceForm.selectedPartId));

    const maintenanceData = {
      vehicle: targetVehicle,
      title: newMaintenanceForm.title,
      category: newMaintenanceForm.category,
      usageAtService: newMaintenanceForm.usageAtService ? `${newMaintenanceForm.usageAtService} ${currentVehObj?.unit || 'km'}` : currentVehObj?.usage || '',
      usedPartId: newMaintenanceForm.selectedPartId || null,
      usedPartName: selectedPartObj ? selectedPartObj.name : null,
      usedPartQty: newMaintenanceForm.partQty || '1',
      date: newMaintenanceForm.date || new Date().toISOString().split('T')[0],
      cost: finalCostStr,
      partsCost: newMaintenanceForm.partsCost ? `${parseFloat(newMaintenanceForm.partsCost).toFixed(2)} €` : '0.00 €',
      laborCost: newMaintenanceForm.laborCost ? `${parseFloat(newMaintenanceForm.laborCost).toFixed(2)} €` : '0.00 €',
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
    setNewMaintenanceForm({
      vehicle: selectedVehicle?.name || vehicles[0]?.name || '',
      title: '',
      category: 'Motor & Transmisión',
      usageAtService: '',
      selectedPartId: '',
      partQty: '1',
      partsCost: '',
      laborCost: '',
      cost: '',
      type: 'Preventivo',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      mechanic: ''
    });
  };

  // --- FUNCIONES DE EXPORTACIÓN PDF / CSV / BACKUP JSON & NOTIFICACIONES ---
  const handleExportPDFCertificate = (targetVehicleObj = null) => {
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
          .badge { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; padding: 3px 10px; border-radius: 4px; font-size: 8.5pt; font-weight: bold; }
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
          <div class="badge">DOCUMENTO OFICIAL VERIFICADO</div>
        </div>
        <div class="veh-info">
          <div>
            <h2>${veh ? veh.name : 'Informe de Flota Completa'}</h2>
            ${veh ? `<p><strong>Categoría:</strong> ${veh.category} &nbsp;|&nbsp; <strong>Lectura Actual:</strong> ${veh.usage}</p>` : ''}
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

  const handleExportJSON = () => {
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
    const headers = ["ID", "Fecha", "Vehiculo", "Titulo", "Tipo", "ManoDeObra", "PiezasCoste", "CosteTotal", "Notas"];
    const rows = maintenances.map(m => [
      m.id,
      `"${m.date || ''}"`,
      `"${m.vehicle || ''}"`,
      `"${(m.title || '').replace(/"/g, '""')}"`,
      `"${m.type || ''}"`,
      `"${m.laborCost || '0.00 €'}"`,
      `"${m.partsCost || '0.00 €'}"`,
      `"${m.cost || '0.00 €'}"`,
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
    setNewMaintenanceForm({
      vehicle: item.vehicle,
      title: item.title,
      category: item.category || 'Motor & Transmisión',
      usageAtService: item.usageAtService ? item.usageAtService.replace(/[^0-9.]/g, '') : '',
      selectedPartId: item.usedPartId ? String(item.usedPartId) : '',
      partQty: item.usedPartQty ? String(item.usedPartQty) : '1',
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
          
          <button 
            onClick={() => { setActiveTab('profile'); setSelectedVehicle(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-orange-400 active:scale-95 transition-transform"
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil</span>
          </button>
        </header>

        {/* VISTA 1: DASHBOARD */}
        {activeTab === 'dashboard' && !selectedVehicle && (
          <div className="space-y-6">
            
            {/* Banner de Cabecera con Bento Grid */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{language === 'es' ? 'Control Preventivo Inteligente' : language === 'en' ? 'Smart Preventive Control' : language === 'it' ? 'Controllo Preventivo Intelligente' : language === 'fr' ? 'Contrôle Préventif Intelligent' : language === 'de' ? 'Intelligente Vorsorgekontrolle' : 'Controlo Preventivo Inteligente'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {language === 'es' ? 'Estado del Garaje' : language === 'en' ? 'Garage Status' : language === 'it' ? 'Stato del Garage' : language === 'fr' ? 'État du Garage' : language === 'de' ? 'Garagenstatus' : 'Estado da Garagem'}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
                    {language === 'es' ? 'Monitoreo en tiempo real de tus vehículos, repuestos críticos e intervenciones de taller.' : language === 'en' ? 'Real-time monitoring of your vehicles, critical parts, and service records.' : language === 'it' ? 'Monitoraggio in tempo reale dei tuoi veicoli, ricambi critici e interventi di officina.' : language === 'fr' ? 'Suivi en temps réel de vos véhicules, pièces critiques et interventions d\'atelier.' : language === 'de' ? 'Echtzeitüberwachung deiner Fahrzeuge, kritischen Ersatzteile und Werkstatteinsätze.' : 'Monitorização em tempo real dos teus veículos, peças críticas e intervenções de oficina.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowAddMaintenanceModal(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{t('addIntervention')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BENTO CARDS DE MÉTRICAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <MetricBento 
                title={t('vehicles')} 
                value={vehicles.length} 
                subtitle={language === 'es' ? 'En Garaje' : language === 'en' ? 'In Garage' : language === 'it' ? 'Nel Garage' : language === 'fr' ? 'Au Garage' : language === 'de' ? 'In der Garage' : 'Na Garagem'} 
                icon={Bike} 
                color="text-orange-400" 
              />
              {(() => {
                const lowStockCount = parts.filter(p => {
                  const total = (p.purchases || []).reduce((sum, b) => sum + (b.qty || 0), 0);
                  return total <= (p.minStock || 1);
                }).length;
                const vehicleAlerts = vehicles.filter(v => v.status !== 'ok').length;
                const totalAlerts = lowStockCount + vehicleAlerts;

                return (
                  <MetricBento 
                    title={t('activeAlerts')} 
                    value={totalAlerts} 
                    subtitle={totalAlerts > 0 ? `${lowStockCount} ${language === 'es' ? 'repuestos bajos' : language === 'en' ? 'low stock parts' : language === 'it' ? 'ricambi in esaurimento' : language === 'fr' ? 'pièces en stock bas' : language === 'de' ? 'Teile mit niedrigem Bestand' : 'peças com stock baixo'}` : (language === 'es' ? 'Todo al día' : language === 'en' ? 'All up to date' : language === 'it' ? 'Tutto aggiornato' : language === 'fr' ? 'Tout est à jour' : language === 'de' ? 'Alles aktuell' : 'Tudo em dia')} 
                    icon={ShieldAlert} 
                    color={totalAlerts > 0 ? "text-rose-400" : "text-emerald-400"} 
                    highlight={totalAlerts > 0} 
                  />
                );
              })()}
              {(() => {
                const lowStockCount = parts.filter(p => {
                  const total = (p.purchases || []).reduce((sum, b) => sum + (b.qty || 0), 0);
                  return total <= (p.minStock || 1);
                }).length;

                return (
                  <MetricBento 
                    title={t('partsStock')} 
                    value={parts.length} 
                    subtitle={lowStockCount > 0 ? `${lowStockCount} ${language === 'es' ? 'por reponer' : language === 'en' ? 'to order' : language === 'it' ? 'da ordinare' : language === 'fr' ? 'à commander' : language === 'de' ? 'zu bestellen' : 'a encomendar'}` : (language === 'es' ? 'Stock suficiente' : language === 'en' ? 'Stock OK' : language === 'it' ? 'Scorta ok' : language === 'fr' ? 'Stock suffisant' : language === 'de' ? 'Bestand ausreichend' : 'Stock suficiente')} 
                    icon={Wrench} 
                    color="text-blue-400" 
                  />
                );
              })()}
              {(() => {
                const totalSpent = maintenances.reduce((sum, m) => {
                  const num = parseFloat((m.cost || '').replace(/[^0-9.]/g, '')) || 0;
                  return sum + num;
                }, 0);

                return (
                  <MetricBento 
                    title={t('totalSpent')} 
                    value={`${totalSpent.toFixed(2)} €`} 
                    subtitle={language === 'es' ? 'Total intervenciones' : language === 'en' ? 'Total services' : language === 'it' ? 'Totale interventi' : language === 'fr' ? 'Total interventions' : language === 'de' ? 'Gesamt Einsätze' : 'Total de intervenções'} 
                    icon={TrendingUp} 
                    color="text-emerald-400" 
                  />
                );
              })()}
            </div>

            {/* BENTO SECTION: VEHÍCULOS (ACCESO RÁPIDO DUAL) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bike className="w-4 h-4 text-orange-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {language === 'es' ? 'Vehículos Principales' : language === 'en' ? 'Main Vehicles' : language === 'it' ? 'Veicoli Principali' : language === 'fr' ? 'Véhicules Principaux' : language === 'de' ? 'Hauptfahrzeuge' : 'Veículos Principais'}
                  </h3>
                </div>
                <button onClick={() => setActiveTab('garage')} className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
                  {language === 'es' ? 'Ver Garaje completo' : language === 'en' ? 'View Full Garage' : language === 'it' ? 'Vedi Garage completo' : language === 'fr' ? 'Voir le Garage complet' : language === 'de' ? 'Ganze Garage ansehen' : 'Ver Garagem completa'} <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map((v) => (
                  <VehicleBentoCard 
                    key={v.id} 
                    vehicle={v} 
                    maintenances={maintenances}
                    language={language}
                    onSelect={() => {
                      setSelectedVehicle(v);
                      setActiveTab('garage');
                    }}
                    onOpenKmModal={(e) => {
                      e.stopPropagation();
                      setShowKmModal(v);
                      setNewKmValue((v.usageNum || 0).toString());
                    }}
                  />
                ))}
              </div>
            </div>

            {/* BENTO SECTION: RECIENTES MANTENIMIENTOS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-orange-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {language === 'es' ? 'Últimas Intervenciones Registradas' : language === 'en' ? 'Recent Service Records' : language === 'it' ? 'Ultimi Interventi Registrati' : language === 'fr' ? 'Dernières Interventions Enregistrées' : language === 'de' ? 'Zuletzt Erfasste Einsätze' : 'Últimas Intervenções Registadas'}
                  </h3>
                </div>
                <button onClick={() => setActiveTab('history')} className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
                  {language === 'es' ? 'Ver Historial' : language === 'en' ? 'View History' : language === 'it' ? 'Vedi Cronologia' : language === 'fr' ? 'Voir l\'Historique' : language === 'de' ? 'Verlauf ansehen' : 'Ver Histórico'} <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden shadow-xl">
                {maintenances.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-800/40 transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-orange-400 shrink-0">
                        <Wrench className="w-5 h-5 stroke-[2]" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-zinc-100">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-zinc-400 font-medium">{item.vehicle}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-[11px] font-mono text-zinc-500">{item.date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`hidden sm:inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full border ${item.badgeColor}`}>
                        {item.type}
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-bold text-zinc-100 bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700/60">
                        {item.cost}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BENTO SECTION: NOTIFICACIONES AUTOMÁTICAS Y ANÁLISIS FINANCIERO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* NOTIFICACIONES AUTOMÁTICAS EN PANTALLA */}
              <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">{t('notificationsTitle')}</h3>
                </div>
                {(() => {
                  const warnings = vehicles.filter(v => v.status !== 'ok');
                  const lowStockParts = parts.filter(p => {
                    const total = (p.purchases || []).reduce((sum, b) => sum + (b.qty || 0), 0);
                    return total <= (p.minStock || 1);
                  });

                  if (warnings.length === 0 && lowStockParts.length === 0) {
                    return (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{language === 'es' ? '¡Tu flota está en perfecto estado y el inventario completo!' : language === 'en' ? 'Your fleet is in perfect condition and stock is full!' : language === 'it' ? 'Il tuo parco è in perfette condizioni e la scorta è completa!' : language === 'fr' ? 'Votre flotte est en parfait état et le stock est complet !' : language === 'de' ? 'Deine Flotte ist in perfektem Zustand und der Bestand ist vollständig!' : 'A tua frota está em perfeito estado e o stock está completo!'}</span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {warnings.map(v => (
                        <div key={v.id} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{v.icon}</span>
                            <div>
                              <p className="font-bold text-amber-300">{v.name}</p>
                              <p className="text-[10px] text-zinc-400">{v.statusText}</p>
                            </div>
                          </div>
                          <button onClick={() => { setActiveTab('garage'); setSelectedVehicle(v); }} className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white rounded-lg text-[10px] font-bold transition-all">
                            {t('updateUnit')}
                          </button>
                        </div>
                      ))}
                      {lowStockParts.map(p => (
                        <div key={p.id} className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <Wrench className="w-4 h-4 text-rose-400" />
                            <div>
                              <p className="font-bold text-rose-300">{p.name}</p>
                              <p className="text-[10px] text-zinc-400">{language === 'es' ? 'Stock Agotándose' : language === 'en' ? 'Low Stock Alert' : language === 'it' ? 'Ricambio in esaurimento' : language === 'fr' ? 'Stock en Baisse' : language === 'de' ? 'Bestand wird knapp' : 'Stock a Esgotar'}</p>
                            </div>
                          </div>
                          <button onClick={() => setActiveTab('parts')} className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold transition-all">
                            {t('addPartBtn')}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ANÁLISIS FINANCIERO Y DESGLOSE DE COSTES */}
              <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white tracking-tight">{t('analyticsTitle')}</h3>
                    </div>
                  </div>
                  {(() => {
                    let totalLabor = 0;
                    let totalParts = 0;
                    maintenances.forEach(m => {
                      totalLabor += parseFloat((m.laborCost || '0').replace(/[^0-9.]/g, '')) || 0;
                      totalParts += parseFloat((m.partsCost || '0').replace(/[^0-9.]/g, '')) || 0;
                    });
                    const grandTotal = totalLabor + totalParts || 1;
                    const laborPercent = Math.round((totalLabor / grandTotal) * 100);
                    const partsPercent = Math.round((totalParts / grandTotal) * 100);

                    return (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-zinc-400">{t('partsCostLabel')} ({partsPercent}%)</span>
                            <span className="font-mono text-emerald-400 font-bold">{totalParts.toFixed(2)} €</span>
                          </div>
                          <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${partsPercent}%` }}></div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-zinc-400">{t('laborCost')} ({laborPercent}%)</span>
                            <span className="font-mono text-orange-400 font-bold">{totalLabor.toFixed(2)} €</span>
                          </div>
                          <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                            <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${laborPercent}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{language === 'es' ? 'Optimización DIY calculada' : language === 'en' ? 'Calculated DIY Savings' : language === 'it' ? 'Risparmio DIY calcolato' : language === 'fr' ? 'Économies DIY calculées' : language === 'de' ? 'Berechnete DIY-Ersparnis' : 'Poupança DIY calculada'}</span>
                  <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">+35% ahorro</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* DETALLE DE VEHÍCULO SELECCIONADO (Sólo visible en pestaña Garaje) */}
        {activeTab === 'garage' && selectedVehicle && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setSelectedVehicle(null)} 
                className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800"
              >
                {t('backToGarage')}
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleExportPDFCertificate(selectedVehicle)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold text-xs border border-orange-500/30 transition-colors shadow-sm active:scale-95"
                >
                  <FileText className="w-4 h-4 stroke-[2.5]" />
                  <span>{t('exportPdfBtn')}</span>
                </button>

                <button 
                  onClick={() => openEditVehicleModal(selectedVehicle)}
                  title={language === 'es' ? 'Editar Vehículo' : language === 'en' ? 'Edit Vehicle' : language === 'it' ? 'Modifica Veicolo' : language === 'fr' ? 'Modifier le Véhicule' : language === 'de' ? 'Fahrzeug Bearbeiten' : 'Editar Veículo'}
                  className="p-2 rounded-xl text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors border border-transparent hover:border-amber-500/20"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => requestDeleteVehicle(selectedVehicle.id)}
                  title={t('deleteVehicle')}
                  className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Ficha Header del Vehículo */}
            <div className={`p-4 sm:p-8 rounded-3xl border bg-gradient-to-br ${selectedVehicle.accentColor} ${selectedVehicle.borderColor} bg-zinc-900 relative overflow-hidden shadow-2xl space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative group/photo shrink-0">
                    <div 
                      onClick={() => {
                        if (selectedVehicle.photo) {
                          setPhotoPreviewModal({
                            url: selectedVehicle.photo,
                            title: selectedVehicle.name
                          });
                        }
                      }}
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center text-3xl sm:text-4xl shadow-inner overflow-hidden ${
                        selectedVehicle.photo ? 'cursor-pointer hover:opacity-90' : ''
                      }`}
                    >
                      {selectedVehicle.photo ? (
                        <img src={selectedVehicle.photo} alt={selectedVehicle.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{selectedVehicle.icon}</span>
                      )}
                    </div>

                    <div className="flex gap-1 mt-1 justify-center">
                      {selectedVehicle.photo && (
                        <button
                          type="button"
                          onClick={() => setPhotoPreviewModal({ url: selectedVehicle.photo, title: selectedVehicle.name })}
                          className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-300 text-[9px] font-semibold border border-zinc-700/60"
                        >
                          👁️
                        </button>
                      )}
                      <label 
                        title={t('changePhoto')} 
                        className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold cursor-pointer border border-orange-500/40"
                      >
                        📷 {selectedVehicle.photo ? t('changePhoto') : t('photo')}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const optimizedUrl = await optimizeImageFile(file);
                              setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? { ...v, photo: optimizedUrl } : v));
                              setSelectedVehicle(prev => ({ ...prev, photo: optimizedUrl }));
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">{selectedVehicle.name}</h2>
                    <p className="text-[11px] sm:text-xs text-zinc-400 font-medium mt-0.5 truncate">{translateCategory(selectedVehicle.category, language)}</p>
                    {(selectedVehicle.licensePlate || selectedVehicle.insuranceCompany) && (
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">
                        {[selectedVehicle.licensePlate, selectedVehicle.insuranceCompany].filter(Boolean).join(' · ')}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-orange-400 font-mono text-[11px] font-semibold">
                        <Gauge className="w-3 h-3" />
                        <span>{t('usage')} {selectedVehicle.usage}</span>
                      </div>
                      {(() => {
                        const vehicleSpent = maintenances
                          .filter(m => (m.vehicle || '').toLowerCase() === (selectedVehicle.name || '').toLowerCase())
                          .reduce((sum, m) => sum + (parseFloat((m.cost || '').replace(/[^0-9.]/g, '')) || 0), 0);
                        
                        return (
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                            <TrendingUp className="w-3 h-3" />
                            <span>{t('spent')} {vehicleSpent.toFixed(2)} €</span>
                          </div>
                        );
                      })()}
                      <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                        selectedVehicle.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        selectedVehicle.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        {selectedVehicle.status === 'ok' ? t('statusOk') : selectedVehicle.statusText}
                      </span>
                      {(() => {
                        const inspection = getInspectionStatus(selectedVehicle.nextInspectionDate);
                        if (!inspection) return null;
                        return (
                          <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                            inspection.urgency === 'overdue' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            inspection.urgency === 'soon' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            'bg-zinc-800/60 text-zinc-400 border-zinc-700/60'
                          }`}>
                            {getInspectionLabel(language)}:{' '}
                            {inspection.days < 0
                              ? (language === 'es' ? `venció hace ${Math.abs(inspection.days)} días` : language === 'en' ? `overdue by ${Math.abs(inspection.days)} days` : language === 'it' ? `scaduta da ${Math.abs(inspection.days)} giorni` : language === 'fr' ? `en retard de ${Math.abs(inspection.days)} jours` : language === 'de' ? `seit ${Math.abs(inspection.days)} Tagen überfällig` : `venceu há ${Math.abs(inspection.days)} dias`)
                              : (language === 'es' ? `en ${inspection.days} días` : language === 'en' ? `in ${inspection.days} days` : language === 'it' ? `tra ${inspection.days} giorni` : language === 'fr' ? `dans ${inspection.days} jours` : language === 'de' ? `in ${inspection.days} Tagen` : `em ${inspection.days} dias`)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Principales */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
                <button 
                  onClick={() => {
                    setShowAlertModal(selectedVehicle);
                    setNewAlertForm({ type: 'usage', title: '', targetUsage: '', advanceNotice: selectedVehicle.unit === 'hrs' ? '5' : '500', targetDate: '' });
                  }}
                  className="px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{t('addAlertShort')}</span>
                </button>

                <button 
                  onClick={() => {
                    setShowKmModal(selectedVehicle);
                    setNewKmValue((selectedVehicle.usageNum || 0).toString());
                  }}
                  className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-all border border-zinc-700 flex items-center justify-center gap-1.5"
                >
                  <Gauge className="w-3.5 h-3.5 text-orange-400" />
                  <span>{t('updateUnit')} {selectedVehicle.unit}</span>
                </button>

                <button 
                  onClick={() => {
                    setNewMaintenanceForm(prev => ({
                      ...prev,
                      vehicle: selectedVehicle.name
                    }));
                    setShowAddMaintenanceModal(true);
                  }}
                  className="col-span-2 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{t('addIntervention')}</span>
                </button>
              </div>
            </div>

            {/* SECCIÓN DE ALERTAS PROGRAMADAS DE ESTE VEHÍCULO */}
            <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">{t('scheduledAlerts')} ({selectedVehicle.name})</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAlertModal(selectedVehicle);
                    setNewAlertForm({ type: 'usage', title: '', targetUsage: '', advanceNotice: selectedVehicle.unit === 'hrs' ? '5' : '500', targetDate: '' });
                  }}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  {t('newAlert')}
                </button>
              </div>

              {selectedVehicle.alerts && selectedVehicle.alerts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {selectedVehicle.alerts.map(al => {
                    const isDateAlert = al.type === 'date';
                    const current = selectedVehicle.usageNum || 0;
                    const diff = isDateAlert ? null : al.targetUsage - current;
                    const dateStatus = isDateAlert ? getInspectionStatus(al.targetDate) : null;
                    const isDue = isDateAlert ? (dateStatus?.days ?? 1) <= 0 : diff <= 0;
                    const isNear = isDateAlert
                      ? false
                      : !isDue && diff <= (al.advanceNotice || 0);

                    return (
                      <div 
                        key={al.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                          isDue 
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-200 animate-pulse' 
                            : isNear 
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' 
                            : 'bg-zinc-950/70 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{al.title}</span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${
                              isDue 
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                                : isNear 
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}>
                              {isDue ? '¡VENCIDO / TOCA YA!' : isNear ? '¡PRÓXIMO!' : 'PROGRAMADO'}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 pt-0.5">
                            {isDateAlert ? (
                              <>
                                <span>{t('targetDateLabel')} <strong className="text-white">{new Date(al.targetDate).toLocaleDateString(language === 'en' ? 'en-US' : language)}</strong></span>
                                <span>•</span>
                                <span>
                                  {isDue
                                    ? `${t('overdueBy')} ${Math.abs(dateStatus.days)} ${language === 'es' ? 'días' : language === 'en' ? 'days' : language === 'it' ? 'giorni' : language === 'fr' ? 'jours' : language === 'de' ? 'Tage' : 'dias'}`
                                    : `${t('remaining')} ${dateStatus.days} ${language === 'es' ? 'días' : language === 'en' ? 'days' : language === 'it' ? 'giorni' : language === 'fr' ? 'jours' : language === 'de' ? 'Tage' : 'dias'}`}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>{t('target')} <strong className="text-white">{al.targetUsage} {selectedVehicle.unit}</strong></span>
                                <span>•</span>
                                <span>
                                  {isDue
                                    ? `${t('overdueBy')} ${Math.abs(diff).toFixed(1)} ${selectedVehicle.unit}`
                                    : `${t('remaining')} ${diff.toFixed(1)} ${selectedVehicle.unit}`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteVehicleAlert(selectedVehicle.id, al.id)}
                          title="Eliminar Alerta"
                          className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 py-0.5">
                  {t('noAlerts')}
                </p>
              )}
            </div>

            {/* Historial Específico del Vehículo */}
            <div>
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider font-mono mb-3">{t('vehicleHistoryTitle')}</h3>
              <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
                {maintenances.filter(m => (m.vehicle || '').toLowerCase() === (selectedVehicle?.name || '').toLowerCase()).length > 0 ? (
                  maintenances.filter(m => (m.vehicle || '').toLowerCase() === (selectedVehicle?.name || '').toLowerCase()).map((item) => (
                    <div key={item.id} className="p-4 sm:p-5 hover:bg-zinc-800/30 transition-colors space-y-3">
                      {/* Línea 1 Superior Dedicada: Título del Trabajo y Acciones */}
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-bold text-zinc-100 leading-snug">{item.title}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditMaintenance(item)}
                            title="Modificar Intervención"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMaintenance(item.id)}
                            title="Borrar Registro"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Línea 2: Categoría Badge + Fecha + Tipo */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        {item.category && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-300 font-mono px-2.5 py-0.5 rounded-md border border-zinc-700/60 font-medium">
                            {item.category}
                          </span>
                        )}
                        <span className="font-mono text-zinc-400">{item.date}</span>
                        <span>•</span>
                        <span className="text-orange-400 font-semibold">{item.type}</span>
                        {item.usageAtService && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-zinc-300">Uso: {item.usageAtService}</span>
                          </>
                        )}
                        {item.mechanic && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-500">Taller: {item.mechanic}</span>
                          </>
                        )}
                      </div>

                      {/* Línea 3: Desglose de Precio */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40 text-[11px]">
                        <div className="font-mono text-zinc-500 text-[10px]">
                          {(item.partsCost && item.partsCost !== '0.00 €') && (
                            <span>Piezas: <strong className="text-zinc-400">{item.partsCost}</strong></span>
                          )}
                          {item.laborCost && item.laborCost !== '0.00 €' && (
                            <span className="ml-2">M.O: <strong className="text-zinc-400">{item.laborCost}</strong></span>
                          )}
                        </div>

                        <div className="text-xs font-mono font-bold text-orange-400 bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-800">
                          {item.cost}
                        </div>
                      </div>

                      {item.notes && (
                        <div className="pt-2 text-[11px] text-zinc-400 italic bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                          "{item.notes}"
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    {t('noHistoryMsgPrefix')}<span className="text-orange-400 font-semibold">{t('noHistoryMsgBtn')}</span>{t('noHistoryMsgSuffix')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: GARAJE COMPLETO */}
        {activeTab === 'garage' && !selectedVehicle && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('garage')}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Control individual de cada vehículo registrado.' : language === 'en' ? 'Individual control for each registered vehicle.' : language === 'it' ? 'Controllo individuale per ogni veicolo registrato.' : language === 'fr' ? 'Contrôle individuel de chaque véhicule enregistré.' : language === 'de' ? 'Individuelle Kontrolle für jedes registrierte Fahrzeug.' : 'Controlo individual de cada veículo registado.'}</p>
              </div>
              <button 
                onClick={() => {
                  setEditingVehicleId(null);
                  setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '' });
                  setShowAddVehicleModal(true);
                }} 
                className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{t('addVehicleBtn')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <VehicleBentoCard 
                  key={v.id} 
                  vehicle={v} 
                  maintenances={maintenances}
                  language={language}
                  onSelect={() => setSelectedVehicle(v)} 
                  onOpenKmModal={(e) => {
                    e.stopPropagation();
                    setShowKmModal(v);
                    setNewKmValue((v.usageNum || 0).toString());
                  }}
                  onDelete={requestDeleteVehicle}
                />
              ))}
            </div>
          </div>
        )}

        {/* VISTA 3: REPUESTOS */}
        {activeTab === 'parts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('partsTitle')}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Gestión de piezas, consumibles y stock mínimo.' : language === 'en' ? 'Management of parts, consumables, and minimum stock.' : language === 'it' ? 'Gestione di parti, consumabili e scorta minima.' : language === 'fr' ? 'Gestion des pièces, consommables et stock minimum.' : language === 'de' ? 'Verwaltung von Teilen, Verbrauchsmaterial und Mindestbestand.' : 'Gestão de peças, consumíveis e stock mínimo.'}</p>
              </div>
              <button 
                onClick={() => {
                  setEditingPartId(null);
                  setNewPartForm({
                    name: '',
                    reference: '',
                    unit: 'ud',
                    compatibleVehicles: [],
                    minStock: '1',
                    initialQty: '1',
                    initialPrice: '',
                    initialSupplier: '',
                    initialDate: '2026-07-25'
                  });
                  setShowAddPartModal(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{t('addPartBtn')}</span>
              </button>
            </div>

            <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-800/80 flex items-center gap-3">
                <Search className="w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  placeholder={language === 'es' ? 'Buscar repuesto por nombre o vehículo compatible...' : language === 'en' ? 'Search part by name or compatible vehicle...' : language === 'it' ? 'Cerca ricambio per nome o veicolo compatibile...' : language === 'fr' ? 'Rechercher une pièce par nom ou véhicule compatible...' : language === 'de' ? 'Ersatzteil nach Name oder kompatiblem Fahrzeug suchen...' : 'Procurar peça por nome ou veículo compatível...'} 
                  className="bg-transparent text-xs text-zinc-200 outline-none w-full placeholder:text-zinc-600" 
                />
              </div>

              <div className="divide-y divide-zinc-800/60">
                {parts
                  .filter(p => {
                    const search = partSearch.toLowerCase();
                    const matchName = p.name.toLowerCase().includes(search);
                    const matchVeh = p.compatibleVehicles ? p.compatibleVehicles.some(v => v.toLowerCase().includes(search)) : (p.vehicle && p.vehicle.toLowerCase().includes(search));
                    return matchName || matchVeh;
                  })
                  .map((p) => {
                    const vehList = p.compatibleVehicles || (p.vehicle ? [p.vehicle] : ['Universal']);
                    const purchases = p.purchases || [];
                    const totalStock = parseFloat((purchases.reduce((acc, b) => acc + (b.qty || 0), 0)).toFixed(3));
                    const formatQty = (num) => {
                      if (typeof num !== 'number' || isNaN(num)) return '0';
                      return Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(3)).toString();
                    };
                    const isLow = totalStock <= (p.minStock || 1);

                    // Formatear precios de compra (mostrar rango o único precio)
                    const prices = purchases.map(b => b.pricePerUnit).filter(pr => pr > 0);
                    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                    const priceLabel = minPrice === maxPrice 
                      ? `${minPrice.toFixed(2)} €` 
                      : `${minPrice.toFixed(2)} € - ${maxPrice.toFixed(2)} €`;

                    const isExpanded = selectedPartForBatches === p.id;

                    return (
                      <div key={p.id} className="divide-y divide-zinc-800/40">
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs sm:text-sm font-bold text-zinc-100">{p.name}</p>
                              {p.reference && (
                                <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg border border-zinc-700/60">
                                  {p.reference}
                                </span>
                              )}
                              {purchases.length > 1 && (
                                <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold">
                                  {purchases.length} {language === 'es' ? 'Lotes de Compra' : language === 'en' ? 'Purchase Batches' : language === 'it' ? 'Lotti d\'acquisto' : language === 'fr' ? 'Lots d\'Achat' : language === 'de' ? 'Einkaufschargen' : 'Lotes de Compra'}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] text-zinc-500 font-medium">{language === 'es' ? 'Compatibilidad:' : language === 'en' ? 'Compatibility:' : language === 'it' ? 'Compatibilità:' : language === 'fr' ? 'Compatibilité :' : language === 'de' ? 'Kompatibilität:' : 'Compatibilidade:'}</span>
                              {vehList.map((vName, idx) => (
                                <span key={idx} className="text-[10px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-lg border border-zinc-700/60">
                                  {vName}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-xl border ${
                                isLow
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                              }`}>
                                {formatQty(totalStock)} {p.unit || 'ud'} {isLow && (language === 'es' ? '(Stock Bajo)' : language === 'en' ? '(Low Stock)' : language === 'it' ? '(Scorta Bassa)' : language === 'fr' ? '(Stock Bas)' : language === 'de' ? '(Niedriger Bestand)' : '(Stock Baixo)')}
                              </span>
                              <p className="text-[11px] font-mono text-zinc-400 mt-1 font-semibold">
                                {prices.length > 0 ? priceLabel : (language === 'es' ? 'Sin compras' : language === 'en' ? 'No purchases' : language === 'it' ? 'Nessun acquisto' : language === 'fr' ? 'Aucun achat' : language === 'de' ? 'Keine Käufe' : 'Sem compras')}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
                              <button
                                onClick={() => {
                                  setShowBatchModal(p);
                                  setNewBatchForm({ qty: '1', pricePerUnit: '', supplier: '', date: '2026-07-25' });
                                }}
                                title="Añadir nueva compra / lote de stock"
                                className="px-2.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ {language === 'es' ? 'Compra' : language === 'en' ? 'Batch' : language === 'it' ? 'Lotto' : language === 'fr' ? 'Lot' : language === 'de' ? 'Charge' : 'Lote'}</span>
                              </button>
                              <button
                                onClick={() => setSelectedPartForBatches(isExpanded ? null : p.id)}
                                title="Ver Historial de Lotes de Compra"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-xs font-mono"
                              >
                                {isExpanded ? '▲' : '▼'}
                              </button>
                              <button
                                onClick={() => handleEditPart(p)}
                                title="Modificar Repuesto"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePart(p.id)}
                                title="Eliminar Repuesto"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Desplegable de Lotes de Compra Registrados */}
                        {isExpanded && (
                          <div className="p-4 bg-zinc-950/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                                {language === 'es' ? 'Lotes de Compra & Precios Registrados' : language === 'en' ? 'Registered Purchase Batches & Prices' : language === 'it' ? 'Lotti d\'acquisto e prezzi registrati' : language === 'fr' ? 'Lots d\'Achat et Prix Enregistrés' : language === 'de' ? 'Erfasste Einkaufschargen & Preise' : 'Lotes de Compra e Preços Registados'} ({purchases.length})
                              </span>
                            </div>

                            {purchases.length > 0 ? (
                              <div className="space-y-1.5">
                                {purchases.map((b) => (
                                  <div key={b.id} className="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                        {formatQty(b.qty)} {p.unit || 'ud'}
                                      </span>
                                      <div>
                                        <p className="font-semibold text-zinc-200">{b.supplier || 'Taller / Proveedor'}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono">{language === 'es' ? 'Adquirido el' : language === 'en' ? 'Purchased on' : language === 'it' ? 'Acquistato il' : language === 'fr' ? 'Acheté le' : language === 'de' ? 'Gekauft am' : 'Adquirido em'} {b.date}</p>
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
                                      {b.pricePerUnit.toFixed(2)} € / {p.unit || 'ud'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500 italic">No hay compras registradas para este repuesto.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {parts.filter(p => {
                  const search = partSearch.toLowerCase();
                  const matchName = p.name.toLowerCase().includes(search);
                  const matchVeh = p.compatibleVehicles ? p.compatibleVehicles.some(v => v.toLowerCase().includes(search)) : (p.vehicle && p.vehicle.toLowerCase().includes(search));
                  return matchName || matchVeh;
                }).length === 0 && (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    No se encontraron repuestos registrados.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: HISTORIAL COMPLETO */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('historyTitle')}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Libro digital de servicios y certificado para venta.' : language === 'en' ? 'Digital service logbook and sale certificate.' : language === 'it' ? 'Libretto digitale dei servizi e certificato per la vendita.' : language === 'fr' ? 'Carnet numérique d\'entretien et certificat de vente.' : language === 'de' ? 'Digitales Serviceheft und Verkaufszertifikat.' : 'Livrete digital de serviços e certificado de venda.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => handleExportPDFCertificate()}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span>{t('exportPdfBtn')}</span>
                </button>
                <button 
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <span>📊 {t('exportCsv')}</span>
                </button>
              </div>
            </div>

            <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden shadow-xl">
              {maintenances.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-orange-400 shrink-0">
                      <Wrench className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-zinc-100">{item.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{item.vehicle} • <span className="font-mono text-zinc-500">{item.date}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs sm:text-sm font-mono font-bold text-zinc-100 bg-zinc-800 px-3.5 py-1.5 rounded-xl border border-zinc-700/60">
                      {item.cost}
                    </span>
                    <div className="flex items-center gap-1 border-l border-zinc-800 pl-3">
                      <button
                        onClick={() => handleEditMaintenance(item)}
                        title="Modificar Intervención"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMaintenance(item.id)}
                        title="Borrar Registro"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 5: AJUSTES & SUSCRIPCIÓN SAAS */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {language === 'es' ? 'Perfil & Ajustes' : language === 'en' ? 'Profile & Settings' : language === 'it' ? 'Profilo & Impostazioni' : language === 'fr' ? 'Profil & Paramètres' : language === 'de' ? 'Profil & Einstellungen' : 'Perfil & Definições'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {language === 'es' ? 'Configuración de idioma, cuenta y plan de suscripción.' : language === 'en' ? 'Language, account, and subscription plan settings.' : language === 'it' ? 'Lingua, conto e impostazioni del piano di abbonamento.' : language === 'fr' ? "Paramètres de langue, compte et plan d'abonnement." : language === 'de' ? 'Sprach-, Konto- und Abo-Plan-Einstellungen.' : 'Configurações de idioma, conta e plano de subscrição.'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Cerrar Sesión' : language === 'en' ? 'Log Out' : language === 'it' ? 'Esci' : language === 'fr' ? 'Se Déconnecter' : language === 'de' ? 'Abmelden' : 'Terminar Sessão'}</span>
              </button>
            </div>

            {/* SECTOR: USUARIO CONECTADO */}
            <div className="bg-zinc-900/80 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-lg">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">
                    {language === 'es' ? 'Cuenta Activa' : language === 'en' ? 'Logged in as' : language === 'it' ? 'Account Attivo' : language === 'fr' ? 'Compte Actif' : language === 'de' ? 'Aktives Konto' : 'Conta Ativa'}
                  </span>
                  <p className="text-sm font-bold text-white font-mono">{userEmail}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                ● Online
              </span>
            </div>

            {/* SECTOR: SELECCIÓN DE IDIOMA */}
            <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {language === 'es' ? 'Idioma de la Aplicación' : language === 'en' ? 'App Language' : language === 'it' ? 'Lingua dell\'applicazione' : language === 'fr' ? "Langue de l'Application" : language === 'de' ? 'App-Sprache' : 'Idioma da Aplicação'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {language === 'es' ? 'Selecciona tu idioma preferido' : language === 'en' ? 'Select your preferred language' : language === 'it' ? 'Seleziona la tua lingua preferita' : language === 'fr' ? 'Sélectionnez votre langue préférée' : language === 'de' ? 'Wähle deine bevorzugte Sprache' : 'Seleciona o teu idioma preferido'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { code: 'es', label: 'Español', flag: '🇪🇸' },
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
                  { code: 'fr', label: 'Français', flag: '🇫🇷' },
                  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                  { code: 'pt', label: 'Português', flag: '🇵🇹' }
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLanguage(item.code)}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      language === item.code 
                        ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-sm' 
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <span>{item.flag}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECTOR: NOTIFICACIONES PUSH */}
            <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {language === 'es' ? 'Notificaciones de Alertas' : language === 'en' ? 'Alert Notifications' : language === 'it' ? 'Notifiche degli Avvisi' : language === 'fr' ? 'Notifications des Alertes' : language === 'de' ? 'Warnungsbenachrichtigungen' : 'Notificações de Alertas'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {language === 'es' ? 'Recibe un aviso en el móvil cuando una alerta de vehículo esté próxima o vencida.' : language === 'en' ? 'Get a push notification when a vehicle alert is near or overdue.' : language === 'it' ? 'Ricevi un avviso quando una notifica del veicolo è vicina o scaduta.' : language === 'fr' ? "Recevez un avis lorsqu'une alerte de véhicule est proche ou dépassée." : language === 'de' ? 'Erhalte eine Benachrichtigung, wenn eine Fahrzeugwarnung bald fällig oder überfällig ist.' : 'Recebe um aviso quando um alerta de veículo estiver próximo ou vencido.'}
                  </p>
                </div>
              </div>

              {pushPermissionStatus === 'unsupported' ? (
                <p className="text-[11px] text-zinc-500 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                  {language === 'es' ? 'Tu navegador no soporta notificaciones push. En iPhone, instala la app en la pantalla de inicio (Compartir → Añadir a pantalla de inicio) para poder activarlas.' : language === 'en' ? 'Your browser does not support push notifications. On iPhone, add the app to your home screen (Share → Add to Home Screen) to enable them.' : language === 'it' ? 'Il tuo browser non supporta le notifiche push. Su iPhone, aggiungi l\'app alla schermata Home (Condividi → Aggiungi a Home) per attivarle.' : language === 'fr' ? "Votre navigateur ne prend pas en charge les notifications push. Sur iPhone, ajoutez l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil) pour les activer." : language === 'de' ? 'Dein Browser unterstützt keine Push-Benachrichtigungen. Füge die App auf dem iPhone zum Home-Bildschirm hinzu (Teilen → Zum Home-Bildschirm), um sie zu aktivieren.' : 'O teu navegador não suporta notificações push. No iPhone, adiciona a app ao ecrã principal (Partilhar → Adicionar ao Ecrã Principal) para as ativares.'}
                </p>
              ) : pushPermissionStatus === 'granted' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'es' ? 'Notificaciones activadas' : language === 'en' ? 'Notifications enabled' : language === 'it' ? 'Notifiche attivate' : language === 'fr' ? 'Notifications activées' : language === 'de' ? 'Benachrichtigungen aktiviert' : 'Notificações ativadas'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestPush}
                    disabled={testPushInFlight}
                    className="w-full py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>
                      {testPushInFlight
                        ? (language === 'es' ? 'Enviando…' : language === 'en' ? 'Sending…' : language === 'it' ? 'Invio…' : language === 'fr' ? 'Envoi…' : language === 'de' ? 'Sende…' : 'A enviar…')
                        : (language === 'es' ? 'Enviar notificación de prueba' : language === 'en' ? 'Send test notification' : language === 'it' ? 'Invia notifica di prova' : language === 'fr' ? 'Envoyer une notification de test' : language === 'de' ? 'Testbenachrichtigung senden' : 'Enviar notificação de teste')}
                    </span>
                  </button>
                </div>
              ) : pushPermissionStatus === 'denied' ? (
                <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                  {language === 'es' ? 'Bloqueaste las notificaciones para esta app. Actívalas desde los ajustes de notificaciones de tu navegador/dispositivo.' : language === 'en' ? 'You blocked notifications for this app. Enable them from your browser/device notification settings.' : language === 'it' ? "Hai bloccato le notifiche per questa app. Attivale dalle impostazioni di notifica del browser/dispositivo." : language === 'fr' ? "Vous avez bloqué les notifications pour cette app. Activez-les depuis les paramètres de notification de votre navigateur/appareil." : language === 'de' ? 'Du hast Benachrichtigungen für diese App blockiert. Aktiviere sie in den Benachrichtigungseinstellungen deines Browsers/Geräts.' : 'Bloqueaste as notificações desta app. Ativa-as nas definições de notificação do teu navegador/dispositivo.'}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePushNotifications}
                  disabled={pushRequestInFlight}
                  className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  <span>
                    {pushRequestInFlight
                      ? (language === 'es' ? 'Activando…' : language === 'en' ? 'Enabling…' : language === 'it' ? 'Attivazione…' : language === 'fr' ? 'Activation…' : language === 'de' ? 'Aktiviere…' : 'A ativar…')
                      : (language === 'es' ? 'Activar Notificaciones' : language === 'en' ? 'Enable Notifications' : language === 'it' ? 'Attiva Notifiche' : language === 'fr' ? 'Activer les Notifications' : language === 'de' ? 'Benachrichtigungen Aktivieren' : 'Ativar Notificações')}
                  </span>
                </button>
              )}
            </div>

            {/* SECTOR: PLAN SAAS, CAMBIO DE PLAN & FACTURACIÓN */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8 rounded-3xl border border-zinc-800/80 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-bold">
                    {language === 'es' ? 'Suscripción Activa' : language === 'en' ? 'Active Subscription' : language === 'it' ? 'Abbonamento Attivo' : language === 'fr' ? 'Abonnement Actif' : language === 'de' ? 'Aktives Abo' : 'Subscrição Ativa'}
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mt-2">
                    {currentPlanDef?.name || currentPlan}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">
                    {language === 'es'
                      ? `Renovación automática el ${nextRenewalDate.toLocaleDateString('es-ES')} (${activeBillingCycle === 'annual' ? 'anual' : 'mensual'})`
                      : language === 'en'
                        ? `Auto-renewal on ${nextRenewalDate.toLocaleDateString('en-US')} (${activeBillingCycle === 'annual' ? 'annual' : 'monthly'})`
                        : language === 'it'
                          ? `Rinnovo automatico il ${nextRenewalDate.toLocaleDateString('it-IT')} (${activeBillingCycle === 'annual' ? 'annuale' : 'mensile'})`
                          : language === 'fr'
                            ? `Renouvellement automatique le ${nextRenewalDate.toLocaleDateString('fr-FR')} (${activeBillingCycle === 'annual' ? 'annuel' : 'mensuel'})`
                            : language === 'de'
                              ? `Automatische Verlängerung am ${nextRenewalDate.toLocaleDateString('de-DE')} (${activeBillingCycle === 'annual' ? 'jährlich' : 'monatlich'})`
                              : `Renovação automática em ${nextRenewalDate.toLocaleDateString('pt-PT')} (${activeBillingCycle === 'annual' ? 'anual' : 'mensal'})`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {PAYMENT_GATEWAY_ENABLED && userProfile?.stripeCustomerId && (
                    <button
                      onClick={handleOpenBillingPortal}
                      disabled={checkoutLoading}
                      className="text-xs font-mono px-3 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-orange-500/40 transition-colors disabled:opacity-50"
                    >
                      {language === 'es' ? 'Gestionar suscripción' : language === 'en' ? 'Manage subscription' : language === 'it' ? 'Gestisci abbonamento' : language === 'fr' ? "Gérer l'abonnement" : language === 'de' ? 'Abo verwalten' : 'Gerir subscrição'}
                    </button>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                    <Zap className="w-7 h-7 stroke-[2.5]" />
                  </div>
                </div>
              </div>

              {pendingPlanChange && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <p className="text-xs text-amber-300 font-medium">
                    {language === 'es'
                      ? <>Tu plan cambiará a <strong>{plansById[pendingPlanChange.planId]?.name || pendingPlanChange.planId}</strong> ({pendingPlanChange.billingCycle === 'annual' ? 'anual' : 'mensual'}) el <strong>{new Date(pendingPlanChange.effectiveAt).toLocaleDateString('es-ES')}</strong>. Sin devoluciones ni prorrateos.</>
                      : language === 'en'
                        ? <>Your plan will change to <strong>{plansById[pendingPlanChange.planId]?.name || pendingPlanChange.planId}</strong> ({pendingPlanChange.billingCycle === 'annual' ? 'annual' : 'monthly'}) on <strong>{new Date(pendingPlanChange.effectiveAt).toLocaleDateString('en-US')}</strong>. No refunds or prorated credits.</>
                        : language === 'it'
                          ? <>Il tuo piano cambierà in <strong>{plansById[pendingPlanChange.planId]?.name || pendingPlanChange.planId}</strong> il <strong>{new Date(pendingPlanChange.effectiveAt).toLocaleDateString('it-IT')}</strong>.</>
                          : language === 'fr'
                            ? <>Votre plan changera pour <strong>{plansById[pendingPlanChange.planId]?.name || pendingPlanChange.planId}</strong> ({pendingPlanChange.billingCycle === 'annual' ? 'annuel' : 'mensuel'}) le <strong>{new Date(pendingPlanChange.effectiveAt).toLocaleDateString('fr-FR')}</strong>. Aucun remboursement ni prorata.</>
                            : language === 'de'
                              ? <>Dein Plan wechselt zu <strong>{plansById[pendingPlanChange.planId]?.name || pendingPlanChange.planId}</strong> ({pendingPlanChange.billingCycle === 'annual' ? 'jährlich' : 'monatlich'}) am <strong>{new Date(pendingPlanChange.effectiveAt).toLocaleDateString('de-DE')}</strong>. Keine Rückerstattungen oder anteiligen Gutschriften.</>
                              : <>O teu plano vai mudar para <strong>{plansById[pendingPlanChange.planId]?.name || pendingPlanChange.planId}</strong> ({pendingPlanChange.billingCycle === 'annual' ? 'anual' : 'mensal'}) em <strong>{new Date(pendingPlanChange.effectiveAt).toLocaleDateString('pt-PT')}</strong>. Sem reembolsos nem valores proporcionais.</>}
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelPendingPlanChange}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
                  >
                    {language === 'es' ? 'Cancelar cambio' : language === 'en' ? 'Cancel change' : language === 'it' ? 'Annulla' : language === 'fr' ? "Annuler le changement" : language === 'de' ? 'Änderung abbrechen' : 'Cancelar alteração'}
                  </button>
                </div>
              )}

              {/* Barra de Consumo de Recursos del Plan */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">
                    {language === 'es' ? 'Vehículos en Garaje' : language === 'en' ? 'Garage Vehicles' : language === 'it' ? 'Veicoli nel Garage' : language === 'fr' ? 'Véhicules au Garage' : language === 'de' ? 'Fahrzeuge in der Garage' : 'Veículos na Garagem'}
                  </span>
                  <span className="font-mono font-bold text-orange-400">
                    {vehicles.length} / {maxVehiclesAllowed === Infinity ? 'Ilimitados' : maxVehiclesLabel}
                  </span>
                </div>
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="bg-orange-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (vehicles.length / (maxVehiclesAllowed === Infinity ? 100 : maxVehiclesAllowed)) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Selector de Periodo: Mensual / Anual (-20%) */}
              <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300 pl-2">
                  {language === 'es' ? 'Frecuencia de Facturación' : language === 'en' ? 'Billing Cycle' : language === 'it' ? 'Ciclo di fatturazione' : language === 'fr' ? 'Cycle de Facturation' : language === 'de' ? 'Abrechnungszyklus' : 'Ciclo de Faturação'}
                </span>
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      billingCycle === 'monthly' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {language === 'es' ? 'Mensual' : language === 'en' ? 'Monthly' : language === 'it' ? 'Mensile' : language === 'fr' ? 'Mensuel' : language === 'de' ? 'Monatlich' : 'Mensal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                      billingCycle === 'annual' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{language === 'es' ? 'Anual' : language === 'en' ? 'Annual' : language === 'it' ? 'Annuale' : language === 'fr' ? 'Annuel' : language === 'de' ? 'Jährlich' : 'Anual'}</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">-20%</span>
                  </button>
                </div>
              </div>

              {/* TABLA COMPARATIVA DE PLANES SAAS (configurados dinámicamente desde el Backoffice) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {plans.filter(plan => plan.active !== false || plan.id === currentPlan).map(plan => {
                  const isCurrent = currentPlan === plan.id && billingCycle === activeBillingCycle;
                  const isPendingTarget = pendingPlanChange?.planId === plan.id && pendingPlanChange?.billingCycle === billingCycle;
                  const isDiscontinued = plan.active === false;
                  const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
                  const planMaxVeh = plan.maxVehicles === -1 ? '∞' : plan.maxVehicles;
                  const isPaidLocked = !PAYMENT_GATEWAY_ENABLED && !isCurrent && (plan.priceMonthly || 0) > 0;
                  return (
                    <div key={plan.id} className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 transition-all relative ${
                      isCurrent
                        ? 'bg-orange-500/10 border-orange-500 shadow-xl'
                        : 'bg-zinc-950/60 border-zinc-800'
                    }`}>
                      {plan.highlight && !isDiscontinued && (
                        <span className="absolute -top-2.5 right-4 bg-orange-500 text-white text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full shadow">
                          {language === 'es' ? 'Más Popular' : language === 'en' ? 'Most Popular' : language === 'it' ? 'Più Popolare' : language === 'fr' ? 'Le Plus Populaire' : language === 'de' ? 'Am Beliebtesten' : 'Mais Popular'}
                        </span>
                      )}
                      {isDiscontinued && (
                        <span className="absolute -top-2.5 right-4 bg-zinc-700 text-zinc-300 text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full shadow">
                          {language === 'es' ? 'Descontinuado' : language === 'en' ? 'Discontinued' : language === 'it' ? 'Interrotto' : language === 'fr' ? 'Discontinué' : language === 'de' ? 'Eingestellt' : 'Descontinuado'}
                        </span>
                      )}
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{plan.name}</h4>
                        <div className="mt-3">
                          {price > 0 ? (
                            <>
                              <span className="text-xl font-extrabold text-white font-mono">{price.toFixed(2)} €</span>
                              <span className="text-[10px] text-zinc-500 font-mono"> / {language === 'es' ? 'mes' : language === 'en' ? 'mo' : language === 'it' ? 'mese' : language === 'fr' ? 'mois' : language === 'de' ? 'Monat' : 'mês'}</span>
                            </>
                          ) : (
                            <span className="text-xl font-extrabold text-white font-mono">
                              {language === 'es' ? 'Gratis' : language === 'en' ? 'Free' : language === 'it' ? 'Gratis' : language === 'fr' ? 'Gratuit' : language === 'de' ? 'Kostenlos' : 'Grátis'}
                            </span>
                          )}
                        </div>
                        <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                          <li className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span><strong>{planMaxVeh === '∞' ? (language === 'es' ? 'Vehículos Ilimitados' : language === 'en' ? 'Unlimited Vehicles' : language === 'it' ? 'Veicoli Illimitati' : language === 'fr' ? 'Véhicules Illimités' : language === 'de' ? 'Unbegrenzte Fahrzeuge' : 'Veículos Ilimitados') : `${language === 'es' ? 'Hasta' : language === 'en' ? 'Up to' : language === 'it' ? 'Fino a' : language === 'fr' ? "Jusqu'à" : language === 'de' ? 'Bis zu' : 'Até'} ${planMaxVeh} ${t('vehicles')}`}</strong></span>
                          </li>
                          {getLocalizedPlanList(plan.features, language).map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || isDiscontinued || isPendingTarget}
                        onClick={() => handlePlanSelection(plan.id, billingCycle)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                          isCurrent || isPendingTarget
                            ? 'bg-zinc-800 text-zinc-400 cursor-default'
                            : isDiscontinued
                              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                              : isPaidLocked
                                ? 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-orange-500/40'
                                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                        }`}
                      >
                        {isCurrent
                          ? (language === 'es' ? 'Plan Actual' : language === 'en' ? 'Current Plan' : language === 'it' ? 'Piano Attuale' : language === 'fr' ? 'Plan Actuel' : language === 'de' ? 'Aktueller Plan' : 'Plano Atual')
                          : isPendingTarget
                            ? (language === 'es' ? 'Programado' : language === 'en' ? 'Scheduled' : language === 'it' ? 'Pianificato' : language === 'fr' ? 'Programmé' : language === 'de' ? 'Geplant' : 'Agendado')
                            : isPaidLocked
                              ? (language === 'es' ? '🔒 Solicitar a Soporte' : language === 'en' ? '🔒 Request from Support' : language === 'it' ? '🔒 Richiedi al Supporto' : language === 'fr' ? '🔒 Demander au Support' : language === 'de' ? '🔒 Beim Support Anfragen' : '🔒 Pedir ao Suporte')
                              : (language === 'es' ? `Seleccionar ${plan.name}` : language === 'en' ? `Select ${plan.name}` : language === 'it' ? `Seleziona ${plan.name}` : language === 'fr' ? `Sélectionner ${plan.name}` : language === 'de' ? `${plan.name} Auswählen` : `Selecionar ${plan.name}`)}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Aviso legal requerido por la normativa de consumidores de la UE: al contratar un plan de pago,
                  el usuario acepta el inicio inmediato del servicio digital y renuncia al derecho de
                  desistimiento de 14 días en la parte ya disfrutada (ver Términos y Condiciones, punto 4). */}
              {PAYMENT_GATEWAY_ENABLED && (
                <p className="text-[11px] text-zinc-500 pt-1">
                  {language === 'es'
                    ? <>Al contratar un plan de pago aceptas los <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Términos y Condiciones</a> y la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Política de Privacidad</a>, incluido el inicio inmediato del servicio y la renuncia al derecho de desistimiento de 14 días una vez accedas al plan.</>
                    : language === 'en'
                    ? <>By subscribing to a paid plan you accept the <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Terms and Conditions</a> and <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Privacy Policy</a>, including immediate service start and waiver of the 14-day withdrawal right once you access the plan.</>
                    : language === 'it'
                    ? <>Sottoscrivendo un piano a pagamento accetti i <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Termini e Condizioni</a> e l'<a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Informativa sulla Privacy</a>, incluso l'avvio immediato del servizio e la rinuncia al diritto di recesso di 14 giorni una volta effettuato l'accesso al piano.</>
                    : language === 'fr'
                    ? <>En souscrivant à un plan payant, vous acceptez les <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Conditions Générales</a> et la <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Politique de Confidentialité</a>, y compris le démarrage immédiat du service et la renonciation au droit de rétractation de 14 jours dès l'accès au plan.</>
                    : language === 'de'
                    ? <>Mit dem Abschluss eines kostenpflichtigen Plans akzeptierst du die <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Allgemeinen Geschäftsbedingungen</a> und die <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Datenschutzerklärung</a>, einschließlich des sofortigen Diensteginns und des Verzichts auf das 14-tägige Widerrufsrecht nach Zugriff auf den Plan.</>
                    : <>Ao subscrever um plano pago aceitas os <a href="https://mygarageops.com/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Termos e Condições</a> e a <a href="https://mygarageops.com/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Política de Privacidade</a>, incluindo o início imediato do serviço e a renúncia ao direito de resolução de 14 dias assim que acederes ao plano.</>}
                </p>
              )}

              {/* El acceso a facturas y su descarga en PDF se hace desde el botón "Gestionar suscripción" de
                  arriba, que abre el Portal de Facturación real de Stripe (incluye historial de facturas). */}
              {PAYMENT_GATEWAY_ENABLED && !userProfile?.stripeCustomerId && (
                <p className="text-xs text-zinc-500 pt-1">
                  {language === 'es'
                    ? 'Cuando contrates un plan de pago podrás gestionar tu suscripción y descargar tus facturas desde aquí.'
                    : language === 'en'
                    ? 'Once you subscribe to a paid plan, you\'ll be able to manage your subscription and download invoices here.'
                    : language === 'it'
                    ? 'Quando sottoscrivi un piano a pagamento potrai gestire il tuo abbonamento e scaricare le fatture da qui.'
                    : language === 'fr'
                    ? "Une fois abonné à un plan payant, vous pourrez gérer votre abonnement et télécharger vos factures ici."
                    : language === 'de'
                    ? 'Sobald du einen kostenpflichtigen Plan abonnierst, kannst du hier dein Abo verwalten und Rechnungen herunterladen.'
                    : 'Assim que subscreveres um plano pago, poderás gerir a tua subscrição e descarregar as tuas faturas aqui.'}
                </p>
              )}
            </div>

            {/* SECTOR: MIS PAGOS — historial de facturación propio del usuario (altas, pagos, cambios, bajas) */}
            {myTransactions.length > 0 && (() => {
              const MY_TX_TYPE_LABELS = {
                alta: {
                  es: 'Alta', en: 'Sign-up', it: 'Attivazione', fr: 'Inscription', de: 'Anmeldung', pt: 'Adesão',
                  className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                },
                pago: {
                  es: 'Pago', en: 'Payment', it: 'Pagamento', fr: 'Paiement', de: 'Zahlung', pt: 'Pagamento',
                  className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                },
                modificacion: {
                  es: 'Cambio de plan', en: 'Plan change', it: 'Cambio piano', fr: 'Changement de plan', de: 'Tarifwechsel', pt: 'Mudança de plano',
                  className: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                },
                baja: {
                  es: 'Baja', en: 'Cancellation', it: 'Cancellazione', fr: 'Résiliation', de: 'Kündigung', pt: 'Cancelamento',
                  className: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                },
                pago_fallido: {
                  es: 'Pago fallido', en: 'Payment failed', it: 'Pagamento fallito', fr: 'Paiement échoué', de: 'Zahlung fehlgeschlagen', pt: 'Pagamento falhado',
                  className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }
              };
              const formatDateTime = (d) => {
                if (!d?.seconds) return '—';
                return new Date(d.seconds * 1000).toLocaleDateString(
                  language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : language === 'it' ? 'it-IT' : language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : 'pt-PT',
                  { day: '2-digit', month: 'short', year: 'numeric' }
                );
              };
              return (
              <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {language === 'es' ? 'Mis Pagos' : language === 'en' ? 'My Payments' : language === 'it' ? 'I Miei Pagamenti' : language === 'fr' ? 'Mes Paiements' : language === 'de' ? 'Meine Zahlungen' : 'Os Meus Pagamentos'}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {language === 'es'
                        ? 'Historial de tu facturación en MyGarageOps.'
                        : language === 'en'
                        ? 'Your billing history on MyGarageOps.'
                        : language === 'it'
                        ? 'La cronologia di fatturazione su MyGarageOps.'
                        : language === 'fr'
                        ? "Votre historique de facturation sur MyGarageOps."
                        : language === 'de'
                        ? 'Dein Abrechnungsverlauf auf MyGarageOps.'
                        : 'O teu histórico de faturação no MyGarageOps.'}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-500 border-b border-zinc-800">
                        <th className="pb-2 pr-3 font-medium">{language === 'es' ? 'Fecha' : language === 'en' ? 'Date' : language === 'it' ? 'Data' : language === 'fr' ? 'Date' : language === 'de' ? 'Datum' : 'Data'}</th>
                        <th className="pb-2 pr-3 font-medium">{language === 'es' ? 'Evento' : language === 'en' ? 'Event' : language === 'it' ? 'Evento' : language === 'fr' ? 'Événement' : language === 'de' ? 'Ereignis' : 'Evento'}</th>
                        <th className="pb-2 pr-3 font-medium">{language === 'es' ? 'Plan' : language === 'en' ? 'Plan' : language === 'it' ? 'Piano' : language === 'fr' ? 'Plan' : language === 'de' ? 'Plan' : 'Plano'}</th>
                        <th className="pb-2 pr-3 font-medium">{language === 'es' ? 'Importe' : language === 'en' ? 'Amount' : language === 'it' ? 'Importo' : language === 'fr' ? 'Montant' : language === 'de' ? 'Betrag' : 'Montante'}</th>
                        <th className="pb-2 font-medium">{language === 'es' ? 'Recibo' : language === 'en' ? 'Receipt' : language === 'it' ? 'Ricevuta' : language === 'fr' ? 'Reçu' : language === 'de' ? 'Beleg' : 'Recibo'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTransactions.map(tx => {
                        const typeInfo = MY_TX_TYPE_LABELS[tx.type];
                        return (
                          <tr key={tx.id} className="border-b border-zinc-800/60">
                            <td className="py-2.5 pr-3 text-zinc-400 font-mono whitespace-nowrap">{formatDateTime(tx.createdAt)}</td>
                            <td className="py-2.5 pr-3">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${typeInfo?.className || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                                {typeInfo?.[language] || typeInfo?.es || tx.type}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-zinc-300">{tx.planName || '—'}</td>
                            <td className="py-2.5 pr-3 text-zinc-200 font-mono">{tx.amount != null ? `${tx.amount.toFixed(2)} ${(tx.currency || 'eur').toUpperCase()}` : '—'}</td>
                            <td className="py-2.5">
                              {tx.hostedInvoiceUrl ? (
                                <a
                                  href={tx.hostedInvoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-bold"
                                >
                                  {language === 'es' ? 'Ver' : language === 'en' ? 'View' : language === 'it' ? 'Vedi' : language === 'fr' ? 'Voir' : language === 'de' ? 'Ansehen' : 'Ver'} <ArrowUpRight className="w-3 h-3" />
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            {/* SECTOR: COPIAS DE SEGURIDAD & EXPORTACIÓN/IMPORTACIÓN JSON Y CSV */}
            <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {t('backupSection')}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {t('backupDesc')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="p-3.5 rounded-2xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                >
                  <span>💾 {t('exportJson')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="p-3.5 rounded-2xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                >
                  <span>📊 {t('exportCsv')}</span>
                </button>
                <label className="p-3.5 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-400 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm">
                  <span>📥 {t('importJson')}</span>
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 6: BACKOFFICE DE ADMINISTRACIÓN SAAS */}
        {activeTab === 'admin' && isSuperAdmin && (() => {
          const totalVehicles = Object.values(vehicleCountsByUser).reduce((a, b) => a + b, 0);
          const avgVehicles = allUsersList.length > 0 ? (totalVehicles / allUsersList.length).toFixed(1) : 0;
          const adminUsersCount = allUsersList.filter(u => u.role === 'admin').length;
          const { paidUsers, freeUsers, conversionRate, mrr } = computePlanStats(allUsersList, plansById);

          const formatDateShort = (d) => {
            if (!d) return '—';
            const date = d instanceof Date ? d : new Date(d);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
          };

          const planBadge = (plan) => {
            const planDef = plansById[plan];
            const style = PLAN_COLOR_STYLES[planDef?.badgeColor] || PLAN_COLOR_STYLES[DEFAULT_PLAN_COLOR];
            const label = planDef?.name || plan;
            return <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${style.badge}`}>{label}</span>;
          };

          return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                    Panel de SuperAdmin
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
                  🛡️ Backoffice de Administración
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Control global de usuarios, estado de suscripciones y métricas de plataforma.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert('Generando informe global en CSV...')}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-orange-400" />
                  <span>Exportar Reporte</span>
                </button>
              </div>
            </div>

            {/* TARJETAS BENTO KPI ADMIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900/80 p-4 rounded-3xl border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>Usuarios Totales</span>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-black text-white font-mono">{allUsersList.length}</p>
                <span className="text-[10px] text-zinc-500 font-mono">{paidUsers} de pago · {freeUsers} free{adminUsersCount > 0 ? ` · ${adminUsersCount} admin` : ''}</span>
              </div>

              <div className="bg-zinc-900/80 p-4 rounded-3xl border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>Vehículos en Plataforma</span>
                  <Bike className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-black text-white font-mono">{totalVehicles}</p>
                <span className="text-[10px] text-zinc-500 font-mono">Promedio: {avgVehicles} veh/usr</span>
              </div>

              <div className="bg-zinc-900/80 p-4 rounded-3xl border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>MRR Estimado</span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-emerald-400 font-mono">{mrr.toFixed(2)} €</p>
                <span className="text-[10px] text-zinc-400 font-mono">Ingresos Recurrentes</span>
              </div>

              <div className="bg-zinc-900/80 p-4 rounded-3xl border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>Conversión a Pago</span>
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-2xl font-black text-white font-mono">{conversionRate} %</p>
                <span className="text-[10px] text-purple-400 font-mono">Planes De Pago</span>
              </div>
            </div>

            {/* TOGGLE SUB-PESTAÑAS: USUARIOS / PLANES */}
            <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800 w-fit">
              <button
                onClick={() => setAdminSubTab('users')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminSubTab === 'users' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Usuarios
              </button>
              <button
                onClick={() => setAdminSubTab('plans')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminSubTab === 'plans' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Planes
              </button>
              <button
                onClick={() => setAdminSubTab('transactions')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminSubTab === 'transactions' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Transacciones
              </button>
            </div>

            {/* DIRECTORIO DE USUARIOS — Listado limpio, clickable */}
            {adminSubTab === 'users' && (
            <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-400" />
                    <span>Directorio de Usuarios ({allUsersList.length})</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Haz clic en un usuario para gestionar su cuenta.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por email..."
                      value={adminUserSearch}
                      onChange={(e) => setAdminUserSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500"
                    />
                  </div>
                  <select
                    value={adminUserSort}
                    onChange={(e) => setAdminUserSort(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500 shrink-0"
                  >
                    <option value="alpha">A-Z</option>
                    <option value="registered">Fecha de alta</option>
                    <option value="lastLogin">Última conexión</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                {allUsersList
                  .filter(u => u.email.toLowerCase().includes(adminUserSearch.toLowerCase()))
                  .sort((a, b) => {
                    if (adminUserSort === 'registered') return (b.registered?.getTime() || 0) - (a.registered?.getTime() || 0);
                    if (adminUserSort === 'lastLogin') return (b.lastLogin?.getTime() || 0) - (a.lastLogin?.getTime() || 0);
                    return a.email.localeCompare(b.email);
                  })
                  .map((u) => {
                    const vehCount = vehicleCountsByUser[u.id] || 0;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedAdminUser(u)}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-950/50 border border-zinc-800/60 hover:border-orange-500/40 hover:bg-zinc-900/80 transition-all cursor-pointer group"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          u.role === 'admin'
                            ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                        }`}>
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">{u.email}</span>
                            {u.role === 'admin' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">ADMIN</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-500">
                            <span>{planBadge(u.plan)}</span>
                            <span className="font-mono">{vehCount} veh.</span>
                            <span className="hidden sm:inline">Alta: {formatDateShort(u.registered)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 transition-colors" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            )}

            {/* GESTIÓN DE PLANES */}
            {adminSubTab === 'plans' && (() => {
              const usersCountByPlan = allUsersList.reduce((acc, u) => {
                acc[u.plan] = (acc[u.plan] || 0) + 1;
                return acc;
              }, {});
              return (
              <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-400" />
                      <span>Planes de Suscripción ({plans.length})</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Configura nombres, precios y límites de vehículos.</p>
                  </div>
                  <button
                    onClick={() => {
                      setPlanEditLang('es');
                      setEditingPlan({
                        name: '', priceMonthly: 0, priceAnnual: 0, maxVehicles: 2, unlimited: false,
                        badgeColor: 'zinc', highlight: false, taglineByLang: {}, featuresTextByLang: {}, isDefaultSignup: false, active: true
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Crear Plan
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plans.map(plan => {
                    const style = PLAN_COLOR_STYLES[plan.badgeColor] || PLAN_COLOR_STYLES[DEFAULT_PLAN_COLOR];
                    const usersOnPlan = usersCountByPlan[plan.id] || 0;
                    const isDiscontinued = plan.active === false;
                    return (
                      <div key={plan.id} className={`p-4 rounded-2xl border space-y-3 ${style.ring} bg-zinc-950/60 ${isDiscontinued ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${style.badge}`}>{plan.name}</span>
                          <div className="flex items-center gap-1.5">
                            {isDiscontinued && (
                              <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-700/30 px-1.5 py-0.5 rounded border border-zinc-700">DESCONTINUADO</span>
                            )}
                            {plan.isDefaultSignup && (
                              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">POR DEFECTO</span>
                            )}
                          </div>
                        </div>
                        <div className="text-lg font-black text-white font-mono">
                          {plan.priceMonthly > 0 ? `${plan.priceMonthly.toFixed(2)} € / mes` : 'Gratis'}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {plan.priceAnnual > 0 ? `${plan.priceAnnual.toFixed(2)} € / mes (anual)` : '—'}
                        </div>
                        <div className="text-xs text-zinc-300">
                          Límite: <strong>{plan.maxVehicles === -1 ? 'Ilimitado' : `${plan.maxVehicles} vehículos`}</strong>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">{usersOnPlan} usuario{usersOnPlan !== 1 ? 's' : ''} en este plan</div>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <button
                            onClick={() => {
                              setPlanEditLang('es');
                              const taglineByLang = {};
                              const featuresTextByLang = {};
                              for (const lang of PLAN_LANGUAGES) {
                                taglineByLang[lang] = getLocalizedPlanText(plan.tagline, lang);
                                featuresTextByLang[lang] = getLocalizedPlanList(plan.features, lang).join('\n');
                              }
                              setEditingPlan({
                                ...plan,
                                taglineByLang,
                                featuresTextByLang,
                                unlimited: plan.maxVehicles === -1
                              });
                            }}
                            className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'plans', plan.id), {
                                  active: isDiscontinued,
                                  isDefaultSignup: isDiscontinued ? plan.isDefaultSignup : false,
                                  updatedAt: serverTimestamp()
                                });
                              } catch (err) {
                                console.error('Error al cambiar estado del plan:', err);
                              }
                            }}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                              isDiscontinued
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                            }`}
                            title={isDiscontinued ? 'Reactivar plan' : 'Descontinuar: ya no se ofrecerá a nuevos usuarios, pero los actuales lo conservan'}
                          >
                            {isDiscontinued ? 'Reactivar' : 'Descontinuar'}
                          </button>
                          {usersOnPlan === 0 && (
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  title: '¿Eliminar Plan?',
                                  message: `¿Seguro que deseas eliminar el plan "${plan.name}"? Esta acción no se puede deshacer.`,
                                  onConfirm: async () => {
                                    try {
                                      await deleteDoc(doc(db, 'plans', plan.id));
                                    } catch (err) {
                                      console.error('Error al eliminar plan:', err);
                                    }
                                  }
                                });
                              }}
                              className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all"
                              title="Eliminar permanentemente (sin usuarios asignados)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* HISTÓRICO DE TRANSACCIONES DE STRIPE — altas, modificaciones y bajas de suscripción */}
            {adminSubTab === 'transactions' && (() => {
              const TX_TYPE_LABELS = {
                alta: { label: 'Alta', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                pago: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                modificacion: { label: 'Modificación', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
                baja: { label: 'Baja', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                pago_fallido: { label: 'Pago fallido', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
              };
              const CANCELLATION_REASON_LABELS = {
                cancellation_requested: 'Cancelado por el cliente',
                payment_disputed: 'Pago disputado',
                payment_failed: 'Pago fallido'
              };
              const filteredTransactions = transactions
                .filter(tx => transactionTypeFilter === 'all' || tx.type === transactionTypeFilter)
                .filter(tx => (tx.email || '').toLowerCase().includes(transactionSearch.toLowerCase()));
              const formatDateTime = (d) => {
                if (!d?.seconds) return '—';
                return new Date(d.seconds * 1000).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              };
              return (
              <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-400" />
                      <span>Transacciones ({filteredTransactions.length})</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Altas, modificaciones y bajas de suscripción sincronizadas desde Stripe.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por email..."
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500"
                      />
                    </div>
                    <select
                      value={transactionTypeFilter}
                      onChange={(e) => setTransactionTypeFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500 shrink-0"
                    >
                      <option value="all">Todos los eventos</option>
                      <option value="alta">Altas</option>
                      <option value="pago">Pagos</option>
                      <option value="modificacion">Modificaciones</option>
                      <option value="baja">Bajas</option>
                      <option value="pago_fallido">Pagos fallidos</option>
                    </select>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">No hay transacciones registradas todavía.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-zinc-500 border-b border-zinc-800">
                          <th className="pb-2 pr-3 font-medium">Fecha</th>
                          <th className="pb-2 pr-3 font-medium">Usuario</th>
                          <th className="pb-2 pr-3 font-medium">Evento</th>
                          <th className="pb-2 pr-3 font-medium">Plan</th>
                          <th className="pb-2 pr-3 font-medium">Importe</th>
                          <th className="pb-2 pr-3 font-medium">Método</th>
                          <th className="pb-2 pr-3 font-medium">Estado</th>
                          <th className="pb-2 font-medium">Recibo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map(tx => {
                          const typeInfo = TX_TYPE_LABELS[tx.type] || { label: tx.type || '—', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
                          const previousPlanName = tx.previousPlanId ? (plansById[tx.previousPlanId]?.name || tx.previousPlanId) : null;
                          return (
                            <tr key={tx.id} className="border-b border-zinc-800/60 hover:bg-zinc-950/50">
                              <td className="py-2.5 pr-3 text-zinc-400 font-mono whitespace-nowrap">{formatDateTime(tx.createdAt)}</td>
                              <td className="py-2.5 pr-3 text-zinc-200 truncate max-w-[200px]">{tx.email || tx.uid}</td>
                              <td className="py-2.5 pr-3">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${typeInfo.className}`}>{typeInfo.label}</span>
                              </td>
                              <td className="py-2.5 pr-3 text-zinc-300">
                                {previousPlanName && <span className="text-zinc-500">{previousPlanName} → </span>}
                                {tx.planName || tx.planId || '—'}{tx.billingCycle ? ` (${tx.billingCycle === 'annual' ? 'anual' : 'mensual'})` : ''}
                              </td>
                              <td className="py-2.5 pr-3 text-zinc-200 font-mono">{tx.amount != null ? `${tx.amount.toFixed(2)} ${(tx.currency || 'eur').toUpperCase()}` : '—'}</td>
                              <td className="py-2.5 pr-3 text-zinc-400 font-mono whitespace-nowrap">
                                {tx.cardBrand ? `${tx.cardBrand.toUpperCase()} •••• ${tx.cardLast4}` : '—'}
                              </td>
                              <td className="py-2.5 pr-3 text-zinc-400 font-mono">
                                {tx.status || '—'}
                                {tx.cancellationReason && (
                                  <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                                    {CANCELLATION_REASON_LABELS[tx.cancellationReason] || tx.cancellationReason}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5">
                                {tx.hostedInvoiceUrl ? (
                                  <a
                                    href={tx.hostedInvoiceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-bold"
                                  >
                                    Ver <ArrowUpRight className="w-3 h-3" />
                                  </a>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
          );
        })()}

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

      {/* MODAL: GESTIÓN COMPLETA DE USUARIO */}
      {selectedAdminUser && (() => {
        const u = selectedAdminUser;
        const vehCount = vehicleCountsByUser[u.id] || 0;

        const fmtDate = (d) => {
          if (!d) return '—';
          const date = d instanceof Date ? d : new Date(d);
          return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        };
        const fmtDateTime = (d) => {
          if (!d) return '—';
          const date = d instanceof Date ? d : new Date(d);
          return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        };

        const handleSaveRole = async (newRole) => {
          try {
            await updateDoc(doc(db, 'users', u.id), { role: newRole, updatedAt: serverTimestamp() });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, role: newRole } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, role: newRole } : prev);
            setNoticeModal({ title: 'Rol Actualizado', message: `${u.email} ahora es ${newRole.toUpperCase()}.`, type: 'success' });
          } catch (err) {
            console.error('Error al cambiar rol:', err);
            setNoticeModal({ title: 'Error', message: 'No se pudo cambiar el rol.', type: 'warning' });
          }
        };

        const handleSavePlan = async (newPlan) => {
          try {
            // Un cambio manual de plan desde el Backoffice es inmediato y cancela cualquier cambio programado por el usuario
            await updateDoc(doc(db, 'users', u.id), {
              plan: newPlan,
              planStartDate: serverTimestamp(),
              pendingPlanChange: null,
              updatedAt: serverTimestamp()
            });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, plan: newPlan, pendingPlanChange: null } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, plan: newPlan, pendingPlanChange: null } : prev);
            setNoticeModal({ title: 'Plan Actualizado', message: `${u.email} → ${plansById[newPlan]?.name || newPlan}`, type: 'success' });
          } catch (err) {
            console.error('Error al cambiar plan:', err);
            setNoticeModal({ title: 'Error', message: 'No se pudo cambiar el plan.', type: 'warning' });
          }
        };

        // Cancela, desde el Backoffice, un cambio de plan programado por el propio usuario (sin tocar su plan actual)
        const handleCancelUserPendingChange = async () => {
          try {
            await updateDoc(doc(db, 'users', u.id), { pendingPlanChange: null, updatedAt: serverTimestamp() });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, pendingPlanChange: null } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, pendingPlanChange: null } : prev);
            setNoticeModal({ title: 'Cambio Cancelado', message: `Se canceló el cambio de plan programado de ${u.email}.`, type: 'success' });
          } catch (err) {
            console.error('Error al cancelar el cambio de plan programado:', err);
            setNoticeModal({ title: 'Error', message: 'No se pudo cancelar el cambio programado.', type: 'warning' });
          }
        };

        // Aplica de inmediato el cambio de plan que el usuario tenía programado para su próxima renovación
        const handleApplyUserPendingChangeNow = async () => {
          const pending = u.pendingPlanChange;
          if (!pending) return;
          try {
            await updateDoc(doc(db, 'users', u.id), {
              plan: pending.planId,
              billingCycle: pending.billingCycle || 'monthly',
              planStartDate: serverTimestamp(),
              pendingPlanChange: null,
              updatedAt: serverTimestamp()
            });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, plan: pending.planId, billingCycle: pending.billingCycle || 'monthly', pendingPlanChange: null } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, plan: pending.planId, billingCycle: pending.billingCycle || 'monthly', pendingPlanChange: null } : prev);
            setNoticeModal({ title: 'Cambio Aplicado', message: `${u.email} → ${plansById[pending.planId]?.name || pending.planId} aplicado de inmediato.`, type: 'success' });
          } catch (err) {
            console.error('Error al aplicar el cambio de plan programado:', err);
            setNoticeModal({ title: 'Error', message: 'No se pudo aplicar el cambio programado.', type: 'warning' });
          }
        };

        const handleGiftPass = async (plan, days) => {
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + days);
          try {
            await updateDoc(doc(db, 'users', u.id), {
              plan: plan,
              giftDays: days,
              giftPlanExpiry: expiry.toISOString(),
              updatedAt: serverTimestamp()
            });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, plan, giftDays: days, giftPlanExpiry: expiry.toISOString() } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, plan, giftDays: days, giftPlanExpiry: expiry.toISOString() } : prev);
            setNoticeModal({ title: '🎁 Pase Otorgado', message: `${plansById[plan]?.name || plan} por ${days} días a ${u.email}. Expira: ${fmtDate(expiry)}`, type: 'success' });
          } catch (err) {
            console.error('Error al otorgar pase:', err);
          }
        };

        const handleRevokePass = async () => {
          try {
            await updateDoc(doc(db, 'users', u.id), {
              plan: defaultPlanId,
              giftDays: 0,
              giftPlanExpiry: null,
              updatedAt: serverTimestamp()
            });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, plan: defaultPlanId, giftDays: 0, giftPlanExpiry: null } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, plan: defaultPlanId, giftDays: 0, giftPlanExpiry: null } : prev);
            setNoticeModal({ title: 'Pase Revocado', message: `${u.email} → ${(plansById[defaultPlanId]?.name || defaultPlanId).toUpperCase()}. Se ha revocado el acceso premium.`, type: 'success' });
          } catch (err) {
            console.error('Error al revocar pase:', err);
          }
        };

        const handleToggleStatus = async () => {
          const newStatus = u.status === 'active' ? 'suspended' : 'active';
          try {
            await updateDoc(doc(db, 'users', u.id), { status: newStatus, updatedAt: serverTimestamp() });
            setAllUsersList(prev => prev.map(item => item.id === u.id ? { ...item, status: newStatus } : item));
            setSelectedAdminUser(prev => prev ? { ...prev, status: newStatus } : prev);
          } catch (err) {
            console.error('Error al cambiar estado:', err);
          }
        };

        return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900 rounded-3xl border border-zinc-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            {/* Cabecera */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 rounded-t-3xl z-10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                    u.role === 'admin'
                      ? 'bg-orange-500/15 border-2 border-orange-500/40 text-orange-400'
                      : 'bg-zinc-800 border-2 border-zinc-700 text-zinc-300'
                  }`}>
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">{u.email}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                        u.role === 'admin' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>{u.role.toUpperCase()}</span>
                      <span className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className="text-[10px] text-zinc-500 font-mono">{u.status === 'active' ? 'Activo' : 'Suspendido'}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAdminUser(null)}
                  className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm"
                >✕</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Datos del usuario */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Vehículos</span>
                  <p className="text-lg font-black text-white font-mono">{vehCount}</p>
                </div>
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Fecha Alta</span>
                  <p className="text-xs font-bold text-zinc-300 font-mono">{fmtDate(u.registered)}</p>
                </div>
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Última Conexión</span>
                  <p className="text-xs font-bold text-zinc-300 font-mono">{fmtDateTime(u.lastLogin)}</p>
                </div>
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Días Pase</span>
                  <p className="text-lg font-black text-amber-400 font-mono">{u.giftDays || '—'}</p>
                  {u.giftPlanExpiry && <span className="text-[9px] text-zinc-500 font-mono">Exp: {fmtDate(u.giftPlanExpiry)}</span>}
                </div>
              </div>

              {/* Plan & Suscripción */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Plan & Suscripción
                </h4>
                {u.pendingPlanChange && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 justify-between">
                    <p className="text-xs text-amber-300 font-medium">
                      Cambio programado a <strong>{plansById[u.pendingPlanChange.planId]?.name || u.pendingPlanChange.planId}</strong> ({u.pendingPlanChange.billingCycle === 'annual' ? 'anual' : 'mensual'}) el{' '}
                      <strong>{new Date(u.pendingPlanChange.effectiveAt).toLocaleDateString('es-ES')}</strong>.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleApplyUserPendingChangeNow}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      >
                        Aplicar ahora
                      </button>
                      <button
                        onClick={handleCancelUserPendingChange}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
                      >
                        Cancelar cambio
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {plans.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSavePlan(p.id)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                        u.plan === p.id
                          ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-sm'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                      }`}
                    >
                      {p.name} ({p.priceMonthly.toFixed(2)}€)
                    </button>
                  ))}
                </div>
              </div>

              {/* Acciones de Pase / Regalar Pase */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    🎁 Regalar / Gestionar Pase Temporal
                  </h4>
                  {u.giftDays > 0 && (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Pase Activo: {u.giftDays} días ({plansById[u.plan]?.name || u.plan})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Plan a Regalar</label>
                    <select
                      value={giftPlanInput}
                      onChange={(e) => setGiftPlanInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                    >
                      {plans.filter(p => p.priceMonthly > 0 && p.active !== false).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.maxVehicles === -1 ? (language === 'es' ? 'Vehículos Ilimitados' : language === 'en' ? 'Unlimited Vehicles' : language === 'it' ? 'Veicoli Illimitati' : language === 'fr' ? 'Véhicules Illimités' : language === 'de' ? 'Unbegrenzte Fahrzeuge' : 'Veículos Ilimitados') : `${language === 'es' ? 'Hasta' : language === 'en' ? 'Up to' : language === 'it' ? 'Fino a' : language === 'fr' ? "Jusqu'à" : language === 'de' ? 'Bis zu' : 'Até'} ${p.maxVehicles} ${t('vehicles')}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Duración (Días Personalizados)</label>
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      placeholder="Ej: 30"
                      value={giftDaysInput}
                      onChange={(e) => setGiftDaysInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                    />
                  </div>
                </div>

                {/* Presets rápidos de días */}
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Duración Rápida</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '7 Días', days: '7' },
                      { label: '1 Mes (30d)', days: '30' },
                      { label: '3 Meses (90d)', days: '90' },
                      { label: '1 Año (365d)', days: '365' }
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setGiftDaysInput(opt.days)}
                        className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                          giftDaysInput === opt.days 
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const days = parseInt(giftDaysInput) || 30;
                      handleGiftPass(giftPlanInput, days);
                    }}
                    className="w-full sm:flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>🎁 Otorgar Pase ({giftDaysInput || 30} días - {giftPlanInput.toUpperCase()})</span>
                  </button>

                  {u.giftDays > 0 && (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          const newDays = (u.giftDays || 0) + 7;
                          handleGiftPass(u.plan, newDays);
                        }}
                        title="Extender pase +7 días"
                        className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95"
                      >
                        +7d
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newDays = Math.max(1, (u.giftDays || 0) - 7);
                          handleGiftPass(u.plan, newDays);
                        }}
                        title="Acortar pase -7 días"
                        className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all active:scale-95"
                      >
                        -7d
                      </button>
                    </div>
                  )}
                </div>

                {u.plan !== defaultPlanId && (
                  <button
                    type="button"
                    onClick={handleRevokePass}
                    className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    🚫 Revocar Pase → Volver a {plansById[defaultPlanId]?.name || defaultPlanId}
                  </button>
                )}
              </div>

              {/* Administración */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-orange-400" /> Administración
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSaveRole(u.role === 'admin' ? 'user' : 'admin')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      u.role === 'admin'
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                        : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {u.role === 'admin' ? 'Quitar rol Admin → User' : 'Promover a Admin'}
                  </button>
                  <button
                    onClick={handleToggleStatus}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      u.status === 'active'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {u.status === 'active' ? '⏸️ Suspender Cuenta' : '▶️ Reactivar Cuenta'}
                  </button>
                  <button
                    onClick={() => {
                      setNoticeModal({
                        title: 'Restablecer Contraseña',
                        message: `Se ha enviado un correo oficial a ${u.email} con el enlace seguro para restablecer su contraseña.`,
                        type: 'info'
                      });
                    }}
                    className="py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    🔑 Reset Contraseña
                  </button>
                  <button
                    onClick={() => {
                      setInspectingUser(u);
                      setSelectedAdminUser(null);
                      setActiveTab('dashboard');
                    }}
                    className="py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    👁️ Inspeccionar Cuenta
                  </button>
                </div>
              </div>

              {/* Zona peligrosa */}
              <div className="border-t border-zinc-800 pt-4">
                <button
                  onClick={() => {
                    setSelectedAdminUser(null);
                    handleDeleteUser(u);
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar Usuario Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-zinc-400 font-medium mb-1">Fecha</label>
                  <input 
                    type="date" 
                    value={newMaintenanceForm.date}
                    onChange={(e) => setNewMaintenanceForm({ ...newMaintenanceForm, date: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 outline-none focus:border-orange-500 font-mono" 
                  />
                </div>
              </div>

              {/* Selector opcional de repuesto del inventario */}
              <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-orange-400 font-bold uppercase tracking-wider">📦 Descontar Repuesto de Inventario (Opcional)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select 
                      value={newMaintenanceForm.selectedPartId}
                      onChange={(e) => {
                        const partIdStr = e.target.value;
                        if (!partIdStr) {
                          setNewMaintenanceForm({ ...newMaintenanceForm, selectedPartId: '' });
                          return;
                        }
                        const pObj = parts.find(p => String(p.id) === String(partIdStr));
                        const activeBatch = pObj && pObj.purchases ? pObj.purchases.find(b => b.qty > 0) : null;
                        const unitPrice = activeBatch ? activeBatch.pricePerUnit : 0;
                        const qtyNum = parseFloat(newMaintenanceForm.partQty) || 1;
                        const calculatedCost = unitPrice > 0 ? (unitPrice * qtyNum) : 0;
                        setNewMaintenanceForm({ 
                          ...newMaintenanceForm, 
                          selectedPartId: partIdStr,
                          partsCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : newMaintenanceForm.partsCost
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                    >
                      <option value="">-- Sin descontar repuesto del inventario --</option>
                      {parts
                        .map(p => {
                          const purchases = p.purchases || [];
                          const rawStock = purchases.reduce((sum, b) => sum + (b.qty || 0), 0);
                          const totalStock = parseFloat(rawStock.toFixed(3));
                          const activeBatch = purchases.find(b => b.qty > 0);
                          const unitPrice = activeBatch ? activeBatch.pricePerUnit : 0;

                          const isCurrentSelected = String(p.id) === String(newMaintenanceForm.selectedPartId);

                          return (
                            <option key={p.id} value={String(p.id)} disabled={totalStock <= 0 && !isCurrentSelected}>
                              {p.name} (Stock: {totalStock} {p.unit || 'ud'} | {unitPrice > 0 ? `${unitPrice.toFixed(2)} €/${p.unit || 'ud'}` : 'Sin precio'}) {totalStock <= 0 ? '- ¡AGOTADO!' : ''}
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
                      placeholder={(() => {
                        const pObj = parts.find(p => String(p.id) === String(newMaintenanceForm.selectedPartId));
                        return `Cant. (1.00 ${pObj?.unit || 'ud'})`;
                      })()}
                      value={newMaintenanceForm.partQty}
                      onChange={(e) => {
                        const qtyStr = e.target.value;
                        const qtyNum = parseFloat(qtyStr) || 0;
                        const pObj = parts.find(p => String(p.id) === String(newMaintenanceForm.selectedPartId));
                        const activeBatch = pObj && pObj.purchases ? pObj.purchases.find(b => b.qty > 0) : null;
                        const unitPrice = activeBatch ? activeBatch.pricePerUnit : 0;
                        const calculatedCost = unitPrice > 0 && qtyNum > 0 ? (unitPrice * qtyNum) : 0;
                        setNewMaintenanceForm({
                          ...newMaintenanceForm,
                          partQty: qtyStr,
                          partsCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : newMaintenanceForm.partsCost
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Desglose Económico */}
              <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider block">Desglose de Costes</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 text-[11px] mb-1">Coste Piezas (€)</label>
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
                    <label className="block text-zinc-400 text-[11px] mb-1">Mano de Obra (€)</label>
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

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  {editingMaintenanceId ? 'Guardar Cambios en Registro' : 'Guardar Registro Completo'}
                </button>
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
                      <label className="block text-zinc-400 text-[11px] mb-1">Precio Unitario (€)</label>
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

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95">
                  {editingPartId ? 'Guardar Cambios' : 'Registrar Repuesto y Compra'}
                </button>
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
                  <label className="block text-zinc-400 font-medium mb-1">Precio Unitario (€)</label>
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

      {/* MODAL: CREAR / EDITAR PLAN DE SUSCRIPCIÓN */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <h3 className="font-extrabold text-base text-white tracking-tight">
              {editingPlan.id ? `Editar ${editingPlan.name}` : 'Crear Plan Nuevo'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium"
                  placeholder="Ej: DIY Garage"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Precio mensual (€)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={editingPlan.priceMonthly}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, priceMonthly: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Precio anual (€/mes)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={editingPlan.priceAnnual}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, priceAnnual: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              {PAYMENT_GATEWAY_ENABLED && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Stripe Price ID (mensual)</label>
                    <input
                      type="text"
                      value={editingPlan.stripePriceIdMonthly || ''}
                      onChange={(e) => setEditingPlan(prev => ({ ...prev, stripePriceIdMonthly: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                      placeholder="price_..."
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Stripe Price ID (anual)</label>
                    <input
                      type="text"
                      value={editingPlan.stripePriceIdAnnual || ''}
                      onChange={(e) => setEditingPlan(prev => ({ ...prev, stripePriceIdAnnual: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono"
                      placeholder="price_..."
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-zinc-400 font-medium mb-1">
                  <input
                    type="checkbox"
                    checked={!!editingPlan.unlimited}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, unlimited: e.target.checked }))}
                    className="accent-orange-500"
                  />
                  Vehículos ilimitados
                </label>
                {!editingPlan.unlimited && (
                  <input
                    type="number" min="0"
                    value={editingPlan.maxVehicles}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, maxVehicles: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-mono mt-1"
                    placeholder="Límite de vehículos"
                  />
                )}
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Color del badge</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(PLAN_COLOR_STYLES).map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingPlan(prev => ({ ...prev, badgeColor: color }))}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold ${PLAN_COLOR_STYLES[color].badge} ${
                        editingPlan.badgeColor === color ? 'ring-2 ring-white/60' : ''
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <label className="block text-zinc-400 font-medium">Traducciones (frase descriptiva y características)</label>
                <div className="flex flex-wrap gap-1.5">
                  {PLAN_LANGUAGES.map(lang => {
                    const hasContent = !!(editingPlan.taglineByLang?.[lang]?.trim() || editingPlan.featuresTextByLang?.[lang]?.trim());
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setPlanEditLang(lang)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase transition-all ${
                          planEditLang === lang
                            ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                            : `border-zinc-800 hover:border-zinc-700 ${hasContent ? 'text-zinc-300' : 'text-zinc-600'}`
                        }`}
                      >
                        {lang}{!hasContent && ' ○'}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={editingPlan.taglineByLang?.[planEditLang] || ''}
                  onChange={(e) => setEditingPlan(prev => ({
                    ...prev,
                    taglineByLang: { ...prev.taglineByLang, [planEditLang]: e.target.value }
                  }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500"
                  placeholder="Frase descriptiva, debajo del nombre"
                />

                <textarea
                  value={editingPlan.featuresTextByLang?.[planEditLang] || ''}
                  onChange={(e) => setEditingPlan(prev => ({
                    ...prev,
                    featuresTextByLang: { ...prev.featuresTextByLang, [planEditLang]: e.target.value }
                  }))}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 outline-none focus:border-orange-500 font-medium resize-none"
                  placeholder={'Características (una por línea)\nAlertas de mantenimiento\nGestión de repuestos\nSoporte prioritario'}
                />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-zinc-400 font-medium">
                  <input
                    type="checkbox"
                    checked={!!editingPlan.highlight}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, highlight: e.target.checked }))}
                    className="accent-orange-500"
                  />
                  Destacar ("Más Popular")
                </label>
                <label className="flex items-center gap-2 text-zinc-400 font-medium">
                  <input
                    type="checkbox"
                    checked={editingPlan.active !== false}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, active: e.target.checked, isDefaultSignup: e.target.checked ? prev.isDefaultSignup : false }))}
                    className="accent-orange-500"
                  />
                  Plan activo (visible para nuevos registros)
                </label>
                <label className={`flex items-center gap-2 font-medium ${editingPlan.active === false ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  <input
                    type="checkbox"
                    checked={!!editingPlan.isDefaultSignup}
                    disabled={editingPlan.active === false}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, isDefaultSignup: e.target.checked }))}
                    className="accent-orange-500"
                  />
                  Plan por defecto para nuevos registros
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-zinc-700/70 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePlanConfig}
                className="py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition-all active:scale-95"
              >
                Guardar Plan
              </button>
            </div>
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

      {/* MODAL PERSONALIZADO DE PREVISUALIZACIÓN DE FOTO A PANTALLA COMPLETA */}
      {photoPreviewModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-zinc-900 rounded-3xl border border-zinc-800 p-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-2">
                <span>📷</span> {photoPreviewModal.title}
              </h3>
              <button 
                type="button"
                onClick={() => setPhotoPreviewModal(null)} 
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-hidden rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-800/80">
              <img 
                src={photoPreviewModal.url} 
                alt={photoPreviewModal.title} 
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE DE AYUDA: reabre el tour de bienvenida cuando se quiera */}
      <button
        type="button"
        onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }}
        aria-label={t('onboardingHelpAria')}
        title={t('onboardingHelpAria')}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-6 right-[max(1rem,env(safe-area-inset-right))] md:right-6 w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 text-orange-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 shadow-2xl shadow-black/40 flex items-center justify-center transition-all active:scale-95 z-40"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* TOUR DE BIENVENIDA: aparece solo la primera vez (o al pulsar el botón de ayuda) */}
      {showOnboarding && (
        <OnboardingTour step={onboardingStep} setStep={setOnboardingStep} onClose={closeOnboarding} t={t} />
      )}

    </div>
  );
}
