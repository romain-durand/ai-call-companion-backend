## Description du projet
Le projet consiste en un SaaS qui offre un service d'assistant vocal AI.

L'utilisateur reçoit ses appels via un numéro Twilio partagé (actuellement le +33939244855). Un agent IA (basé sur l'IA Gemini) répond en temps réel, identifie l'appelant, applique des règles configurables, et peut consulter l'utilisateur, transférer l'appel, prendre rendez-vous ou laisser un message. L'IA gemini peut également effectuer des appels sortants (les "missions")

## Principales fonctionnalités utilisateurs
(note: le tu utilisé ci-dessous correspond à l'agent):

**Filtrage & gestion d'appels entrants** : tu réponds à la place de l'utilisateur (tu remplaces sa messagerie vocale). Tu sais identifier l'appelant s'il est enregistré dans ses contacts et tu sais l'associer à un groupe (ex: famille, amis, travail, inconnus). Tu sais appliquer des règles selon les groupes.

**Comportements possibles** : tu sais prendre un message, transférer en direct un appel, consulter l'utilisateur par chat en direct, prendre un RDV ou bloquer l'appel. Si des instructions personnalisées sont associées au contact ou au groupe, tu sais prendre en compte ces instructions spéciales.

**Groupes d'appelants** : des groupes existent par défaut et on peut les modifier, en effacer ou en ajouter.

**Contacts** : il y a une fiche par personne (nom, numéro, instructions spéciales personnalisées, appartenance à un ou plusieurs groupes).

**Modes assistant** : Travail, Personnel, Concentration — un seul actif à la fois ; chaque mode définit comment chaque groupe est traité avec des règles spéciales (par exemple en mode Personnel, un appelant du groupe Travail ne sera pas transféré en direct). Il y a aussi un mode par défaut « Autonomie totale » où c'est l'assistant qui prend les décisions au mieux.

**Calendrier** : prise de RDV automatique avec consultation et gestion du calendrier Google. Il faut au préalable avoir connecté son calendrier Google dans les réglages. Si on a plusieurs calendriers, on peut choisir dans les réglages les calendriers à utiliser pour vérifier la disponibilité et celui à utiliser pour la prise de rendez-vous.

**Historique & résumés** : chaque appel a un résumé court + long généré automatiquement, consultable. La transcription complète de la conversation est aussi consultable dans l'historique.

**Missions sortantes** : cette fonctionnalité te permet d'appeler quelqu'un pour le compte de l'utilisateur (ex: réservation d'un restaurant, ou appeler un proche pendant une réunion — par exemple demander à son conjoint d'aller chercher l'enfant à la crèche). Il faut au minimum préciser un objectif et un destinataire (contact existant ou numéro de téléphone). En option : un **contexte partageable** (infos que tu peux révéler si nécessaire mais pas systématiquement), un **contexte secret** (infos que tu connais mais ne dois JAMAIS révéler), et la possibilité pour l'utilisateur de demander à être consulté par chat en cours d'appel (utile s'il ne peut pas parler).

**Contexte utilisateur ("À propos de moi")** : l'utilisateur peut définir un contexte le concernant pour que tes réponses soient plus pertinentes. Il y a deux temporalités et deux niveaux de confidentialité, soit 4 champs. ⚠️ Les identifiants techniques entre crochets ci-dessous sont à USAGE INTERNE uniquement (pour appeler l'outil set_about_me). Ne les prononce JAMAIS à voix haute. À l'oral, utilise toujours les libellés naturels (« ton À propos de toi partageable », « ta note actuelle confidentielle », etc.) :
   - **À propos de moi — partageable** [interne: about_shareable] : info GÉNÉRALE et DURABLE sur l'utilisateur que tu peux révéler à un appelant si c'est pertinent (ex: "Je suis avocat en droit du travail, basé à Paris"). Ne la révèle pas systématiquement, mais utilise-la pour donner du contexte aux interlocuteurs quand utile.
   - **À propos de moi — confidentielle** [interne: about_confidential] : info GÉNÉRALE et DURABLE que tu dois CONNAÎTRE pour mieux servir l'utilisateur, mais que tu ne révèles JAMAIS à personne (ex: "Mon associé principal est X", "J'évite les commerciaux après 18h pour raisons familiales"). Sert à mieux décider sans exposer.
   - **Note actuelle — partageable** [interne: current_note_shareable] : info PONCTUELLE / TEMPORAIRE partageable, optionnellement avec une date d'expiration (ex: "Je suis en déplacement à Lyon cette semaine, joignable par mail").
   - **Note actuelle — confidentielle** [interne: current_note_confidential] : info PONCTUELLE / TEMPORAIRE strictement secrète (ex: "Je négocie un deal sensible avec X — ne mentionne aucun rendez-vous lié"). Permet d'éviter des bourdes contextuelles.



-----------

## Stack technique actuelle

