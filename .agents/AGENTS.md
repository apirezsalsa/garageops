# GarageOps — Guía para el Agente

## Descripción del Proyecto

**GarageOps** (marca comercial: **MyGarageOps**, dominios `mygarageops.com` / `app.mygarageops.com`) es una aplicación de gestión de mantenimiento de vehículos y flota. Permite registrar vehículos (motos, coches, vehículos de soporte), programar alertas de mantenimiento (por uso o por fecha concreta), gestionar un inventario de repuestos, y llevar un historial completo de intervenciones. Es un producto **SaaS** con planes de suscripción (Starter, Pro, Unlimited) **con cobros reales activos vía Stripe desde 2026-08-13**, con usuarios de pago reales (26 usuarios a 2026-08-12).

> [!IMPORTANT]
> **Flujo de ramas:** se trabaja en la rama `dev`; `main` es producción. No mergear a `main` ni desplegar (Vercel / GitHub push) sin que el usuario lo pida explícitamente.
>
> **Estado de las plataformas:** El panel web es el **proyecto real, actual y prioritario**. La aplicación móvil está desfasada respecto a la web (le faltan Stripe, alertas por fecha, push, backoffice) y en el futuro se reescribirá/actualizará para alinearse con ella.

El proyecto tiene **dos plataformas**:

| Plataforma | Directorio | Stack | Estado / Propósito |
|---|---|---|---|
| **Admin web** | `/web/` | React 19 + Vite + TailwindCSS v4 | **Proyecto Activo y Principal**, desplegado en Firebase Hosting (multi-site: landing + `app.`) |
| **App móvil** | `/` (raíz) | React Native + Expo SDK 54 | *Desfasada* (Futura migración para igualar a la web) |

---

## Arquitectura General

### App Móvil (React Native / Expo)

- **Entry point:** `index.js` → `App.js`
- **Navegación:** React Navigation v7 con `createBottomTabNavigator` + `createStackNavigator`
- **Tabs principales:** Dashboard · Garage · Parts · History
- **Internacionalización:** `i18next` + `react-i18next` con 6 idiomas (es, en, fr, de, it, pt) en `src/locales/`
- **Persistencia de sesión:** `AsyncStorage` con `getReactNativePersistence` de Firebase Auth

### Panel Web (Vite + React)

- **Entry point:** `web/src/App.jsx` — archivo monolítico (varios miles de líneas) que contiene toda la UI del backoffice y la app de cliente
- **Build tool:** Vite 5 con plugin `@vitejs/plugin-react`
- **Estilos:** TailwindCSS v4 (integrado via `@tailwindcss/vite`)
- **PWA:** `web/public/sw.js` — service worker único que combina caché de la PWA + Firebase Cloud Messaging (push). No se registra un segundo SW para no pisar el scope raíz `/`
- **Seguridad de acceso:** `web/src/firebase.js` inicializa **Firebase App Check** (`ReCaptchaV3Provider`) — ver estado de Enforce en Pendientes
- **Despliegue:** Firebase Hosting (`app.mygarageops.com`). `web/vercel.json` queda como configuración legada, ya no es el despliegue activo

---

## Firebase (Proyecto: `garageops-6511f`)

- **Firebase Project ID:** `garageops-6511f`
- **Config en mobile:** `src/config/firebase.js`
- **Config en web:** `web/src/firebase.js`

### Servicios Firebase usados

| Servicio | Uso |
|---|---|
| **Firebase Auth** | Autenticación por email/password (y OAuth en registro web). En móvil usa `AsyncStorage` para persistencia; en web usa `getAuth` estándar |
| **Firestore** | Base de datos principal. Colecciones en raíz filtradas por `userId` |
| **Firebase Storage** | Almacenamiento de fotos de vehículos y recibos (`uploadService.js`) |
| **Cloud Functions** | Stripe (checkout/portal/webhook), borrado de cuenta, alertas programadas, push de prueba — ver tabla abajo |
| **Cloud Messaging (FCM)** | Notificaciones push web, token guardado en `users/{uid}.fcmTokens` |
| **App Check** | `ReCaptchaV3Provider` en el frontend web (aún en modo "monitorizar", no en Enforce) |

### Estructura Firestore

```
users/
  {uid}/            → { email, role, plan, giftDays, fcmTokens[], updatedAt, ... }

vehicles/           → { userId, name, category, unit, usageNum, status, photo,
                         alerts: [{ id, type: 'usage'|'date', title,
                                    targetUsage?, advanceNotice?, targetDate? }], ... }
maintenances/       → { userId, vehicleId, title, date, cost, type, parts[], ... }
parts/               → { userId, name, compatibleVehicles[], minStock, purchases[], ... }
plans/               → { id, priceMonthly, maxVehicles, tagline/features {es,en,it,fr,de,pt}, ... }
```

