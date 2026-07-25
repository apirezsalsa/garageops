import React, { useState } from 'react';
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
  Edit2
} from 'lucide-react';

// --- MOCK DATA MEJORADO ---
const INITIAL_VEHICLES = [
  { 
    id: 1, 
    name: 'KTM 450 EXC-F', 
    category: 'Enduro • Por Horas', 
    icon: '🏍️', 
    usage: '48.5 hrs', 
    usageNum: 48.5,
    unit: 'hrs',
    nextService: '50 hrs',
    status: 'warning', 
    statusText: 'Mantenimiento preventivo en 1.5 hrs',
    accentColor: 'from-amber-500/20 to-orange-500/5',
    borderColor: 'border-amber-500/30'
  },
  { 
    id: 2, 
    name: 'BMW R 1250 GS', 
    category: 'Maxitrail • Por Km', 
    icon: '🌍', 
    usage: '24,350 km', 
    usageNum: 24350,
    unit: 'km',
    nextService: '30,000 km',
    status: 'ok', 
    statusText: 'Al día',
    accentColor: 'from-emerald-500/10 to-teal-500/5',
    borderColor: 'border-emerald-500/30'
  },
  { 
    id: 3, 
    name: 'Toyota Hilux 4x4', 
    category: 'Soporte • Por Km', 
    icon: '🛻', 
    usage: '112,000 km', 
    usageNum: 112000,
    unit: 'km',
    nextService: '110,000 km',
    status: 'danger', 
    statusText: 'Revisión Vencida (+2,000 km)',
    accentColor: 'from-rose-500/20 to-red-500/5',
    borderColor: 'border-rose-500/30'
  },
];

