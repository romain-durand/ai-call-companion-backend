

## URL dédiée par utilisateur avec accès WebSocket au bridge server

### Concept
Chaque utilisateur obtient une URL publique `/call/:profileId` (ex: `/call/b7ddff90-ac2f-44e8-ab4f-05fca04d8822`) avec QR code. Un visiteur qui ouvre cette URL arrive sur une page web qui :
1. Affiche le nom de l'assistant et un bouton "Appeler"
2. Optionnellement demande le numéro de téléphone du visiteur (champ `From`)
3. Capture le micro du visiteur et ouvre un WebSocket vers le bridge server
4. Le bridge server traite cette connexion exactement comme un appel Twilio entrant

### Modifications

#### 1. Bridge server — nouveau endpoint WebSocket `/web-call`
- Nouveau fichier `bridge-server/src/web/webCallHandler.js`
- Accepte une connexion WebSocket depuis un navigateur
- Le navigateur envoie un message initial JSON `{ type: "start", profileId, callerPhone }` 
- Le handler résout `profileId` → `accountId`, `activeModeId`, `phoneNumberId` (même logique que `twilioVoiceHandler`)
- Crée un `callContext` et connecte à Gemini comme `twilioConnection.js`
- Audio : le navigateur envoie du PCM 16kHz base64 (pas de mulaw), le handler le forwarde directement à Gemini
- Audio retour : le handler envoie le PCM de Gemini vers le navigateur en base64
- Pas besoin de codec mulaw ni de `streamSid` — protocole simplifié

#### 2. Bridge server — route WebSocket dans `index.js`
- Ajouter `pathname === "/web-call"` dans le handler `upgrade`
- Router vers `handleWebCallConnection(ws, req)` (le `profileId` peut être passé via query string ou dans le premier message)

#### 3. Frontend — page publique `/call/:profileId`
- Nouveau fichier `src/pages/WebCallPage.tsx`
- Route publique (hors `ProtectedRoute`)
- Fetche le profil (display_name) via une requête publique ou un endpoint HTTP du bridge
- Affiche : nom de l'assistant, champ optionnel "Votre numéro de téléphone", bouton Appeler
- Au clic : demande accès micro, ouvre WebSocket vers `wss://bridgeserver.ted.paris/web-call`
- Envoie le message `start` avec `profileId` et `callerPhone`
- Capture audio micro → PCM 16kHz → base64 → WebSocket
- Reçoit audio retour → décode base64 → joue via AudioContext
- Affiche un indicateur visuel pendant l'appel
- QR code généré côté client avec une lib comme `qrcode.react`

#### 4. Frontend — route dans `App.tsx`
- Ajouter `/call/:profileId` comme route publique avant le `ProtectedRoute`

#### 5. Page Settings — afficher l'URL et QR code
- Dans `SettingsPage.tsx`, ajouter une section "Mon lien d'appel" affichant l'URL dédiée et un QR code

### Détails techniques

**Protocole WebSocket navigateur ↔ bridge :**
```text
Browser → Server:  { type: "start", profileId: "...", callerPhone: "+33..." }
Browser → Server:  { type: "audio", data: "<base64 PCM 16kHz>" }
Server → Browser:  { type: "audio", data: "<base64 PCM 16kHz/24kHz>" }
Server → Browser:  { type: "ended", reason: "..." }
```

**Pas de mulaw** : le navigateur travaille nativement en PCM linéaire, on évite la conversion mulaw.

**call_sessions** : direction sera `inbound`, provider sera `web` (au lieu de `twilio`).

**Sécurité** : la page est publique (pas d'auth requise), le `profileId` fait office de token. Pas de données sensibles exposées — seul le display_name est affiché.

**Dépendance npm** : `qrcode.react` pour le QR code côté frontend.

