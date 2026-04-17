

## Plan: Assistant vocal personnel ("Appeler mon assistant")

Ajout d'un bouton sur le tableau de bord permettant à l'utilisateur d'appeler son propre assistant via WebRTC pour : aide en ligne, consultation d'infos compte, et configuration vocale (instructions spéciales, "À propos de moi", création de missions).

### Architecture

Réutilisation de l'infrastructure existante `WebCallPage` + `webCallHandler.js` (bridge server), avec un nouveau **mode "owner"** qui :
- Identifie l'appelant comme étant le propriétaire du compte (pas un appelant externe)
- Charge un système prompt et un set d'outils différents
- Donne accès à des outils d'écriture sur la base

### Composants à créer/modifier

**1. Frontend — Tableau de bord**
- `src/components/CallMyAssistantButton.tsx` (nouveau) : Carte proéminente avec bouton "Appeler mon assistant" sur le Dashboard, ouvrant un modal de session vocale.
- `src/components/OwnerCallDialog.tsx` (nouveau) : Dialog avec micro/haut-parleur, statut connexion, transcript live, bouton raccrocher. Réutilise la logique audio de `WebCallPage` (PcmPlayer, AudioContext 16k/24k, WebSocket).
- `src/pages/Dashboard.tsx` : Ajout du composant en haut.

**2. Bridge server — Mode owner**
- `bridge-server/src/web/webCallHandler.js` : Accepter un paramètre `mode: "owner"` au message `start`. Si owner :
  - Vérifier que `profileId` correspond bien à un membre admin du compte (via service role)
  - Charger le contexte owner au lieu du contexte appelant standard
  - Utiliser un nouveau setup payload Gemini
- `bridge-server/src/owner/ownerGeminiConfig.js` (nouveau) : Système prompt dédié + déclarations d'outils owner.
- `bridge-server/src/owner/ownerToolRouter.js` (nouveau) : Router les appels d'outils owner vers les bons handlers.
- `bridge-server/src/owner/ownerContextBuilder.js` (nouveau) : Construit un contexte runtime riche (qui a appelé aujourd'hui, missions en cours, modes, groupes, contacts récents, "À propos de moi", etc.).

**3. Outils vocaux owner (nouveau)**
- `get_account_overview()` : Stats du jour (appels reçus, callbacks, missions en cours)
- `list_recent_calls(limit)` : Liste des derniers appels avec résumés
- `list_contacts_and_groups()` : Liste contacts/groupes pour référence
- `set_contact_instructions(contact_query, instructions)` : Recherche un contact par nom puis met à jour `contacts.custom_instructions`
- `set_group_instructions(group_query, instructions)` : Idem pour `caller_groups.custom_instructions`
- `set_about_me(field, content)` : Met à jour un des 4 champs (`about_shareable`, `about_confidential`, `current_note_shareable`, `current_note_confidential`) sur `accounts`
- `create_outbound_mission({objective, target_name, target_phone, context_flexible, context_secret, allow_consult_user, scheduled_at})` : Crée une ligne dans `outbound_missions`
- `end_call()` : Raccrocher

### Système prompt owner (extrait)

```
Tu es l'assistant personnel de [USER_NAME]. Tu lui parles directement (pas un 
appelant externe). Tu peux:
1. Expliquer tes fonctionnalités (aide en ligne)
2. Donner des infos sur son compte (appels, missions, contacts)
3. Configurer oralement: instructions spéciales par contact/groupe, 
   "À propos de moi" (4 champs), créer des missions sortantes

Pour toute modification, REFORMULE la valeur cible et demande confirmation 
explicite avant d'appeler l'outil. Pour une mission, confirme objectif + 
numéro avant création.
```

### Flux technique

```text
Dashboard → [Appeler mon assistant] → OwnerCallDialog
   ↓ wss://bridgeserver.ted.paris/web-call
   ↓ start {mode:"owner", profileId, accountId}
Bridge: vérifie admin → connecte Gemini avec ownerSetupPayload + contexte owner
   ↓ audio bidirectionnel (16k up / 24k down)
Outils → ownerToolRouter → Supabase (service role) → réponse vocale
```

### Sécurité

- Bridge vérifie côté serveur (service role) que `profileId` est admin du `accountId` ciblé avant d'activer le mode owner. Refus sinon.
- Le frontend passe `profileId` depuis `useAuth()` ; aucune confiance aveugle, le bridge re-vérifie.
- Les outils d'écriture utilisent le service role mais sont scopés au `accountId` du contexte (impossible d'écrire ailleurs).
- Confirmation orale obligatoire avant toute modification (enforced par le système prompt).

### Hors scope (non inclus)

- Persistance de l'historique des sessions owner (réutilise `call_sessions` avec un flag `direction='owner'` ou metadata — à confirmer)
- Authentification renforcée type code PIN vocal (peut être ajouté plus tard)

### UI

Carte sur Dashboard, juste sous le header, avec :
- Icône micro + titre "Parler à mon assistant"
- Sous-titre : "Aide, infos compte, ou configuration vocale"
- Bouton primaire "Appeler"

Dialog plein écran mobile / centré desktop avec visualiseur audio (réutiliser `AudioWave`), statut, transcript optionnel, bouton "Raccrocher".

