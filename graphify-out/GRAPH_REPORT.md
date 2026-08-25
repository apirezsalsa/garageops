# Graph Report - .  (2026-08-15)

## Corpus Check
- 11 files · ~129,195 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 342 nodes · 492 edges · 22 communities (16 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_React Native Navigation & Auth Screens|React Native Navigation & Auth Screens]]
- [[_COMMUNITY_Mobile Dependencies & Expo Configuration|Mobile Dependencies & Expo Configuration]]
- [[_COMMUNITY_Web App Core Billing, Firebase & Monitoring|Web App Core: Billing, Firebase & Monitoring]]
- [[_COMMUNITY_Mobile Vehicle Services & Maintenance Screens|Mobile Vehicle Services & Maintenance Screens]]
- [[_COMMUNITY_Expo App Configuration|Expo App Configuration]]
- [[_COMMUNITY_Firebase Cloud Functions & Stripe Billing|Firebase Cloud Functions & Stripe Billing]]
- [[_COMMUNITY_Web Dependencies & UI Packages|Web Dependencies & UI Packages]]
- [[_COMMUNITY_Backend Functions Dependencies|Backend Functions Dependencies]]
- [[_COMMUNITY_Web TypeScript Configuration|Web TypeScript Configuration]]
- [[_COMMUNITY_Mobile Vehicle List, Dashboard & Spotlight Onboarding|Mobile Vehicle List, Dashboard & Spotlight Onboarding]]
- [[_COMMUNITY_Web PWA Manifest|Web PWA Manifest]]
- [[_COMMUNITY_Architecture, Data Model & Brand Assets|Architecture, Data Model & Brand Assets]]
- [[_COMMUNITY_Web Billing Utils & Tests|Web Billing Utils & Tests]]
- [[_COMMUNITY_Backend Plan Matching & Tests|Backend Plan Matching & Tests]]
- [[_COMMUNITY_Web Service Worker & Push Messaging|Web Service Worker & Push Messaging]]
- [[_COMMUNITY_Vercel Deployment Configuration|Vercel Deployment Configuration]]
- [[_COMMUNITY_Context7 Agent Skill|Context7 Agent Skill]]
- [[_COMMUNITY_Ponytail Agent Skill|Ponytail Agent Skill]]
- [[_COMMUNITY_GitHub Actions CI Pipeline|GitHub Actions CI Pipeline]]
- [[_COMMUNITY_Mobile Vehicle Graphics|Mobile Vehicle Graphics]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `expo` - 14 edges
3. `useAuth()` - 13 edges
4. `App()` - 12 edges
5. `AddMaintenanceScreen()` - 10 edges
6. `uploadImage()` - 9 edges
7. `PartsScreen()` - 8 edges
8. `VehicleDetailScreen()` - 8 edges
9. `db` - 7 edges
10. `getVehicles()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `RootLayout()` --calls--> `useAuth()`  [EXTRACTED]
  App.js → src/context/AuthContext.js
- `Web HTML Entrypoint` --conceptually_related_to--> `GarageOps Architecture`  [INFERRED]
  web/index.html → .agents/AGENTS.md
- `App()` --references--> `react`  [EXTRACTED]
  web/src/App.jsx → package.json
- `Web Branding Assets & Logos` --references--> `Web HTML Entrypoint`  [EXTRACTED]
  web/public/logo.png → web/index.html
- `AddMaintenanceScreen()` --calls--> `useAuth()`  [EXTRACTED]
  src/screens/AddMaintenanceScreen.js → src/context/AuthContext.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GarageOps Core Specifications** — agents_agents_agents_md_garageops_architecture, agents_agents_agents_md_firestore_data_model, agents_agents_agents_md_saas_subscription_plans, agents_agents_agents_md_authentication_flow [EXTRACTED 1.00]

## Communities (22 total, 6 thin omitted)

### Community 0 - "React Native Navigation & Auth Screens"
Cohesion: 0.06
Nodes (33): RootLayout(), Stack, Tab, firebase, app, db, firebaseConfig, TODO: Add SDKs for Firebase products that you want to use (+25 more)

### Community 1 - "Mobile Dependencies & Expo Configuration"
Cohesion: 0.05
Nodes (42): dependencies, expo, expo-constants, expo-image-picker, expo-localization, @expo/metro-runtime, @expo/ngrok, expo-notifications (+34 more)

### Community 2 - "Web App Core: Billing, Firebase & Monitoring"
Cohesion: 0.08
Nodes (27): App(), react, addMonths(), App(), computeNextRenewal(), getInspectionLabel(), getInspectionStatus(), getLocalizedPlanList() (+19 more)

### Community 3 - "Mobile Vehicle Services & Maintenance Screens"
Cohesion: 0.13
Nodes (27): AddMaintenanceScreen(), CAR_CATEGORIES, getCategories(), MOTO_CATEGORIES, styles, HistoryScreen(), styles, MaintenanceListScreen() (+19 more)

### Community 4 - "Expo App Configuration"
Cohesion: 0.07
Nodes (29): backgroundColor, foregroundImage, adaptiveIcon, package, softwareKeyboardLayoutMode, statusBar, projectId, expo (+21 more)

### Community 5 - "Firebase Cloud Functions & Stripe Billing"
Cohesion: 0.10
Nodes (18): auth, checkVehicleAlerts, createCheckoutSession, createPortalSession, db, deleteUserAccount, fetchPlans(), findPlanByStripePriceId() (+10 more)

### Community 6 - "Web Dependencies & UI Packages"
Cohesion: 0.09
Nodes (22): dependencies, firebase, lucide-react, react, react-dom, devDependencies, tailwindcss, @tailwindcss/vite (+14 more)

### Community 7 - "Backend Functions Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, firebase-admin, firebase-functions, stripe, description, devDependencies, vitest, engines (+12 more)

### Community 8 - "Web TypeScript Configuration"
Cohesion: 0.11
Nodes (17): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 9 - "Mobile Vehicle List, Dashboard & Spotlight Onboarding"
Cohesion: 0.15
Nodes (13): ICON_MAP, SpotlightOverlay(), styles, { width, height }, DashboardScreen(), defaultImages, getVehicleImage(), styles (+5 more)

### Community 10 - "Web PWA Manifest"
Cohesion: 0.22
Nodes (8): background_color, display, icons, name, orientation, short_name, start_url, theme_color

### Community 11 - "Architecture, Data Model & Brand Assets"
Cohesion: 0.33
Nodes (6): Authentication & Roles, Firestore Data Model, GarageOps Architecture, SaaS Subscription Plans, Web HTML Entrypoint, Web Branding Assets & Logos

### Community 12 - "Web Billing Utils & Tests"
Cohesion: 0.60
Nodes (4): computePlanStats(), isGiftedAccess(), isUnderVehicleLimit(), plansById

### Community 13 - "Backend Plan Matching & Tests"
Cohesion: 0.60
Nodes (3): matchPlanByPriceId(), pickFallbackFreePlanId(), plans

## Knowledge Gaps
- **178 isolated node(s):** `Tab`, `Stack`, `name`, `slug`, `version` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Mobile Dependencies & Expo Configuration` to `React Native Navigation & Auth Screens`, `Web App Core: Billing, Firebase & Monitoring`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `App()` connect `Web App Core: Billing, Firebase & Monitoring` to `React Native Navigation & Auth Screens`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `firebase` connect `React Native Navigation & Auth Screens` to `Mobile Dependencies & Expo Configuration`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `Tab`, `Stack`, `name` to the rest of the system?**
  _179 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React Native Navigation & Auth Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.06259426847662142 - nodes in this community are weakly interconnected._
- **Should `Mobile Dependencies & Expo Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Web App Core: Billing, Firebase & Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.08414634146341464 - nodes in this community are weakly interconnected._