| Couche | Technologie |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui, framer-motion, React Query, react-router-dom |
| State auth | Supabase Auth (Google + Apple OAuth managé par Lovable Cloud broker) |
| Backend appels | Node.js, ws (WebSocket), Twilio Media Streams, Google Gemini Live API (audio bidirectionnel) |
| DB | Postgres via Supabase (Lovable Cloud), RLS strict multi-tenant |
| Edge Functions | `gemini-key`, `import-vcard`, `notify-n8n` |
| Intégrations | Google Calendar (OAuth), Google People API (contacts), n8n (webhooks SMS) |
| Audio | mulaw 8kHz (Twilio) ↔ PCM 16kHz (Gemini in) ↔ PCM 24kHz (Gemini out) |


## Modèle de données (Supabase) — tables principales

**Identité & multi-tenant**
- `profiles` (user info, `phone_e164`)
- `accounts` (espace de travail)
- `account_members` (jonction profile↔account, roles `owner/admin/member`, flag `is_default_account` unique)
- `phone_numbers` (numéros loués/portés, `is_default_outbound` unique global)
- Vue `public_profiles` (id + display_name, expo sécurisée pour `/call/:profileId`)

**Configuration assistant**
- `assistant_profiles` (1 par compte, `is_default`)
- `assistant_modes` (Travail / Personnel / Nuit / Focus, 1 actif via `is_active`, flag `allow_booking`, `control_mode` ∈ `strict_policy/model_discretion/full_autonomy`)
- `caller_groups` (Famille, Amis, Travail, VIP, Bloqués, Non classés — `priority_rank` détermine la priorité, `default_group` non supprimable, `custom_instructions`)
- `contacts` + `contact_group_memberships` (un contact peut appartenir à plusieurs groupes)
- `call_handling_rules` (matrice Mode × Groupe → 1 des 5 `behavior` : `take_message`, `transfer`, `ask_user`, `book_appointment`, `block`)

**Téléphonie & sessions**
- `call_sessions` (provider, direction inbound/outbound, started/ended, outcome, summaries, account/profile/phone/mode/group/contact résolus)
- `call_messages` (transcript, `seq_no` unique par session, speaker, content_text)
- `tool_invocations` (audit de chaque tool call Gemini)
- `live_chat_messages` (consult_user — direction `to_user`/`to_assistant`, status `pending/replied/timeout`)
- `transfer_requests` (warm transfer — `pending/accepted/declined/timeout`)
- `callback_requests`, `escalation_events`, `notifications`, `notification_preferences` (par profil/event/channel, contrainte unique étendue)
- `appointments`, `booking_types`, `booking_rules`
- `calendar_connections` (Google OAuth tokens chiffrés AES-256-GCM)
- `outbound_missions` (objectif, contraintes, statut, `report_result`)

**Triggers de cohérence multi-tenant** : chaque INSERT vérifie l'appartenance des FK au même `account_id` (ex: `check_call_session_account`, `check_callback_account`, etc.). `handle_new_user` initialise tout (compte, modes, groupes, règles, prefs) à l'inscription.

**RLS** : toutes les tables filtrées via `is_account_member(auth.uid(), account_id)` / `is_account_admin(...)`. Fonctions toujours préfixées `public.`

---

## Backend `bridge-server/` — modules clés