const INITIAL_MAINTENANCES = [
  { id: 101, vehicle: 'KTM 450 EXC-F', title: 'Filtro de Aire & Aceite Motorex 10W50', date: '10 Jul 2026', cost: '45.00 €', type: 'Preventivo', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { id: 102, vehicle: 'BMW R 1250 GS', title: 'Neumático Trasero Metzeler Tourance Next 2', date: '28 Jun 2026', cost: '185.00 €', type: 'Repuesto', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 103, vehicle: 'Toyota Hilux 4x4', title: 'Pastillas de Freno Brembo + Líquido DOT4', date: '15 May 2026', cost: '92.50 €', type: 'Correctivo', badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

const INITIAL_PARTS = [
  { 
    id: 201, 
    name: 'Filtro Aceite Motorex 10W50', 
    compatibleVehicles: ['KTM 450 EXC-F', 'Ktm exc 300cc 2027'], 
    minStock: 2,
    purchases: [
      { id: 1, qty: 2, pricePerUnit: 14.50, date: '2026-06-10', supplier: 'Motosport Pro' },
      { id: 2, qty: 1, pricePerUnit: 12.90, date: '2026-07-01', supplier: 'Amazon EU' }
    ]
  },
  { 
    id: 202, 
    name: 'Bujía NGK LMAR9AI-10 Dual Spk', 
    compatibleVehicles: ['BMW R 1250 GS'], 
    minStock: 2,
    purchases: [
      { id: 1, qty: 1, pricePerUnit: 18.00, date: '2026-05-15', supplier: 'Motorrad Shop' }
    ]
  },
  { 
    id: 203, 
    name: 'Aceite 15W40 Sintético Flotas (5L)', 
    compatibleVehicles: ['Toyota Hilux 4x4', 'BMW R 1250 GS'], 
    minStock: 1,
    purchases: [
      { id: 1, qty: 2, pricePerUnit: 38.00, date: '2026-04-20', supplier: 'Recambios Calidad' }
    ]
  },
];

// Función para procesar, recortar al centro en cuadrado (1:1) y optimizar fotos del usuario
const optimizeImageFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const CROP_SIZE = 500; // Recorte cuadrado 1:1 optimizado para iconos y fotos

        canvas.width = CROP_SIZE;
        canvas.height = CROP_SIZE;
        const ctx = canvas.getContext('2d');

        // Calcular recorte central (Center Crop 1:1)
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, CROP_SIZE, CROP_SIZE);

        // Convertir a WebP ligero a 80% calidad
        const dataUrl = canvas.toDataURL('image/webp', 0.80);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// --- DICCIONARIO DE TRADUCCIONES MULTI-IDIOMA (i18n) ---
const TRANSLATIONS = {
  es: {
    dashboard: 'Dashboard',
    garage: 'Garaje',
    parts: 'Repuestos',
    history: 'Historial Mantenimiento',
    settings: 'Ajustes & Suscripción',
    activePlan: 'Plan Activo',
    vehicles: 'Vehículos',
    activeAlerts: 'Alertas Activas',
    partsStock: 'Stock Repuestos',
    totalSpent: 'Gasto Acumulado',
    profileTitle: 'Perfil & Ajustes',
    profileSub: 'Configuración de idioma, cuenta y plan de suscripción.',
    appLang: 'Idioma de la Aplicación',
    selectLang: 'Selecciona tu idioma preferido',
    activeSub: 'Suscripción Activa',
    billingCycle: 'Frecuencia de Facturación',
    monthly: 'Mensual',
    annual: 'Anual',
    planStarterDesc: 'Para tu vehículo principal',
    planProDesc: 'Particulares con 2 a 4 vehículos',
    planUnlimitedDesc: 'Sin límites para gran garaje o taller',
    stripePortal: 'Portal de Facturación Stripe',
    downloadPdf: 'Descargar Facturas PDF',
    updateUsage: 'Actualizar Uso',
    addIntervention: '+ Registrar Intervención',
    addAlert: '+ Programar Alerta',
    deleteVehicle: 'Eliminar Vehículo',
    noAlerts: 'Sin alertas programadas.',
    backToGarage: '← Volver al Garaje',
    scheduledAlerts: 'ALERTAS PROGRAMADAS',
    vehicleHistoryTitle: 'HISTORIAL DEL VEHÍCULO',
    partsLabel: 'Piezas:',
    usage: 'Uso:',
    spent: 'Gasto:',
    changePhoto: 'Cambiar',
    photo: 'Foto',
    newAlert: '+ Nueva Alerta',
    target: 'Objetivo:',
    overdueBy: 'Superado por',
    remaining: 'Faltan',
    addAlertShort: '+ Alerta',
    updateUnit: 'Actualizar',
    allVehiclesTitle: 'GARAJE COMPLETO',
    addVehicleBtn: '+ Añadir Vehículo',
    noVehiclesMsg: 'No tienes vehículos registrados en tu garaje.',
    partsTitle: 'INVENTARIO DE REPUESTOS',
    addPartBtn: '+ Registrar Repuesto',
    historyTitle: 'HISTORIAL GLOBAL DE INTERVENCIONES',
    byKm: 'Por Km',
    byHours: 'Por Horas',
    maintByKm: 'Mantenimiento por Km',
    maintByHours: 'Mantenimiento por Horas',
    exportPdfBtn: 'Exportar Certificado PDF',
    backupSection: 'Copias de Seguridad & Datos',
    backupDesc: 'Guarda o restaura tus datos en JSON / CSV',
    exportJson: 'Exportar Backup JSON',
    exportCsv: 'Exportar Mantenimientos (CSV)',
    importJson: 'Restaurar Backup JSON',
    analyticsTitle: 'Desglose Financiero del Garaje',
    laborCost: 'Mano de Obra',
    partsCostLabel: 'Recambios & Piezas',
    notificationsTitle: 'Notificaciones Activas de Garaje'
  },
  en: {
    dashboard: 'Dashboard',
    garage: 'Garage',
    parts: 'Parts & Stock',
    history: 'Maintenance History',
    settings: 'Settings & Plan',
    activePlan: 'Active Plan',
    vehicles: 'Vehicles',
    activeAlerts: 'Active Alerts',
    partsStock: 'Parts Inventory',
    totalSpent: 'Total Spent',
    profileTitle: 'Profile & Settings',
    profileSub: 'Language, account, and subscription plan settings.',
    appLang: 'App Language',
    selectLang: 'Select your preferred language',
    activeSub: 'Active Subscription',
    billingCycle: 'Billing Cycle',
    monthly: 'Monthly',
    annual: 'Annual',
    planStarterDesc: 'For your daily ride',
    planProDesc: 'DIYers with 2 to 4 vehicles',
    planUnlimitedDesc: 'No limits for large garage',
    stripePortal: 'Stripe Billing Portal',
    downloadPdf: 'Download Invoices PDF',
    updateUsage: 'Update Usage',
    addIntervention: '+ Add Service Record',
    addAlert: '+ Schedule Alert',
    deleteVehicle: 'Delete Vehicle',
    noAlerts: 'No scheduled alerts.',
    backToGarage: '← Back to Garage',
    scheduledAlerts: 'SCHEDULED ALERTS',
    vehicleHistoryTitle: 'VEHICLE SERVICE HISTORY',
    partsLabel: 'Parts:',
    usage: 'Usage:',
    spent: 'Cost:',
    changePhoto: 'Change',
    photo: 'Photo',
    newAlert: '+ New Alert',
    target: 'Target:',
    overdueBy: 'Overdue by',
    remaining: 'Remaining',
    addAlertShort: '+ Alert',
    updateUnit: 'Update',
    allVehiclesTitle: 'FULL GARAGE',
    addVehicleBtn: '+ Add Vehicle',
    noVehiclesMsg: 'No vehicles registered in your garage yet.',
    addFirstVehicle: 'Add my first vehicle',
    partsTitle: 'PARTS INVENTORY',
    addPartBtn: '+ Add Part',
    historyTitle: 'GLOBAL SERVICE HISTORY',
    byKm: 'By Distance (Km)',
    byHours: 'By Hours',
    maintByKm: 'Service by Km',
    maintByHours: 'Service by Hours',
    exportPdfBtn: 'Export PDF Certificate',
    backupSection: 'Data Backup & Restore',
    backupDesc: 'Export or import your garage data via JSON / CSV',
    exportJson: 'Export JSON Backup',
    exportCsv: 'Export Services (CSV)',
    importJson: 'Restore JSON Backup',
    analyticsTitle: 'Garage Financial Breakdown',
    laborCost: 'Labor Cost',
    partsCostLabel: 'Parts & Supplies',
    notificationsTitle: 'Active Garage Notifications'
  },
  it: {
    dashboard: 'Dashboard',
    garage: 'Garage',
    parts: 'Ricambi',
    history: 'Cronologia Manutenzione',
    settings: 'Impostazioni & Piano',
    activePlan: 'Piano Attivo',
    vehicles: 'Veicoli',
    activeAlerts: 'Avvisi Attivi',
    partsStock: 'Scorta Ricambi',
    totalSpent: 'Spesa Totale',
    profileTitle: 'Profilo & Impostazioni',
    profileSub: 'Lingua, conto e impostazioni del piano di abbonamento.',
    appLang: 'Lingua dell\'applicazione',
    selectLang: 'Seleziona la tua lingua preferita',
    activeSub: 'Abbonamento Attivo',
    billingCycle: 'Ciclo di fatturazione',
    monthly: 'Mensile',
    annual: 'Annuale',
    planStarterDesc: 'Per il tuo veicolo principale',
    planProDesc: 'Appassionati con 2-4 veicoli',
    planUnlimitedDesc: 'Senza limiti per grandi garage',
    stripePortal: 'Portale di fatturazione Stripe',
    downloadPdf: 'Scarica fatture PDF',
    updateUsage: 'Aggiorna Lettura',
    addIntervention: '+ Aggiungi Intervento',
    addAlert: '+ Pianifica Avviso',
    deleteVehicle: 'Elimina Veicolo',
    noAlerts: 'Nessun avviso pianificato.',
    backToGarage: '← Torna al Garage',
    scheduledAlerts: 'AVVISI PIANIFICATI',
    vehicleHistoryTitle: 'CRONOLOGIA DEL VEICOLO',
    partsLabel: 'Ricambi:',
    usage: 'Uso:',
    spent: 'Spesa:',
    changePhoto: 'Cambia',
    photo: 'Foto',
    newAlert: '+ Nuovo Avviso',
    target: 'Obiettivo:',
    overdueBy: 'Superato di',
    remaining: 'Mancano',
    addAlertShort: '+ Avviso',
    updateUnit: 'Aggiorna',
    allVehiclesTitle: 'GARAGE COMPLETO',
    addVehicleBtn: '+ Aggiungi Veicolo',
    noVehiclesMsg: 'Nessun veicolo registrato nel tuo garage.',
    addFirstVehicle: 'Aggiungi il mio primo veicolo',
    partsTitle: 'INVENTARIO RICAMBI',
    addPartBtn: '+ Aggiungi Ricambio',
    historyTitle: 'CRONOLOGIA INTERVENTI GLOBALE',
    byKm: 'Per Km',
    byHours: 'Per Ore',
    maintByKm: 'Manutenzione per Km',
    maintByHours: 'Manutenzione per Ore',
    exportPdfBtn: 'Esporta Certificato PDF',
    backupSection: 'Backup e Ripristino Dati',
    backupDesc: 'Esporta o importa i dati del garage tramite JSON / CSV',
    exportJson: 'Esporta Backup JSON',
    exportCsv: 'Esporta Manutenzioni (CSV)',
    importJson: 'Ripristina Backup JSON',
    analyticsTitle: 'Analisi Finanziaria del Garage',
    laborCost: 'Manodopera',
    partsCostLabel: 'Ricambi & Componenti',
    notificationsTitle: 'Notifiche Attive del Garage'
  }
};

// Función auxiliar para traducir descripciones de categoría de vehículos
const translateCategory = (categoryStr, lang) => {
  if (!categoryStr) return '';
  if (lang === 'es') return categoryStr;

  let res = categoryStr;

  if (lang === 'en') {
    res = res.replace(/Por Horas/gi, 'By Hours');
    res = res.replace(/Por Km/gi, 'By Distance (Km)');
    res = res.replace(/Mantenimiento por Km/gi, 'Maintenance by Km');
    res = res.replace(/Mantenimiento por Horas/gi, 'Maintenance by Hours');
    res = res.replace(/Soporte/gi, 'Support Vehicle');
  } else if (lang === 'it') {
    res = res.replace(/Por Horas/gi, 'Per Ore');
    res = res.replace(/Por Km/gi, 'Per Km');
    res = res.replace(/Mantenimiento por Km/gi, 'Manutenzione per Km');
    res = res.replace(/Mantenimiento por Horas/gi, 'Manutenzione per Ore');
    res = res.replace(/Soporte/gi, 'Supporto');
  }

  return res;
};

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [photoPreviewModal, setPhotoPreviewModal] = useState(null);
  
  // Estado de Autenticación de Usuario (Persistente)
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('garageops_logged_in') === 'true';
  });
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('garageops_user_email') || 'alex.mecanica@garageops.io';
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: true
  });
  const [loginError, setLoginError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      setLoginError(language === 'es' ? 'Por favor completa todos los campos' : 'Please complete all fields');
      return;
    }
    if (loginForm.password.length < 4) {
      setLoginError(language === 'es' ? 'La contraseña debe tener al menos 4 caracteres' : 'Password must be at least 4 characters');
      return;
    }
    setUserEmail(loginForm.email);
    setIsLoggedIn(true);
    setLoginError('');
    if (loginForm.rememberMe) {
      localStorage.setItem('garageops_logged_in', 'true');
      localStorage.setItem('garageops_user_email', loginForm.email);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('garageops_logged_in');
  };

  // Persistencia local (localStorage)
  const [vehicles, setVehicles] = useState(() => {
    const saved = localStorage.getItem('garageops_vehicles');
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  const [maintenances, setMaintenances] = useState(() => {
    const saved = localStorage.getItem('garageops_maintenances');
    return saved ? JSON.parse(saved) : INITIAL_MAINTENANCES;
  });

  const [parts, setParts] = useState(() => {
    const saved = localStorage.getItem('garageops_parts');
    if (!saved) return INITIAL_PARTS;
    try {
      const parsed = JSON.parse(saved);
      return parsed.map(p => ({
        ...p,
        compatibleVehicles: p.compatibleVehicles || (p.vehicle ? [p.vehicle] : ['Universal']),
        purchases: p.purchases && Array.isArray(p.purchases) ? p.purchases : (
          p.stock > 0 ? [{ id: Date.now(), qty: p.stock, pricePerUnit: parseFloat(p.price) || 0, supplier: 'Anterior', date: '2026-07-25' }] : []
        )
      }));
    } catch (e) {
      return INITIAL_PARTS;
    }
  });

  // Guardar automáticamente en localStorage cuando haya cambios
  React.useEffect(() => {
    localStorage.setItem('garageops_vehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  React.useEffect(() => {
    localStorage.setItem('garageops_maintenances', JSON.stringify(maintenances));
  }, [maintenances]);

  React.useEffect(() => {
    localStorage.setItem('garageops_parts', JSON.stringify(parts));
  }, [parts]);

  // Reconciliación de stock: aplica deducciones pendientes de mantenimientos anteriores (one-shot)
  React.useEffect(() => {
    const reconciled = localStorage.getItem('garageops_stock_reconciled_v2');
    if (reconciled) return;

    // Recopilar todas las deducciones que deberían haberse hecho
    const deductions = {}; // { partId: totalQtyToDeduct }
    maintenances.forEach(m => {
      if (m.usedPartId && m.usedPartQty) {
        const pid = String(m.usedPartId);
        const qty = parseFloat(m.usedPartQty) || 0;
        if (qty > 0) {
          deductions[pid] = (deductions[pid] || 0) + qty;
        }
      }
    });

    if (Object.keys(deductions).length === 0) {
      localStorage.setItem('garageops_stock_reconciled_v2', 'true');
      return;
    }

    // Aplicar deducciones FIFO sobre los lotes de compra
    setParts(prevParts => prevParts.map(p => {
      const pid = String(p.id);
      if (!deductions[pid] || !p.purchases || p.purchases.length === 0) return p;

      let qtyToDeduct = deductions[pid];
      const updatedPurchases = p.purchases.map(batch => {
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

      return { ...p, purchases: updatedPurchases };
    }));

    localStorage.setItem('garageops_stock_reconciled_v2', 'true');
  }, []); // Solo se ejecuta una vez al montar

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

  // Estado de Plan SaaS Activo y Frecuencia de Facturación
  const [currentPlan, setCurrentPlan] = useState(() => {
    return localStorage.getItem('garageops_plan') || 'pro';
  });

  const [billingCycle, setBillingCycle] = useState('monthly');

  React.useEffect(() => {
    localStorage.setItem('garageops_plan', currentPlan);
  }, [currentPlan]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showAddMaintenanceModal, setShowAddMaintenanceModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showKmModal, setShowKmModal] = useState(null);
  const [newKmValue, setNewKmValue] = useState('');

  // Estado para Modal de Alertas Programadas por Vehículo
  const [showAlertModal, setShowAlertModal] = useState(null); // guarda el vehículo target
  const [newAlertForm, setNewAlertForm] = useState({
    title: '',
    targetUsage: '',
    advanceNotice: '5' // umbral de aviso previo (ej: avisa 5 hrs / 500 km antes)
  });

  const handleAddVehicleAlert = (e) => {
    e.preventDefault();
    if (!showAlertModal || !newAlertForm.title || !newAlertForm.targetUsage) return;

    const targetVal = parseFloat(newAlertForm.targetUsage);
    const advanceVal = parseFloat(newAlertForm.advanceNotice) || 0;

    if (isNaN(targetVal)) return;

    const alertItem = {
      id: Date.now(),
      title: newAlertForm.title,
      targetUsage: targetVal,
      advanceNotice: advanceVal
    };

    setVehicles(prev => prev.map(v => {
      if (v.id === showAlertModal.id) {
        const updatedAlerts = [...(v.alerts || []), alertItem];
        return {
          ...v,
          alerts: updatedAlerts
        };
      }
      return v;
    }));

    if (selectedVehicle && selectedVehicle.id === showAlertModal.id) {
      setSelectedVehicle(prev => ({
        ...prev,
        alerts: [...(prev.alerts || []), alertItem]
      }));
    }

    setShowAlertModal(null);
    setNewAlertForm({ title: '', targetUsage: '', advanceNotice: '5' });
  };

  const handleDeleteVehicleAlert = (vehicleId, alertId) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === vehicleId) {
        const updatedAlerts = (v.alerts || []).filter(a => a.id !== alertId);
        return {
          ...v,
          alerts: updatedAlerts
        };
      }
      return v;
    }));

    if (selectedVehicle && selectedVehicle.id === vehicleId) {
      setSelectedVehicle(prev => ({
        ...prev,
        alerts: (prev.alerts || []).filter(a => a.id !== alertId)
      }));
    }
  };

  // Form State para Nuevo Vehículo
  const [newVehicleForm, setNewVehicleForm] = useState({
    name: '',
    category: 'Mantenimiento por Km',
    unit: 'km',
    icon: '🏍️',
    photo: '',
    usageNum: ''
  });

  const handleCreateVehicle = (e) => {
    e.preventDefault();
    if (!newVehicleForm.name) return;

    const newVehicle = {
      id: Date.now(),
      name: newVehicleForm.name,
      category: `${newVehicleForm.category}`,
      icon: newVehicleForm.icon,
      photo: newVehicleForm.photo || null,
      usage: `${newVehicleForm.usageNum || 0} ${newVehicleForm.unit}`,
      usageNum: parseFloat(newVehicleForm.usageNum) || 0,
      unit: newVehicleForm.unit,
      nextService: `Próximo servicio`,
      status: 'ok',
      statusText: 'Al día',
      accentColor: 'from-emerald-500/10 to-teal-500/5',
      borderColor: 'border-emerald-500/30'
    };

    setVehicles(prev => [newVehicle, ...prev]);
    setShowAddVehicleModal(false);
    setNewVehicleForm({ name: '', category: 'Mantenimiento por Km', unit: 'km', icon: '🏍️', photo: '', usageNum: '' });
  };

  const handleUpdateKm = (e) => {
    e.preventDefault();
    if (!showKmModal) return;

    const newNum = parseFloat(newKmValue) || 0;

    setVehicles(prev => prev.map(v => {
      if (v.id === showKmModal.id) {
        return {
          ...v,
          usage: `${newNum} ${v.unit}`,
          usageNum: newNum
        };
      }
      return v;
    }));

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
      onConfirm: () => {
        setVehicles(prev => prev.filter(item => item.id !== vehicleId));
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
      onConfirm: () => {
        setMaintenances(prev => prev.filter(item => item.id !== maintId));
      }
    });
  };

  const requestDeletePart = (partId) => {
    const p = parts.find(item => item.id === partId);
    setConfirmModal({
      title: '¿Eliminar Repuesto?',
      message: `¿Seguro que deseas eliminar el repuesto "${p?.name || 'esta pieza'}" del inventario?`,
      onConfirm: () => {
        setParts(prev => prev.filter(item => item.id !== partId));
      }
    });
  };

  // Estado para Modal de Repuestos (Crear/Editar) y Lotes de Compra
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPartId, setEditingPartId] = useState(null);
  const [partSearch, setPartSearch] = useState('');
  const [selectedPartForBatches, setSelectedPartForBatches] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(null);

  const [newPartForm, setNewPartForm] = useState({
    name: '',
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

  const handleCreateOrUpdatePart = (e) => {
    e.preventDefault();
    if (!newPartForm.name) return;

    const minStockNum = parseInt(newPartForm.minStock) || 0;

    if (editingPartId) {
      setParts(prev => prev.map(p => {
        if (p.id === editingPartId) {
          return {
            ...p,
            name: newPartForm.name,
            compatibleVehicles: newPartForm.compatibleVehicles.length > 0 ? newPartForm.compatibleVehicles : ['Universal'],
            minStock: minStockNum
          };
        }
        return p;
      }));
    } else {
      const initialQtyNum = parseInt(newPartForm.initialQty) || 0;
      const initialPriceNum = parseFloat(newPartForm.initialPrice) || 0;

      const initialPurchase = initialQtyNum > 0 ? [{
        id: Date.now(),
        qty: initialQtyNum,
        pricePerUnit: initialPriceNum,
        supplier: newPartForm.initialSupplier || 'Taller / Tienda',
        date: newPartForm.initialDate || '2026-07-25'
      }] : [];

      const newPart = {
        id: Date.now(),
        name: newPartForm.name,
        compatibleVehicles: newPartForm.compatibleVehicles.length > 0 ? newPartForm.compatibleVehicles : ['Universal'],
        minStock: minStockNum,
        purchases: initialPurchase
      };

      setParts(prev => [newPart, ...prev]);
    }

    setShowAddPartModal(false);
    setEditingPartId(null);
    setNewPartForm({
      name: '',
      compatibleVehicles: [],
      minStock: '1',
      initialQty: '1',
      initialPrice: '',
      initialSupplier: '',
      initialDate: '2026-07-25'
    });
  };

  const handleAddPurchaseBatch = (e) => {
    e.preventDefault();
    if (!showBatchModal) return;

    const qtyNum = parseInt(newBatchForm.qty) || 1;
    const priceNum = parseFloat(newBatchForm.pricePerUnit) || 0;

    const newBatch = {
      id: Date.now(),
      qty: qtyNum,
      pricePerUnit: priceNum,
      supplier: newBatchForm.supplier || 'Proveedor Local',
      date: newBatchForm.date || '2026-07-25'
    };

    setParts(prev => prev.map(p => {
      if (p.id === showBatchModal.id) {
        return {
          ...p,
          purchases: [newBatch, ...(p.purchases || [])]
        };
      }
      return p;
    }));

    setShowBatchModal(null);
    setNewBatchForm({ qty: '1', pricePerUnit: '', supplier: '', date: '2026-07-25' });
  };

  const handleEditPart = (p) => {
    setEditingPartId(p.id);
    setNewPartForm({
      name: p.name,
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

  const handleCreateOrUpdateMaintenance = (e) => {
    e.preventDefault();
    if (!newMaintenanceForm.title) return;

    const targetVehicle = newMaintenanceForm.vehicle || selectedVehicle?.name || vehicles[0]?.name;
    const currentVehObj = vehicles.find(v => v.name.toLowerCase() === targetVehicle.toLowerCase());

    // Si se seleccionó un repuesto del inventario, descontar stock de los lotes de compra (FIFO)
    if (newMaintenanceForm.selectedPartId) {
      const targetPartIdStr = String(newMaintenanceForm.selectedPartId);
      let qtyToDeduct = parseFloat(newMaintenanceForm.partQty) || 1;

      setParts(prevParts => prevParts.map(p => {
        if (String(p.id) === targetPartIdStr && p.purchases && p.purchases.length > 0) {
          const updatedPurchases = p.purchases.map(batch => {
            if (qtyToDeduct <= 0) return batch;
            if (batch.qty >= qtyToDeduct) {
              const remaining = Math.max(0, parseFloat((batch.qty - qtyToDeduct).toFixed(3)));
              qtyToDeduct = 0;
              return { ...batch, qty: remaining };
            } else {
              const remDeduct = parseFloat((qtyToDeduct - batch.qty).toFixed(3));
              qtyToDeduct = remDeduct;
              return { ...batch, qty: 0 };
            }
          }).filter(b => b.qty > 0);

          return {
            ...p,
            purchases: updatedPurchases
          };
        }
        return p;
      }));
    }

    const totalCostNum = (parseFloat(newMaintenanceForm.partsCost) || 0) + (parseFloat(newMaintenanceForm.laborCost) || 0);
    const finalCostStr = totalCostNum > 0 ? `${totalCostNum.toFixed(2)} €` : (newMaintenanceForm.partsCost || newMaintenanceForm.laborCost ? `${totalCostNum.toFixed(2)} €` : '0.00 €');

    const selectedPartObj = parts.find(p => String(p.id) === String(newMaintenanceForm.selectedPartId));

    const maintenanceData = {
      id: editingMaintenanceId || Date.now(),
      vehicle: targetVehicle,
      title: newMaintenanceForm.title,
      category: newMaintenanceForm.category,
      usageAtService: newMaintenanceForm.usageAtService ? `${newMaintenanceForm.usageAtService} ${currentVehObj?.unit || 'km'}` : currentVehObj?.usage || '',
      usedPartId: newMaintenanceForm.selectedPartId || null,
      usedPartName: selectedPartObj ? selectedPartObj.name : null,
      usedPartQty: newMaintenanceForm.partQty || '1',
      date: newMaintenanceForm.date || '25 Jul 2026',
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
      setMaintenances(prev => prev.map(m => m.id === editingMaintenanceId ? maintenanceData : m));
    } else {
      setMaintenances(prev => [maintenanceData, ...prev]);
    }

    // Si se especificó una nueva lectura de uso al hacer el servicio, actualizar la lectura del vehículo automáticamente
    if (newMaintenanceForm.usageAtService && currentVehObj) {
      const newNum = parseFloat(newMaintenanceForm.usageAtService);
      if (!isNaN(newNum)) {
        setVehicles(prev => prev.map(v => {
          if (v.id === currentVehObj.id) {
            return {
              ...v,
              usage: `${newNum} ${v.unit}`,
              usageNum: newNum
            };
          }
          return v;
        }));

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
      alert('Por favor, permite ventanas emergentes para generar el certificado PDF.');
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
          <div class="logo">GarageOps — Libro Digital de Servicio</div>
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
          Generado automáticamente por GarageOps SaaS • Mobile First Vehicle Maintenance System
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
        } catch (err) {
          alert('Error al importar archivo. Asegúrate de seleccionar un JSON válido generado por GarageOps.');
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4 selection:bg-orange-500 selection:text-white">
        <div className="w-full max-w-md space-y-6">
          {/* Logo & Marca */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 overflow-hidden border-2 border-orange-500/40 flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/20">
              <img src="/logo.png" alt="GarageOps Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">GarageOps</h1>
              <p className="text-xs text-zinc-400 mt-1">
                {language === 'es' ? 'Gestión inteligente de vehículos, repuestos y mantenimientos' : 'Smart management of vehicles, parts and maintenance'}
              </p>
            </div>
          </div>

          {/* Tarjeta Formulario Login / Registro */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <h2 className="text-lg font-bold text-white">
                {isRegisterMode ? (language === 'es' ? 'Crear Nueva Cuenta' : 'Create Account') : (language === 'es' ? 'Iniciar Sesión' : 'Sign In')}
              </h2>
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[10px]">
                {['es', 'en', 'it'].map(lang => (
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
                  {language === 'es' ? 'Correo Electrónico' : 'Email Address'}
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
                  {language === 'es' ? 'Contraseña' : 'Password'}
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
                  <span>{language === 'es' ? 'Recordar sesión' : 'Remember me'}</span>
                </label>

                <button 
                  type="button" 
                  onClick={() => alert(language === 'es' ? 'Se ha enviado un enlace de recuperación a tu correo.' : 'Password reset link sent to your email.')}
                  className="text-xs text-orange-400 hover:underline font-medium"
                >
                  {language === 'es' ? '¿Olvidaste tu clave?' : 'Forgot password?'}
                </button>
              </div>

              <button 
                type="submit" 
                className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-95 mt-2"
              >
                {isRegisterMode 
                  ? (language === 'es' ? 'Registrarse en GarageOps' : 'Register in GarageOps') 
                  : (language === 'es' ? 'Entrar a Mi Garaje' : 'Access My Garage')}
              </button>
            </form>

            {/* Alternar Registro / Login demo quick access */}
            <div className="pt-2 border-t border-zinc-800/80 text-center space-y-3">
              <p className="text-xs text-zinc-400">
                {isRegisterMode ? (
                  <>
                    {language === 'es' ? '¿Ya tienes una cuenta?' : 'Already have an account?'} {' '}
                    <button onClick={() => setIsRegisterMode(false)} className="text-orange-400 font-bold hover:underline">
                      {language === 'es' ? 'Inicia sesión' : 'Sign in'}
                    </button>
                  </>
                ) : (
                  <>
                    {language === 'es' ? '¿No tienes cuenta?' : "Don't have an account?"} {' '}
                    <button onClick={() => setIsRegisterMode(true)} className="text-orange-400 font-bold hover:underline">
                      {language === 'es' ? 'Crea una gratis' : 'Create a free one'}
                    </button>
                  </>
                )}
              </p>

              {/* Botón de Acceso Demo para Pruebas Rápidas */}
              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 text-left flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 font-bold block uppercase">{language === 'es' ? 'Acceso Rápido Demo' : 'Quick Demo Access'}</span>
                  <span className="text-xs font-semibold text-zinc-300">alex.mecanica@garageops.io</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserEmail('alex.mecanica@garageops.io');
                    setIsLoggedIn(true);
                    localStorage.setItem('garageops_logged_in', 'true');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-orange-400 font-bold text-xs border border-zinc-700 transition-all active:scale-95"
                >
                  Entrar Demo 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-orange-500 selection:text-white pb-24 md:pb-0 antialiased">
      
      {/* SIDEBAR DESKTOP (> 768px) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-800/80 bg-zinc-950 p-5 justify-between sticky top-0 h-screen shrink-0">
        <div>
          {/* Header & Logo */}
          <div className="flex items-center gap-3 px-2 py-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 overflow-hidden border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <img src="/logo.png" alt="GarageOps Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">GarageOps</h1>
              <span className="text-[10px] font-mono tracking-wider text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                {language === 'es' ? 'Gestión de Garaje' : language === 'en' ? 'Garage Management' : 'Gestione Garage'}
              </span>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="space-y-1.5">
            <NavItem icon={Home} label={t('dashboard')} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedVehicle(null); }} />
            <NavItem icon={Bike} label={t('garage')} badge={vehicles.length} active={activeTab === 'garage'} onClick={() => { setActiveTab('garage'); setSelectedVehicle(null); }} />
            <NavItem icon={Wrench} label={t('parts')} badge={parts.length} active={activeTab === 'parts'} onClick={() => { setActiveTab('parts'); setSelectedVehicle(null); }} />
            <NavItem icon={History} label={t('history')} active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setSelectedVehicle(null); }} />
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
              {currentPlan === 'starter' ? 'DIY Starter (Gratis)' : currentPlan === 'pro' ? 'DIY Garage' : 'Garage Unlimited'}
            </p>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-orange-500 h-full transition-all" 
                style={{ width: `${Math.min(100, (vehicles.length / (currentPlan === 'starter' ? 1 : currentPlan === 'pro' ? 4 : 100)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              {vehicles.length} / {currentPlan === 'starter' ? '1' : currentPlan === 'pro' ? '4' : '∞'} {t('vehicles').toLowerCase()}
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
        
        {/* Header Móvil */}
        <header className="flex md:hidden items-center justify-between pb-4 mb-5 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 overflow-hidden border border-orange-500/30 flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <img src="/logo.png" alt="GarageOps Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">GarageOps</span>
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
                    <span>{language === 'es' ? 'Control Preventivo Inteligente' : language === 'en' ? 'Smart Preventive Control' : 'Controllo Preventivo Intelligente'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {language === 'es' ? 'Estado de la Flota' : language === 'en' ? 'Fleet Status' : 'Stato del Parco'}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
                    {language === 'es' ? 'Monitoreo en tiempo real de tus vehículos, repuestos críticos e intervenciones de taller.' : language === 'en' ? 'Real-time monitoring of your vehicles, critical parts, and service records.' : 'Monitoraggio in tempo reale dei tuoi veicoli, ricambi critici e interventi di officina.'}
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
                subtitle={language === 'es' ? 'En Garaje' : language === 'en' ? 'In Garage' : 'Nel Garage'} 
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
                    subtitle={totalAlerts > 0 ? `${lowStockCount} ${language === 'es' ? 'repuestos bajos' : language === 'en' ? 'low stock parts' : 'ricambi in esaurimento'}` : (language === 'es' ? 'Todo al día' : language === 'en' ? 'All up to date' : 'Tutto aggiornato')} 
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
                    subtitle={lowStockCount > 0 ? `${lowStockCount} ${language === 'es' ? 'por reponer' : language === 'en' ? 'to order' : 'da ordinare'}` : (language === 'es' ? 'Stock suficiente' : language === 'en' ? 'Stock OK' : 'Scorta ok')} 
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
                    subtitle={language === 'es' ? 'Total intervenciones' : language === 'en' ? 'Total services' : 'Totale interventi'} 
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
                    {language === 'es' ? 'Vehículos Principales' : language === 'en' ? 'Main Vehicles' : 'Veicoli Principali'}
                  </h3>
                </div>
                <button onClick={() => setActiveTab('garage')} className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
                  {language === 'es' ? 'Ver Garaje completo' : language === 'en' ? 'View Full Garage' : 'Vedi Garage completo'} <ArrowUpRight className="w-3.5 h-3.5" />
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
                    {language === 'es' ? 'Últimas Intervenciones Registradas' : language === 'en' ? 'Recent Service Records' : 'Ultimi Interventi Registrati'}
                  </h3>
                </div>
                <button onClick={() => setActiveTab('history')} className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
                  {language === 'es' ? 'Ver Historial' : language === 'en' ? 'View History' : 'Vedi Cronologia'} <ArrowUpRight className="w-3.5 h-3.5" />
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
                        <span>{language === 'es' ? '¡Tu flota está en perfecto estado y el inventario completo!' : language === 'en' ? 'Your fleet is in perfect condition and stock is full!' : 'Il tuo parco è in perfette condizioni e la scorta è completa!'}</span>
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
                              <p className="text-[10px] text-zinc-400">{language === 'es' ? 'Stock Agotándose' : language === 'en' ? 'Low Stock Alert' : 'Ricambio in esaurimento'}</p>
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
                  <span>{language === 'es' ? 'Optimización DIY calculada' : language === 'en' ? 'Calculated DIY Savings' : 'Risparmio DIY calcolato'}</span>
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
                        {selectedVehicle.statusText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Principales */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
                <button 
                  onClick={() => {
                    setShowAlertModal(selectedVehicle);
                    setNewAlertForm({ title: '', targetUsage: '', advanceNotice: selectedVehicle.unit === 'hrs' ? '5' : '500' });
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
                    setNewAlertForm({ title: '', targetUsage: '', advanceNotice: selectedVehicle.unit === 'hrs' ? '5' : '500' });
                  }}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  {t('newAlert')}
                </button>
              </div>

              {selectedVehicle.alerts && selectedVehicle.alerts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {selectedVehicle.alerts.map(al => {
                    const current = selectedVehicle.usageNum || 0;
                    const diff = al.targetUsage - current;
                    const isDue = diff <= 0;
                    const isNear = !isDue && diff <= (al.advanceNotice || 0);

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
                            <span>{t('target')} <strong className="text-white">{al.targetUsage} {selectedVehicle.unit}</strong></span>
                            <span>•</span>
                            <span>
                              {isDue 
                                ? `${t('overdueBy')} ${Math.abs(diff).toFixed(1)} ${selectedVehicle.unit}` 
                                : `${t('remaining')} ${diff.toFixed(1)} ${selectedVehicle.unit}`}
                            </span>
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
                    No hay intervenciones registradas todavía para este vehículo. Pulsa en <span className="text-orange-400 font-semibold">+ Registrar Intervención</span> para añadir la primera.
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
                <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Control individual de cada vehículo registrado.' : language === 'en' ? 'Individual control for each registered vehicle.' : 'Controllo individuale per ogni veicolo registrato.'}</p>
              </div>
              <button 
                onClick={() => setShowAddVehicleModal(true)} 
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
                <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Gestión de piezas, consumibles y stock mínimo.' : language === 'en' ? 'Management of parts, consumables, and minimum stock.' : 'Gestione di parti, consumabili e scorta minima.'}</p>
              </div>
              <button 
                onClick={() => {
                  setEditingPartId(null);
                  setNewPartForm({
                    name: '',
                    vehicle: vehicles[0]?.name || 'Universal',
                    stock: '1',
                    minStock: '1',
                    price: ''
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
                  placeholder={language === 'es' ? 'Buscar repuesto por nombre o vehículo compatible...' : language === 'en' ? 'Search part by name or compatible vehicle...' : 'Cerca ricambio per nome o veicolo compatibile...'} 
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
                              {purchases.length > 1 && (
                                <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold">
                                  {purchases.length} {language === 'es' ? 'Lotes de Compra' : language === 'en' ? 'Purchase Batches' : 'Lotti d\'acquisto'}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] text-zinc-500 font-medium">{language === 'es' ? 'Compatibilidad:' : language === 'en' ? 'Compatibility:' : 'Compatibilità:'}</span>
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
                                {formatQty(totalStock)} ud. {isLow && (language === 'es' ? '(Stock Bajo)' : language === 'en' ? '(Low Stock)' : '(Scorta Bassa)')}
                              </span>
                              <p className="text-[11px] font-mono text-zinc-400 mt-1 font-semibold">
                                {prices.length > 0 ? priceLabel : (language === 'es' ? 'Sin compras' : language === 'en' ? 'No purchases' : 'Nessun acquisto')}
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
                                <span>+ {language === 'es' ? 'Compra' : language === 'en' ? 'Batch' : 'Lotto'}</span>
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
                                {language === 'es' ? 'Lotes de Compra & Precios Registrados' : language === 'en' ? 'Registered Purchase Batches & Prices' : 'Lotti d\'acquisto e prezzi registrati'} ({purchases.length})
                              </span>
                            </div>

                            {purchases.length > 0 ? (
                              <div className="space-y-1.5">
                                {purchases.map((b) => (
                                  <div key={b.id} className="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                        {formatQty(b.qty)} ud.
                                      </span>
                                      <div>
                                        <p className="font-semibold text-zinc-200">{b.supplier || 'Taller / Proveedor'}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono">{language === 'es' ? 'Adquirido el' : language === 'en' ? 'Purchased on' : 'Acquistato il'} {b.date}</p>
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
                                      {b.pricePerUnit.toFixed(2)} € / ud.
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
                <p className="text-xs text-zinc-400 mt-0.5">{language === 'es' ? 'Libro digital de servicios y certificado para venta.' : language === 'en' ? 'Digital service logbook and sale certificate.' : 'Libretto digitale dei servizi e certificato per la vendita.'}</p>
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
                  {language === 'es' ? 'Perfil & Ajustes' : language === 'en' ? 'Profile & Settings' : 'Profilo & Impostazioni'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {language === 'es' ? 'Configuración de idioma, cuenta y plan de suscripción.' : language === 'en' ? 'Language, account, and subscription plan settings.' : 'Lingua, conto e impostazioni del piano di abbonamento.'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Cerrar Sesión' : 'Log Out'}</span>
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
                    {language === 'es' ? 'Cuenta Activa' : 'Logged in as'}
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
                    {language === 'es' ? 'Idioma de la Aplicación' : language === 'en' ? 'App Language' : 'Lingua dell\'applicazione'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {language === 'es' ? 'Selecciona tu idioma preferido' : language === 'en' ? 'Select your preferred language' : 'Seleziona la tua lingua preferita'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { code: 'es', label: 'Español', flag: '🇪🇸' },
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'it', label: 'Italiano', flag: '🇮🇹' }
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

            {/* SECTOR: PLAN SAAS, CAMBIO DE PLAN & FACTURACIÓN */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8 rounded-3xl border border-zinc-800/80 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-bold">
                    {language === 'es' ? 'Suscripción Activa' : language === 'en' ? 'Active Subscription' : 'Abbonamento Attivo'}
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mt-2">
                    {currentPlan === 'starter' ? 'DIY Starter (Gratis)' : currentPlan === 'pro' ? 'DIY Garage (4 Vehículos)' : 'Garage Unlimited'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">
                    {language === 'es' ? 'Renovación automática el 25/08/2026' : language === 'en' ? 'Auto-renewal on 08/25/2026' : 'Rinnovo automatico il 25/08/2026'}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                  <Zap className="w-7 h-7 stroke-[2.5]" />
                </div>
              </div>

              {/* Barra de Consumo de Recursos del Plan */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">
                    {language === 'es' ? 'Vehículos en Garaje' : language === 'en' ? 'Garage Vehicles' : 'Veicoli nel Garage'}
                  </span>
                  <span className="font-mono font-bold text-orange-400">
                    {vehicles.length} / {currentPlan === 'starter' ? '1' : currentPlan === 'pro' ? '4' : 'Ilimitados'}
                  </span>
                </div>
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-orange-500 h-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, (vehicles.length / (currentPlan === 'starter' ? 1 : currentPlan === 'pro' ? 4 : 100)) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Selector de Periodo: Mensual / Anual (-20%) */}
              <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300 pl-2">
                  {language === 'es' ? 'Frecuencia de Facturación' : language === 'en' ? 'Billing Cycle' : 'Ciclo di fatturazione'}
                </span>
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      billingCycle === 'monthly' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {language === 'es' ? 'Mensual' : language === 'en' ? 'Monthly' : 'Mensile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                      billingCycle === 'annual' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{language === 'es' ? 'Anual' : language === 'en' ? 'Annual' : 'Annuale'}</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">-20%</span>
                  </button>
                </div>
              </div>

              {/* TABLA COMPARATIVA DE PLANES SAAS ENFOCADOS A DIY & PARTICULARES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* PLAN 1: STARTER DIY (GRATIS - 1 VEHÍCULO) */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                  currentPlan === 'starter' 
                    ? 'bg-orange-500/10 border-orange-500 shadow-lg' 
                    : 'bg-zinc-950/60 border-zinc-800'
                }`}>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">DIY Starter</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {language === 'es' ? 'Para tu vehículo principal' : language === 'en' ? 'For your daily ride' : 'Per il tuo veicolo principale'}
                    </p>
                    <div className="mt-3">
                      <span className="text-xl font-extrabold text-white font-mono">0 €</span>
                      <span className="text-[10px] text-zinc-500 block">
                        {language === 'es' ? 'Gratis para siempre' : language === 'en' ? 'Free forever' : 'Gratis per sempre'}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span><strong>1 Vehículo</strong> (Moto o Coche)</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Historial básico de servicios</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-zinc-600">
                        <span>• Alertas avanzadas excluidas</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPlan('starter')}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      currentPlan === 'starter'
                        ? 'bg-zinc-800 text-zinc-400 cursor-default'
                        : 'bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    {currentPlan === 'starter' ? (language === 'es' ? 'Plan Actual' : language === 'en' ? 'Current Plan' : 'Piano Attuale') : (language === 'es' ? 'Seleccionar Plan' : language === 'en' ? 'Select Plan' : 'Seleziona Piano')}
                  </button>
                </div>

                {/* PLAN 2: DIY GARAGE (PARTICULARES CON HASTA 4 VEHÍCULOS) */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 transition-all relative ${
                  currentPlan === 'pro' 
                    ? 'bg-orange-500/10 border-orange-500 shadow-xl' 
                    : 'bg-zinc-950/60 border-zinc-800'
                }`}>
                  <span className="absolute -top-2.5 right-4 bg-orange-500 text-white text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full shadow">
                    DIY Recomendado
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">DIY Garage</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {language === 'es' ? 'Particulares con 2 a 4 vehículos' : language === 'en' ? 'DIYers with 2 to 4 vehicles' : 'Appassionati con 2-4 veicoli'}
                    </p>
                    <div className="mt-3">
                      <span className="text-xl font-extrabold text-white font-mono">
                        {billingCycle === 'monthly' ? '4.99 €' : '3.99 €'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono"> / {language === 'es' ? 'mes' : language === 'en' ? 'mo' : 'mese'}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span><strong>Hasta 4 Vehículos</strong></span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Alertas inteligentes por Horas/Km</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Inventario y Stock de Repuestos</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPlan('pro')}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      currentPlan === 'pro'
                        ? 'bg-zinc-800 text-zinc-400 cursor-default'
                        : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                    }`}
                  >
                    {currentPlan === 'pro' ? (language === 'es' ? 'Plan Actual' : language === 'en' ? 'Current Plan' : 'Piano Attuale') : (language === 'es' ? 'Seleccionar DIY Garage' : language === 'en' ? 'Select DIY Garage' : 'Seleziona DIY Garage')}
                  </button>
                </div>

                {/* PLAN 3: UNLIMITED DIY / TALLER (VEHÍCULOS ILIMITADOS) */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                  currentPlan === 'unlimited' 
                    ? 'bg-orange-500/10 border-orange-500 shadow-lg' 
                    : 'bg-zinc-950/60 border-zinc-800'
                }`}>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Garage Unlimited</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {language === 'es' ? 'Sin límites para gran garaje o taller' : language === 'en' ? 'No limits for large garage' : 'Senza limiti per grandi garage'}
                    </p>
                    <div className="mt-3">
                      <span className="text-xl font-extrabold text-white font-mono">
                        {billingCycle === 'monthly' ? '9.99 €' : '7.99 €'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono"> / {language === 'es' ? 'mes' : language === 'en' ? 'mo' : 'mese'}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span><strong>Vehículos Ilimitados</strong></span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Exportación en PDF con fotos</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Soporte Prioritario</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPlan('unlimited')}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      currentPlan === 'unlimited'
                        ? 'bg-zinc-800 text-zinc-400 cursor-default'
                        : 'bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    {currentPlan === 'unlimited' ? (language === 'es' ? 'Plan Actual' : language === 'en' ? 'Current Plan' : 'Piano Attuale') : (language === 'es' ? 'Seleccionar Unlimited' : language === 'en' ? 'Select Unlimited' : 'Seleziona Unlimited')}
                  </button>
                </div>
              </div>

              {/* Botones de Acción de Facturación Stripe */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => {
                    alert(
                      language === 'es'
                        ? 'Redirigiendo a la pasarela segura de pago Stripe Customer Portal...'
                        : language === 'en'
                        ? 'Redirecting to secure Stripe Customer Portal...'
                        : 'Reindirizzamento al portale clienti sicuro Stripe...'
                    );
                  }}
                  className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>
                    {language === 'es' ? 'Portal de Facturación Stripe' : language === 'en' ? 'Stripe Billing Portal' : 'Portale di fatturazione Stripe'}
                  </span>
                </button>
                
                <button 
                  onClick={() => {
                    alert(
                      language === 'es'
                        ? 'Se han descargado tus últimas facturas en formato PDF.'
                        : language === 'en'
                        ? 'Your latest invoices have been downloaded as PDF.'
                        : 'Le tue ultime fatture sono state scaricate in formato PDF.'
                    );
                  }}
                  className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span>
                    {language === 'es' ? 'Descargar Facturas PDF' : language === 'en' ? 'Download Invoices PDF' : 'Scarica fatture PDF'}
                  </span>
                </button>
              </div>
            </div>

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

      </main>

      {/* NAVEGACIÓN INFERIOR PWA MÓVIL (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 flex items-center justify-around px-2 z-40">
        <MobileNavItem icon={Home} label={t('dashboard')} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={Bike} label={t('garage')} active={activeTab === 'garage'} onClick={() => { setActiveTab('garage'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={Wrench} label={t('parts')} active={activeTab === 'parts'} onClick={() => { setActiveTab('parts'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={History} label={t('history')} active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setSelectedVehicle(null); }} />
        <MobileNavItem icon={User} label={t('profileTitle').split('&')[0].trim()} active={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setSelectedVehicle(null); }} />
      </nav>

      {/* MODAL BOTTOM SHEET: NUEVA / EDITAR INTERVENCIÓN COMPLETA */}
      {showAddMaintenanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
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
                              {p.name} (Stock: {totalStock} ud | {unitPrice > 0 ? `${unitPrice.toFixed(2)} €/ud` : 'Sin precio'}) {totalStock <= 0 ? '- ¡AGOTADO!' : ''}
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
                      placeholder="Cant. (1.00)"
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
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-white">Añadir Nuevo Vehículo</h3>
                <p className="text-xs text-zinc-400">Registra una nueva moto, vehículo o máquina en tu garaje.</p>
              </div>
              <button onClick={() => setShowAddVehicleModal(false)} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm">✕</button>
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
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
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
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
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
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
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

              {!editingPartId && (
                <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 space-y-3">
                  <span className="text-[11px] font-mono text-orange-400 font-bold uppercase tracking-wider block">🧾 Datos de la primera compra / lote inicial</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">Unidades Compradas</label>
                      <input 
                        type="number" 
                        min="1"
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
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
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
                  <label className="block text-zinc-400 font-medium mb-1">Unidades Adquiridas</label>
                  <input 
                    type="number" 
                    min="1"
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

    </div>
  );
}

// --- SUBCOMPONENTES AUXILIARES CON DISEÑO MEJORADO ---

function NavItem({ icon: Icon, label, badge, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
        active 
          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/25 shadow-sm' 
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span className={`px-2.5 py-0.5 text-[10px] font-mono rounded-full ${active ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-400'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-14 h-12 rounded-2xl transition-all ${
        active ? 'text-orange-400 font-bold scale-105' : 'text-zinc-500 hover:text-zinc-300 font-medium'
      }`}
    >
      <Icon className={`w-5 h-5 mb-0.5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
      <span className="text-[10px] tracking-tight">{label}</span>
    </button>
  );
}

function MetricBento({ title, value, subtitle, icon: Icon, color, highlight }) {
  return (
    <div className={`p-4 sm:p-5 rounded-3xl border transition-all ${
      highlight 
        ? 'bg-rose-500/5 border-rose-500/30' 
        : 'bg-zinc-900/60 border-zinc-800/80'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-zinc-400">{title}</span>
        <div className={`w-8 h-8 rounded-xl bg-zinc-800/80 flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1 font-medium">{subtitle}</p>
    </div>
  );
}

function VehicleBentoCard({ vehicle, maintenances = [], language = 'es', onSelect, onOpenKmModal, onDelete }) {
  const vehicleSpent = (maintenances || [])
    .filter(m => (m.vehicle || '').toLowerCase() === (vehicle.name || '').toLowerCase())
    .reduce((sum, m) => sum + (parseFloat((m.cost || '').replace(/[^0-9.]/g, '')) || 0), 0);

  const statusLabel = vehicle.status === 'ok' 
    ? (language === 'es' ? 'Al día' : language === 'en' ? 'Up to date' : 'Aggiornato')
    : vehicle.statusText;

  return (
    <div 
      onClick={onSelect}
      className="p-5 rounded-3xl bg-zinc-900/70 border border-zinc-800/80 hover:border-orange-500/40 hover:bg-zinc-900 transition-all cursor-pointer group shadow-lg flex flex-col justify-between relative"
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shadow-inner overflow-hidden shrink-0">
              {vehicle.photo ? (
                <img src={vehicle.photo} alt={vehicle.name} className="w-full h-full object-cover" />
              ) : (
                <span>{vehicle.icon}</span>
              )}
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-zinc-100 group-hover:text-orange-400 transition-colors">{vehicle.name}</h4>
              <p className="text-[11px] text-zinc-500 font-medium">{translateCategory(vehicle.category, language)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(vehicle.id);
                }}
                title={language === 'es' ? 'Eliminar Vehículo' : language === 'en' ? 'Delete Vehicle' : 'Elimina Veicolo'}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 transition-colors" />
          </div>
        </div>

        {/* Indicador de Uso, Gasto Acumulado & Botón Rápido */}
        <div className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/60 flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {language === 'es' ? 'Lectura / Gasto' : language === 'en' ? 'Usage / Cost' : 'Lettura / Spesa'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-orange-400">{vehicle.usage}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{vehicleSpent.toFixed(2)} €</span>
            </div>
          </div>
          <button 
            onClick={onOpenKmModal}
            className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-300 text-[10px] font-semibold transition-colors border border-zinc-700/60"
          >
            + {language === 'es' ? 'Actualizar' : language === 'en' ? 'Update' : 'Aggiorna'}
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
        <span className="text-[10px] text-zinc-500 font-medium">
          {language === 'es' ? 'Estado:' : language === 'en' ? 'Status:' : 'Stato:'}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
          vehicle.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          vehicle.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
          'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
