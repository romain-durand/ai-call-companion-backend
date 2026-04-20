# Audit Clarifications — Lovable Response

## Routes & Pages

### `/history` vs `ActivityPage`
- **Statut**: Redondance volontaire, pas un doublon
- **Détail**: `ActivityPage` (/activity) = hub avec 2 onglets (Historique + Missions)
  - Onglet Historique monte le composant `<CallHistory />` (pas une copie, réutilisé)
  - Route `/history` existe en standalone pour deep-linking (utilisée par `ActivityTimeline` du Dashboard et liens "Voir tout")
  - Pas en navigation (BottomTabBar/AppSidebar)
- **À faire plus tard**: Soit consolider vers `/activity?tab=history`, soit garder `/history` comme deep-link privé

### `CallLinkPage` ≠ `WebCallPage`
- **CallLinkPage** (/call-link protégée): Page propriétaire pour partager lien public
  - Affiche lien `/call/:userId` + QR code
- **WebCallPage** (/call/:profileId public): Page que voit le contact qui appelle
  - Deux faces de la même fonctionnalité: "je partage" vs "on m'appelle"

### `TestAssistant` vs `Assistant`
- **Assistant.tsx** (/assistant): Ancienne page Gemini Live avec useGeminiLive, prompt éditable
  - Plus dans nav (hors OwnerCallDialog)
  - **Candidat suppression** maintenant que OwnerCallDialog couvre le besoin
- **TestAssistant.tsx** (/test): Simulateur scénarios figés, mockés pour démo/QA UX
  - Ne touche pas Gemini réel
  - **À conserver** pour démo

---

## Outils Gemini & Backend

### 3 Configs Gemini distinctes

**geminiConfig.js** (inbound — secrétaire)
- Contexte: Appel reçu d'un tiers
- Outils: get_caller_profile, create_callback, notify_user, consult_user, transfer_call, check_availability, book_appointment, generate_call_summary, end_call

**outboundGeminiConfig.js** (missions sortantes)
- Contexte: Appel lancé par l'IA pour le compte de l'utilisateur
- Outils: report_result, consult_user (conditionnel si allow_consult_user=true), end_call
- Très restreint: pas de booking, pas de callback, pas de notify — objectif unique défini par la mission

**ownerGeminiConfig.js** (owner — l'IA au service du propriétaire)
- Contexte: Utilisateur appelle son propre assistant via /web-call ou OwnerCallDialog
- Outils: set_about_me, create_contact, create_outbound_mission, set_confirmation_mode, etc.
- Routé via ownerToolRouter.js (détecté quand caller = utilisateur lui-même)
- **set_about_me**: Mode='append' par défaut (jamais écrasement implicite)
  - 4 champs: about_shareable, about_confidential, current_note_shareable, current_note_confidential

### Implémentation SMS via n8n

**create_callback flux réel**:
1. INSERT callback_requests
2. createFromCallback() → INSERT notifications (canal=SMS, status=pending)
3. deliverCallbackNotifications() (fire-and-forget):
   - Lit notification_preferences triées par fallback_order
   - Applique threshold/quiet hours/enabled
   - Appelle sendSms() → POST n8n webhook (N8N_SMS_WEBHOOK_URL)
   - Met à jour notifications.status à sent/failed
   - Corps SMS = déterministe (jamais généré par IA)

**notify_user statut**:
- INSERT notifications mais attemptNotificationDelivery() = "stored" (MVP)
- Pas encore branché sur notificationDeliveryService
- Canaux implémentés: SMS seul
- Non implémentés: push, email, voice (future phases)

---

## Notifications & Real-time

### État actuel (app au premier plan requis)
- **consult_user**: Polling DB (1s) + Realtime + polling 3s côté front (LiveConsultBanner)
- **transfer_call**: Idem (TransferCallBanner)
- Limitation: App doit être ouverte sinon ratés

### Roadmap iOS/APNs/CallKit (pas formalisée, mais cible claire)

**Architecture future**:
1. Nouvelle table `device_tokens`
2. Nouveau module `bridge/pushNotificationService.js` appelé après chaque INSERT live_chat_messages/transfer_requests
3. Plugin Capacitor `@capacitor/push-notifications` + listener `pushNotificationActionPerformed` → nav vers /
4. Optionnel: CallKit + PushKit pour transfer_call (UI native d'appel entrant) — immersif mais nécessite VoIP push certificate Apple distinct

**Importante**: Aucun refactor frontend nécessaire avant portage iOS
- Pattern bannière + Realtime actuel reste correct au foreground
- APNs/CallKit se complètent naturellement avec le pattern existant

---

## Code & Architecture

### Loose typing volontaire
- Contexte: Lovable génère vite; strict bloquerait itérations IA sur nulls de Supabase (attendus sémantiquement)
- Typage utilisé (composants, props, providers) mais sans sévérité maximale
- **Plan durcissement progressif** quand stabilise:
  1. Activer strictNullChecks d'abord (meilleur ROI métier)
  2. Puis noImplicitAny
  3. Fichier par fichier via // @ts-check ciblés

### Tests — Stratégie non déployée

**Setup existant**: vitest + @testing-library, playwright.config.ts (scaffold), example.test.ts = placeholder

**Ordre implémentation suggéré**:
1. **Tests unitaires providers** (src/data/providers/*/live.ts) — couvrent requêtes critiques multi-tenant
2. **Tests bridge-server** sur runtimeContextBuilder, toolRouter (fail-closed booking/callback), transcriptBuffer dedup
3. **E2E Playwright** flux critiques: login OAuth, configurer mode/groupe, lancer web-call
4. **Bannières temps réel** — mock Realtime