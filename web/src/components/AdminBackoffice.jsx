import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  Users, Bike, Zap, TrendingUp, FileText, Search, Plus, Edit2, Trash2, ChevronRight, ArrowUpRight, Shield, Mail
} from 'lucide-react';
import { db, functions } from '../firebase';
import { computePlanStats } from '../utils/billing';
import {
  PLAN_COLOR_STYLES, DEFAULT_PLAN_COLOR, PLAN_LANGUAGES,
  getLocalizedPlanText, getLocalizedPlanList, PAYMENT_GATEWAY_ENABLED
} from '../utils/plans';

// Backoffice de administración SaaS: directorio de usuarios, gestión de planes y transacciones de Stripe.
// Solo se monta cuando activeTab === 'admin' && isSuperAdmin (guard en App.jsx).
export function AdminBackoffice({
  allUsersList, setAllUsersList,
  vehicleCountsByUser,
  plans, plansById,
  transactions,
  defaultPlanId,
  language, t,
  setNoticeModal, setConfirmModal, setInspectingUser, setActiveTab,
}) {
  const [adminSubTab, setAdminSubTab] = useState('users'); // 'users' | 'plans' | 'transactions'
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminUserSort, setAdminUserSort] = useState('alpha');
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null); // {} para crear uno nuevo
  const [planEditLang, setPlanEditLang] = useState('es');
  const [giftPlanInput, setGiftPlanInput] = useState('unlimited');
  const [giftDaysInput, setGiftDaysInput] = useState('30');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');

  // Comunicación por email (Resend, vía Cloud Function sendUserEmail)
  const [commAudience, setCommAudience] = useState('all'); // 'all' | 'plan' | 'user'
  const [commPlanId, setCommPlanId] = useState('');
  const [commTargetUid, setCommTargetUid] = useState('');
  const [commSubject, setCommSubject] = useState('');
  const [commBody, setCommBody] = useState('');
  const [commSending, setCommSending] = useState(false);

  const commRecipientCount = commAudience === 'all'
    ? allUsersList.length
    : commAudience === 'plan'
      ? allUsersList.filter(u => u.plan === commPlanId).length
      : commTargetUid ? 1 : 0;

  const handleSendComm = () => {
    if (!commSubject.trim() || !commBody.trim()) {
      setNoticeModal({ title: 'Faltan datos', message: 'Escribe un asunto y un mensaje antes de enviar.', type: 'warning' });
      return;
    }
    if (commAudience === 'plan' && !commPlanId) {
      setNoticeModal({ title: 'Falta el plan', message: 'Elige a qué plan quieres escribir.', type: 'warning' });
      return;
    }
    if (commAudience === 'user' && !commTargetUid) {
      setNoticeModal({ title: 'Falta el usuario', message: 'Elige a qué usuario quieres escribir.', type: 'warning' });
      return;
    }
    if (commRecipientCount === 0) {
      setNoticeModal({ title: 'Sin destinatarios', message: 'No hay ningún usuario que cumpla ese criterio.', type: 'warning' });
      return;
    }

    const html = commBody.trim().split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('');

    setConfirmModal({
      title: '¿Enviar correo?',
      message: `Se enviará a ${commRecipientCount} destinatario${commRecipientCount !== 1 ? 's' : ''}. Esta acción no se puede deshacer.`,
      tone: 'default',
      icon: Mail,
      confirmLabel: 'Enviar correo',
      onConfirm: async () => {
        setCommSending(true);
        try {
          const sendUserEmailFn = httpsCallable(functions, 'sendUserEmail');
          const { data } = await sendUserEmailFn({
            audience: commAudience,
            planId: commAudience === 'plan' ? commPlanId : undefined,
            targetUid: commAudience === 'user' ? commTargetUid : undefined,
            subject: commSubject.trim(),
            html
          });
          setNoticeModal({ title: 'Correo Enviado', message: `Se ha enviado a ${data.sent} destinatario${data.sent !== 1 ? 's' : ''}.`, type: 'success' });
          setCommSubject('');
          setCommBody('');
        } catch (err) {
          console.error('Error al enviar el correo:', err);
          setNoticeModal({ title: 'Error', message: err.message || 'No se pudo enviar el correo.', type: 'warning' });
        } finally {
          setCommSending(false);
        }
      }
    });
  };

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

  // Crea o actualiza un plan de suscripción desde el modal de "Gestión de Planes"
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
    <>
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
          <button
            onClick={() => setAdminSubTab('comm')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              adminSubTab === 'comm' ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Comunicación
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

        {/* COMUNICACIÓN — enviar un email a un usuario, a un plan, o a todos (vía Resend) */}
        {adminSubTab === 'comm' && (
          <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-5 shadow-xl max-w-2xl">
            <div className="pb-3 border-b border-zinc-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-orange-400" />
                <span>Enviar correo</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Se envía desde MyGarageOps &lt;hola@mygarageops.com&gt; vía Resend.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2">Destinatarios</label>
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800 w-fit">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'plan', label: 'Por plan' },
                  { id: 'user', label: 'Un usuario' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCommAudience(opt.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      commAudience === opt.id ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {commAudience === 'plan' && (
                <select
                  value={commPlanId}
                  onChange={(e) => setCommPlanId(e.target.value)}
                  className="mt-3 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-orange-500"
                >
                  <option value="">Elige un plan…</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {commAudience === 'user' && (
                <select
                  value={commTargetUid}
                  onChange={(e) => setCommTargetUid(e.target.value)}
                  className="mt-3 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-orange-500"
                >
                  <option value="">Elige un usuario…</option>
                  {allUsersList.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              )}

              <p className="mt-2 text-[11px] text-zinc-500 font-mono">
                {commRecipientCount} destinatario{commRecipientCount !== 1 ? 's' : ''}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2">Asunto</label>
              <input
                type="text"
                value={commSubject}
                onChange={(e) => setCommSubject(e.target.value)}
                placeholder="Ej: Novedades en MyGarageOps"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2">Mensaje</label>
              <textarea
                value={commBody}
                onChange={(e) => setCommBody(e.target.value)}
                rows={8}
                placeholder="Escribe el mensaje. Cada línea se envía como un párrafo."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-orange-500 resize-y"
              />
            </div>

            <button
              type="button"
              onClick={handleSendComm}
              disabled={commSending}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              {commSending ? 'Enviando…' : 'Enviar correo'}
            </button>
          </div>
        )}
      </div>

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
    </>
  );
}