> **Nota:** `vehicles`, `maintenances`, `parts` y `plans` están en la **raíz** de Firestore (no como subcolecciones de `users`). Cada documento de vehículo/mantenimiento/repuesto incluye un campo `userId` para filtrar por usuario. Los planes (`starter`/`pro`/`unlimited`) viven como documentos en Firestore, no hardcodeados en el frontend — el único límite real por plan es `maxVehicles` (`-1` = ilimitado).

### Roles de usuario y seguridad

- `role` y `plan` se leen del **documento Firestore del usuario** (`users/{uid}`), no de un patrón de email — el email solo actúa como fallback transitorio mientras carga el perfil.
- `isSuperAdmin` (web) = `userProfile.role === 'admin'`.
- `firestore.rules` refuerza server-side que un usuario no pueda auto-asignarse `role: 'admin'` ni cambiar su propio `plan` sin pasar por Stripe/Cloud Functions (corregido 2026-08-14 — antes era posible una escalada de privilegios vía escritura directa a Firestore).

---

## Autenticación

### Móvil — `src/context/AuthContext.js`

- Exporta `AuthProvider` y `useAuth` (hook que devuelve `{ user, userProfile, loading }`)
- **Bridge especial para web:** si `Platform.OS === 'web'`, lee `localStorage.getItem('distrito_v2_session')` para autenticarse via Distrito Enduro sin pasar por Firebase Auth; si no hay sesión, redirige a `/login.html`
- En móvil usa Firebase `onAuthStateChanged` + `onSnapshot` del perfil en Firestore

### Web — `web/src/App.jsx`

- Auth gestionada directamente en el componente principal con `useState` + `onAuthStateChanged`
- `isSuperAdmin` = `userProfile.role === 'admin'` (leído de Firestore, ver sección de Roles arriba)
- Backoffice con panel de gestión de usuarios, regalo de días de suscripción (`giftDays`) e inspección de cuentas
- Aviso de Términos y Privacidad tanto en login/registro por email como en el flujo OAuth

---

## Estructura de Pantallas (App Móvil)

| Stack | Pantallas |
|---|---|
| **HomeStack** | `DashboardScreen`, `ProfileScreen`, `LegalScreen`, `PaywallScreen`, `HelpScreen` |
| **GarageStack** | `VehiclesScreen`, `VehicleDetailScreen`, `AddVehicleScreen`, `AddMaintenanceScreen`, `MaintenanceDetailScreen` |
| **MaintenanceStack** | `HistoryScreen`, `MaintenanceDetailScreen` |
| **AuthStack** | `LoginScreen`, `RegisterScreen` |
| **Tab standalone** | `PartsScreen` (Inventario de repuestos) |

---

## Servicios (`src/services/`, app móvil)

| Archivo | Responsabilidad |
|---|---|
| `maintenanceService.js` | CRUD de mantenimientos en Firestore |
| `vehicleService.js` | CRUD de vehículos |
| `partsService.js` | CRUD de inventario de repuestos |
| `uploadService.js` | Subida de imágenes a Firebase Storage |

> `webApi.js` (cliente REST) fue **eliminado** — el panel web usa Firestore directamente con `onSnapshot`, nunca necesitó una API REST intermedia. Los servicios móviles ya no bifurcan por `Platform.OS === 'web'`; solo se usan en la app móvil.

---

## Cloud Functions (`functions/index.js`, `functions/src/`)

| Función | Tipo | Responsabilidad |
|---|---|---|
| `createCheckoutSession` | `onCall` | Crea sesión de Stripe Checkout; verifica propiedad del Customer |
| `createPortalSession` | `onCall` | Abre el portal de facturación de Stripe |
| `stripeWebhook` | `onRequest` | Recibe eventos de Stripe (pago confirmado → actualiza `plan` del usuario) |
| `deleteUserAccount` | `onCall` | Borra cuenta (Auth + Firestore) |
| `checkVehicleAlerts` | `onSchedule` (diaria, 8:00 Europe/Madrid) | Revisa `vehicles/{id}.alerts[]` y envía push por cada alerta vencida/próxima (un único push por alerta) |
| `sendTestPushNotification` | `onCall` | Push de prueba manual |

`functions/src/planMatching.js` y `functions/src/alertNotifications.js` contienen la lógica pura (testeada con Vitest, sin SDK de Admin) que usan estas funciones.

---

## Planes de Suscripción (SaaS)

| Plan | Límite de vehículos (`maxVehicles`) |
|---|---|
| `starter` | 2 |
| `pro` | 4 (plan por defecto al registrarse) |
| `unlimited` | -1 (ilimitado) |

- Los planes son **documentos en Firestore** (`plans/{id}`), no constantes hardcodeadas — `tagline`/`features` están traducidos a los 6 idiomas soportados.
- El **único gating real** entre planes es el número de vehículos (`isUnderVehicleLimit` en `web/src/utils/billing.js`); nada más está restringido.
- **Web:** cobro real vía **Stripe** (activo desde 2026-08-13), con IVA y verificación de propiedad del Customer en checkout/portal.
- **Móvil:** dependencia `react-native-purchases` (RevenueCat) presente en `package.json`, pero **no configurada** — el flujo de compra in-app está en modo simulación (ver textos `config_required_desc` en `src/locales/*.json`).

