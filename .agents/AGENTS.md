# GarageOps — Guía para el Agente

## Descripción del Proyecto

**GarageOps** es una aplicación de gestión de mantenimiento de vehículos y flota. Permite registrar vehículos (motos, coches, vehículos de soporte), programar alertas de mantenimiento, gestionar un inventario de repuestos, y llevar un historial completo de intervenciones. Es un producto **SaaS** con planes de suscripción (Starter, Pro, Unlimited).

> [!IMPORTANT]
> **Estado del desarrollo:** El panel web es el **proyecto real, actual y prioritario**. La aplicación móvil está temporalmente desfasada y en el futuro se reescribirá/actualizará para alinearse e igualarse con la versión web.

El proyecto tiene **dos plataformas**:

| Plataforma | Directorio | Stack | Estado / Propósito |
|---|---|---|---|
| **Admin web** | `/web/` | React 19 + Vite + TailwindCSS v4 | **Proyecto Activo y Principal** |
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

- **Entry point:** `web/src/App.jsx` — archivo monolítico (~4000 líneas) que contiene toda la UI del backoffice
- **Build tool:** Vite 5 con plugin `@vitejs/plugin-react`
- **Estilos:** TailwindCSS v4 (integrado via `@tailwindcss/vite`)
- **Despliegue:** Vercel (`web/vercel.json`)

---

## Firebase (Proyecto: `garageops-6511f`)

- **Firebase Project ID:** `garageops-6511f`
- **Config en mobile:** `src/config/firebase.js`
- **Config en web:** `web/src/firebase.js`

### Servicios Firebase usados

| Servicio | Uso |
|---|---|
| **Firebase Auth** | Autenticación por email/password. En móvil usa `AsyncStorage` para persistencia; en web usa `getAuth` estándar |
| **Firestore** | Base de datos principal. Colecciones por usuario: `users/{uid}/vehicles`, `users/{uid}/maintenances`, `users/{uid}/parts` |
| **Firebase Storage** | Almacenamiento de fotos de vehículos y recibos (`uploadService.js`) |

### Estructura Firestore

```
users/
  {uid}/            → { email, role, plan, updatedAt, ... }

vehicles/           → { userId, name, category, unit, usageNum, status, alerts[], photo, ... }
maintenances/       → { userId, vehicleId, title, date, cost, type, parts[], ... }
parts/              → { userId, name, compatibleVehicles[], minStock, purchases[], ... }
```

> **Nota:** Las colecciones `vehicles`, `maintenances` y `parts` están en la **raíz** de Firestore (no como subcolecciones de `users`). Cada documento incluye un campo `userId` para filtrar por usuario.

### Roles de usuario

- `admin` / `unlimited` → email contiene `apirezsalsa` o `admin`, o es `demo@garageops.io`
- `user` / `pro` → resto de usuarios (plan por defecto al registrarse: `pro`)

---

## Autenticación

### Móvil — `src/context/AuthContext.js`

- Exporta `AuthProvider` y `useAuth` (hook que devuelve `{ user, userProfile, loading }`)
- **Bridge especial para web:** si `Platform.OS === 'web'`, lee `localStorage.getItem('distrito_v2_session')` para autenticarse via Distrito Enduro sin pasar por Firebase Auth; si no hay sesión, redirige a `/login.html`
- En móvil usa Firebase `onAuthStateChanged` + `onSnapshot` del perfil en Firestore

### Web — `web/src/App.jsx`

- Auth gestionada directamente en el componente principal con `useState` + `onAuthStateChanged`
- `isSuperAdmin` true si el email incluye `apirezsalsa`, `admin`, o es `demo@garageops.io`
- Backoffice con panel de gestión de usuarios, regalo de días de suscripción e inspección de cuentas

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

## Servicios (`src/services/`)

| Archivo | Responsabilidad |
|---|---|
| `maintenanceService.js` | CRUD de mantenimientos en Firestore. Bifurca entre web (webApi REST) y móvil (Firestore directo) |
| `vehicleService.js` | CRUD de vehículos |
| `partsService.js` | CRUD de inventario de repuestos |
| `uploadService.js` | Subida de imágenes a Firebase Storage |
| `webApi.js` | Cliente HTTP genérico para la variante web de los servicios |

**Patrón de bifurcación:** todos los servicios comprueban `Platform.OS === 'web'` y redirigen a la API REST o a Firestore según corresponda.

---

## Planes de Suscripción (SaaS)

| Plan | Límite de vehículos | Descripción |
|---|---|---|
| `starter` | 2 | Para un vehículo principal |
| `pro` | 4 | Particulares con 2-4 vehículos |
| `unlimited` | ∞ | Sin límites (taller / gran garaje) |

- Planes validados en el frontend antes de crear nuevos vehículos
- Integración con **RevenueCat** (`react-native-purchases`) para la compra in-app en móvil
- Referencia a **Stripe** para facturación en la versión web

---

## Internacionalización

- **Móvil:** `i18next` con 6 idiomas. Ficheros JSON en `src/locales/`: `es.json`, `en.json`, `fr.json`, `de.json`, `it.json`, `pt.json`
- **Web:** diccionario `TRANSLATIONS` inline en `App.jsx` (actualmente es/en/it). Persistido en `localStorage` con clave `garageops_language`
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

### Web — Vite + Vercel

```bash
cd web
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción → dist/
```

- Despliegue automático en **Vercel**
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
5. **Onboarding spotlight** — Se resetea en cada login (código de testing activo en `App.js`). A eliminar antes de producción final.
6. **Rol SuperAdmin** — Determinado por email en el cliente. No hay verificación server-side adicional implementada.
7. **Datos de ejemplo (mock)** — La web tiene `INITIAL_VEHICLES`, `INITIAL_MAINTENANCES`, `INITIAL_PARTS` como fallback cuando Firestore está vacío.

---

## Variables de Entorno / Secretos

> Las claves de Firebase están hardcodeadas en los ficheros de configuración (patrón Expo/Firebase habitual para apps públicas). No hay `.env` activo. Si se añaden secretos sensibles (Stripe, RevenueCat), usar variables de entorno de EAS o Vercel según plataforma.

---

## Tareas Pendientes Conocidas

- [x] ~~Eliminar el reset de onboarding en `App.js`~~ — **No aplica a web** (pertenece a la app móvil desfasada; se resolverá en la futura migración mobile)
- [x] Añadir verificación server-side del rol SuperAdmin — **Resuelto**: `isSuperAdmin` ahora lee `role` y `plan` del documento Firestore del usuario. El check de email solo actúa como fallback mientras carga el perfil.
- [x] Completar las traducciones web — **Resuelto**: añadidos `fr` (Français), `de` (Deutsch) y `pt` (Português) al objeto `TRANSLATIONS`. El selector de idioma en login y en perfil muestra los 6 idiomas.
- [ ] ~~Implementar el endpoint `maintenance/all` en `webApi.js`~~ — **Pospuesto hasta migración mobile** (el panel web usa Firestore directamente con `onSnapshot`, no necesita `webApi.js`)