**Entrée HTTP/WS** (`src/index.js`) : un seul serveur Node expose
- POST `/twilio-voice` → renvoie TwiML avec `<Connect><Stream>` paramétré
- WS `/` (par défaut) → `twilioConnection.js` (appels entrants Twilio)
- WS `/transfer-audio` → `transferAudioHandler.js` (warm transfer)
- WS `/outbound-stream` → `outboundStreamHandler.js` (missions sortantes)
- WS `/web-call` → `webCallHandler.js` (appels web depuis l'app)
- GET/POST `/auth/google/...` (Calendar + People OAuth) + `/contacts/google/import`

**Routage entrant** (`twilioVoiceHandler.js`) : matche les ≥8 derniers chiffres du numéro appelé/forwardé contre `profiles.phone_e164` pour résoudre le compte/profil cible.

**Pipeline audio inbound** :
```text
Twilio mulaw 8k → décode → upsample 16k PCM → Gemini Live (WS)
Gemini PCM 24k → downsample 8k → encode mulaw → Twilio
```

**Contexte runtime** (`runtimeContextBuilder.js`) : à chaque appel, construit un bloc texte injecté dans le `setup` Gemini contenant : utilisateur, timezone, "À propos de moi", note temporaire, mode actif, règles du groupe appelant, comportement attendu, full_autonomy override. Évite ainsi un double tour de parole.

**Outils Gemini déclarés** (`geminiConfig.js`, routés dans `toolRouter.js`) :
- `get_caller_profile`, `create_callback`, `notify_user`
- `consult_user` (whisper synchrone, polling DB)
- `transfer_call` (warm transfer, polling status)
- `check_availability`, `book_appointment` (Google Calendar)
- `generate_call_summary` (OBLIGATOIRE avant `end_call`)
- `end_call(reason)`

**Garde-fous fail-closed** : `create_callback` et `book_appointment` re-vérifient le `behavior` de la règle Mode×Groupe avant exécution (sauf `full_autonomy`).

**Résilience DB** : tous les writes Supabase sont non bloquants (`.catch(log)`) pour ne jamais couper l'audio.

**Outbound** (`outboundCallExecutor.js` + `outboundPoller.js`) : poll `outbound_missions`, pré-connecte Gemini avant Twilio dial, attend que le destinataire parle (6ms gate) avant la 1re prise de parole de l'IA.

**Résumés** : `generateDeterministicSummary.js` peuple `summary_short`/`summary_long` à la fin selon une hiérarchie à 6 règles (transfer→callback→appointment→escalation→notify→fallback). `summary_llm` vient de l'outil `generate_call_summary`.

---

## Frontend `src/` — structure

**Routing** (`App.tsx`) : `/login`, `/call/:profileId` (page publique web call), puis routes protégées sous `DashboardLayout` :
- `/` Dashboard
- `/activity` (Tabs: Historique + Missions)
- `/more` Hub Réglages
  - `/who` (Qui peut me joindre — contacts/groupes)
  - `/how` (Comment gérer — matrice mode×groupe)
  - `/when` (Quand me prévenir — désactivé de la nav, route conservée)
  - `/about-me`, `/calendar`, `/call-link`, `/settings`
- `/assistant`, `/test` (debug Gemini, hors nav)

**Navigation** :
- Mobile : `BottomTabBar` 3 onglets (Accueil / Activité / Réglages)
- Desktop : `AppSidebar` 3 sections miroir
- Sous-pages de Réglages : `BackToSettingsButton` pour retour à `/more`

**Pattern Data Providers** (`src/data/providers/<feature>/{demo,live,index}.ts`) :
- `useUserAccountId` / `useAccountMode` résolvent l'account par défaut + flag `isDemo`
- Bascule auto live/démo selon `accounts.is_demo`
- Tous les writes opérationnels passent par le backend service-role ; le frontend ne fait que CRUD utilisateur (config, contacts, modes, groupes)

**Composants temps réel sur Dashboard** :
- `LiveConsultBanner` : Realtime + polling 3s sur `live_chat_messages`, input réponse → INSERT `to_assistant`
- `TransferCallBanner` : Realtime sur `transfer_requests`, accept/decline + WS `/transfer-audio` audio bidirectionnel
- `ActiveModeSelector` : switch live du mode actif
- `CallMyAssistantButton` → `OwnerCallDialog` (autoStart) → web call WS

**Auth** (`AuthContext.tsx` + `Login.tsx`) : Google + Apple OAuth via Lovable Cloud broker (`/~oauth/initiate`), credentials gérés côté Cloud, tokens persistés dans `localStorage`. Route guard via `ProtectedRoute`.

---

## Logique métier critique (memory)

1. **3 axes de décision IA** : Qui (groupe + priority_rank) × Quoi (intent) × Interruption (mode actif) → 1 des 5 behaviors.
2. **Hiérarchie booking** : `assistant_modes.allow_booking=false` override toujours `call_handling_rules.behavior=book_appointment`.
3. **Identity resolution display** : transcription name > contact name > phone.
4. **Priority labels** : priority_rank max des groupes du contact → urgent/high/normal/low.
5. **Full autonomy** : désactive les locks backend MAIS doit toujours respecter `custom_instructions` du groupe.
6. **Call termination** : protocole strict — politesse → `generate_call_summary` → `end_call(reason)`.
7. **Notification SMS via n8n** : templates déterministes courts, jamais générés par IA.
8. **Live consult dedup** : `transcriptBuffer.js` dédoublonne fragments identiques consécutifs.

---

## Sécurité & contraintes

- RLS partout, fonctions schema-prefixed
- Tokens calendrier chiffrés AES-256-GCM (clé env `CALENDAR_TOKEN_KEY`)
- `public_profiles` view = seule expo non-auth (id + display_name pour /call/:profileId)
- Unique constraints critiques : `is_default_outbound`, `is_default_account`, calendar `(account_id, provider, profile_id)`, notif prefs `(account_id, profile_id, event_type, channel)`
- Groupe `default_group` non supprimable ; groupe avec contacts non supprimable
- Validations via triggers (jamais CHECK constraints non-immutables)

---

## État actuel du produit (récent)


**Limites identifiées non livrées** :
- `consult_user` et `transfer_call` n'émettent **aucune notification système** — l'utilisateur doit avoir l'app ouverte. À résoudre lors du portage iOS via APNs/CallKit.
- `notify_user` est en mode "stored only" (livraison réelle non implémentée hors callback SMS).
- Apple Sign In : disponible mais non testé en prod (broker OAuth Lovable).

---

## Variables d'environnement clés

**Frontend** (`.env` auto-géré) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

**Backend bridge** (Render) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_BRIDGE_WS_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_TOKEN_KEY`, `N8N_WEBHOOK_URL`

**Edge functions secrets** (déjà set) : `LOVABLE_API_KEY`, `GEMINI_API_KEY`, et toute la famille `SUPABASE_*`

---