---

## Internacionalización

- **Móvil:** `i18next` con 6 idiomas. Ficheros JSON en `src/locales/`: `es.json`, `en.json`, `fr.json`, `de.json`, `it.json`, `pt.json`
- **Web:** diccionario `TRANSLATIONS` en `web/src/locales.js` (extraído de `App.jsx`), con **6 idiomas completos** (es/en/it/fr/de/pt). Persistido en `localStorage` con clave `garageops_language`
- **Landing** (`mygarageops-landing`, repo/proyecto separado): también con arquitectura i18n de 6 idiomas, desplegada aparte
- Idioma por defecto: `es` (español)

---

## Builds y Despliegue

### Móvil — EAS (Expo Application Services)

Configuración en `eas.json`:

```bash
# Desarrollo (development client)
eas build --profile development

# Preview (APK interno)
eas build --profile preview

# Producción (auto-increment version)
eas build --profile production
```

- Android package: `com.apirezsalsa.GarageOps`
- EAS Project ID: `4914b85b-7440-49e0-af2e-02cb2a26cb07`

### Web — Vite + Firebase Hosting

```bash
cd web
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción → dist/
firebase deploy --only hosting  # despliegue (multi-site: landing + app.mygarageops.com)
```

- Despliegue en **Firebase Hosting** (multi-site): `mygarageops.com` (landing) y `app.mygarageops.com` (esta app). DNS en IONOS.
- Cachear con cuidado: `index.html` cachea 1h por defecto en Firebase Hosting salvo headers explícitos en `firebase.json`.
- Build especial para WebDistrito: `npm run build:web:distrito` (desde la raíz)

---

## Componentes Compartidos

- `src/components/SpotlightOverlay.js` — Overlay de onboarding tipo spotlight para guiar al usuario en su primera sesión. Usa `AsyncStorage` para marcar si ya fue visto (`hasSeenSpotlightDash`, `hasSeenSpotlightGarage`, etc.)

---

## Convenciones y Decisiones de Diseño

1. **Dark theme obligatorio** — Color de fondo base: `#121212`. Acento principal: `#F2780D` (naranja GarageOps). No usar fondos claros.
2. **TailwindCSS solo en web** — El panel web (`/web`) usa TailwindCSS v4. El móvil usa `StyleSheet` de React Native o estilos inline.
3. **Actualización optimista** — En la web, los helpers `firestoreAdd`, `firestoreUpdate`, `firestoreDelete` actualizan el estado local inmediatamente y luego sincronizan con Firestore. Ante error, persisten en `localStorage`.
4. **Fotos de vehículos** — Se optimizan antes de subir: recorte cuadrado 1:1 a 500×500px y compresión WebP al 80%.
5. **Onboarding** — La web tiene un tour de bienvenida (carrusel de 5 pasos) + botón de ayuda reabrible, mostrado la primera vez y desde entonces bajo demanda (no se resetea en cada login). El overlay spotlight con reset en cada login pertenece solo a la app móvil desfasada.
6. **Rol SuperAdmin** — Verificado server-side: se lee de `users/{uid}.role` en Firestore y `firestore.rules` impide que un usuario se auto-asigne `admin` o cambie su `plan` sin pasar por Stripe.
7. **Alertas de vehículo** — Persistidas en Firestore (`vehicles/{id}.alerts[]`), no solo en estado local de React.
8. **Un solo Service Worker** — `web/public/sw.js` combina caché PWA + Firebase Messaging en el mismo archivo/scope, no en dos SW separados.

---

## Variables de Entorno / Secretos

> Las claves de Firebase (config pública, no secretos) están hardcodeadas en los ficheros de configuración (patrón Expo/Firebase habitual para apps públicas). Los secretos reales (Stripe secret key, webhook secret) se gestionan como **Secrets de Firebase Functions** (`secrets: [STRIPE_SECRET_KEY, ...]` en `functions/index.js`), no en `.env`. Hay **dos cuentas de Stripe**: LIVE (`acct_1U2tQLRsQS2k5T11`, "GarageOps") y sandbox de test (`acct_1U2tQURtfbNBjKqw`) — no confundirlas.

---

## Pendiente / Estado Conocido (actualizado 2026-08-15)

- [ ] **App Check en modo Enforce** — actualmente solo "monitoriza" (`ReCaptchaV3Provider` inicializado pero sin bloquear tráfico no verificado). Pendiente revisar métricas en Firebase Console antes de activar Enforce.
- [ ] **Confirmar recepción de push de punta a punta** — `sendTestPushNotification` desplegado, pendiente de verificar que llega al móvil del usuario. **Limitación conocida:** en iPhone solo funciona si la PWA está instalada en pantalla de inicio (iOS 16.4+); no llega en pestaña normal de Safari.
- RevenueCat (móvil) sigue sin configurar — la compra in-app está en modo simulación.
- La app móvil no tiene Stripe, alertas por fecha, push ni backoffice — sigue desfasada respecto a la web.
