import { User, SlidersHorizontal, Coins, Bell, CheckCircle2, Zap, FileText, ArrowUpRight } from 'lucide-react';
import { getLocalizedPlanList, PAYMENT_GATEWAY_ENABLED } from '../utils/plans';
import { CURRENCIES } from '../utils/currency';

// Pantalla "Ajustes & Suscripción": idioma, notificaciones push, plan SaaS/facturación,
// historial de pagos propio y copias de seguridad. Puramente presentacional — sin estado propio,
// toda la lógica vive en App() y se recibe como props.
export function ProfileSettings({
  language, setLanguage, t,
  currency, setCurrency,
  userEmail, handleLogout,
  isEmailVerified, needsEmailVerification, handleResendVerification, verificationInFlight, verificationSuccess,
  pushPermissionStatus, handleEnablePushNotifications, pushRequestInFlight,
  handleSendTestPush, testPushInFlight,
  currentPlanDef, currentPlan,
  nextRenewalDate, activeBillingCycle,
  userProfile, handleOpenBillingPortal, checkoutLoading,
  pendingPlanChange, handleCancelPendingPlanChange,
  vehicles, maxVehiclesAllowed, maxVehiclesLabel,
  billingCycle, setBillingCycle,
  plans, plansById, handlePlanSelection,
  myTransactions,
  handleExportJSON, handleExportCSV, handleImportJSON,
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {language === 'es' ? 'Perfil & Ajustes' : language === 'en' ? 'Profile & Settings' : language === 'it' ? 'Profilo & Impostazioni' : language === 'fr' ? 'Profil & Paramètres' : language === 'de' ? 'Profil & Einstellungen' : 'Perfil & Definições'}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {language === 'es' ? 'Configuración de idioma, cuenta y plan de suscripción.' : language === 'en' ? 'Language, account, and subscription plan settings.' : language === 'it' ? 'Configurazione lingua, account e piano di abbonamento.' : language === 'fr' ? 'Configuration de la langue, du compte et du plan.' : language === 'de' ? 'Sprach-, Konto- und Abo-Einstellungen.' : 'Configuração de idioma, conta e plano de subscrição.'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-3.5 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span>{language === 'es' ? 'Cerrar Sesión' : language === 'en' ? 'Log Out' : language === 'it' ? 'Esci' : language === 'fr' ? 'Se Déconnecter' : language === 'de' ? 'Abmelden' : 'Terminar Sessão'}</span>
        </button>
      </div>

      {/* SECTOR: USUARIO CONECTADO */}
      <div className="bg-zinc-900/80 p-5 rounded-3xl border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            {isEmailVerified ? (
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                ✓ {language === 'es' ? 'Verificado' : language === 'en' ? 'Verified' : language === 'it' ? 'Verificato' : language === 'fr' ? 'Vérifié' : language === 'de' ? 'Verifiziert' : 'Verificado'}
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold">
                ● {language === 'es' ? 'Sin verificar' : language === 'en' ? 'Unverified' : language === 'it' ? 'Non verificato' : language === 'fr' ? 'Non vérifié' : language === 'de' ? 'Nicht verifiziert' : 'Não verificado'}
              </span>
            )}
          </div>
        </div>

        {needsEmailVerification && (
          <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-400">
              {language === 'es' ? 'Tu dirección de correo aún no está verificada.' : language === 'en' ? 'Your email address is not verified yet.' : language === 'it' ? 'Il tuo indirizzo email non è ancora verificato.' : language === 'fr' ? "Votre adresse e-mail n'est pas encore vérifiée." : language === 'de' ? 'Deine E-Mail-Adresse ist noch nicht verifiziert.' : 'O teu endereço de email ainda não está verificado.'}
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={verificationInFlight || verificationSuccess}
              className="self-start sm:self-auto px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50"
            >
              {verificationSuccess
                ? (language === 'es' ? '✓ Enlace enviado' : language === 'en' ? '✓ Link sent' : language === 'it' ? '✓ Link inviato' : language === 'fr' ? '✓ Lien envoyé' : language === 'de' ? '✓ Link gesendet' : '✓ Link enviado')
                : verificationInFlight
                ? (language === 'es' ? 'Enviando...' : 'Sending...')
                : (language === 'es' ? 'Reenviar enlace de verificación' : language === 'en' ? 'Resend verification link' : language === 'it' ? 'Reinvia link di verifica' : language === 'fr' ? 'Renvoyer le lien de vérification' : language === 'de' ? 'Bestätigungslink erneut senden' : 'Reenviar link de verificação')}
            </button>
          </div>
        )}
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

      {/* SECTOR: MONEDA — solo cambia el símbolo mostrado, sin conversión de cambio. Un importe ya
          registrado conserva el símbolo con el que se creó; esto solo afecta a lo nuevo. */}
      <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">
              {language === 'es' ? 'Moneda' : language === 'en' ? 'Currency' : language === 'it' ? 'Valuta' : language === 'fr' ? 'Devise' : language === 'de' ? 'Währung' : 'Moeda'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {language === 'es' ? 'En qué moneda registras costes de mantenimiento y repuestos' : language === 'en' ? 'The currency used for maintenance and parts costs' : language === 'it' ? 'La valuta usata per costi di manutenzione e ricambi' : language === 'fr' ? 'La devise pour les coûts de maintenance et de pièces' : language === 'de' ? 'Die Währung für Wartungs- und Ersatzteilkosten' : 'A moeda usada para custos de manutenção e peças'}
            </p>
          </div>
        </div>

        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full bg-zinc-950/60 border border-zinc-800 rounded-2xl p-3 text-sm font-bold text-zinc-200 outline-none focus:border-orange-500"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
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
  );
}
