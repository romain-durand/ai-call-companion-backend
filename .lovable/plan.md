

## Plan : Importer les contacts (Google + Apple/vCard)

### Approche

Le bouton "Importer" devient un menu avec 2 options :
1. **Google Contacts** — OAuth (People API), import direct.
2. **Fichier vCard (.vcf)** — pour iCloud/Apple/autres. Apple ne fournit pas d'API publique ; la voie standard est l'export `.vcf` depuis iCloud.com ou l'app Contacts.

### Backend

**Edge function `import-google-contacts`**
- Reçoit le `account_id` (JWT vérifié).
- Lance le flux OAuth Google avec scope `https://www.googleapis.com/auth/contacts.readonly` (réutilise la logique de `bridge-server/src/auth/googleOAuth.js` mais en edge function pour rester dans le scope Lovable, OU étend la table `calendar_connections` pour stocker aussi le scope contacts).
- **Décision retenue** : nouvelle table `contact_import_connections` (provider, account_id, encrypted tokens) pour ne pas mélanger avec calendrier. Plus propre.
- Une fois autorisé : appelle `people.connections.list` (champs `names,phoneNumbers,emailAddresses,organizations`), normalise, insère dans `contacts` avec `source = 'google_import'`.
- Normalisation téléphone : si commence par `0` → `+33`, sinon garde tel quel. Skip les contacts sans téléphone ni email.
- Déduplication : si `primary_phone_e164` existe déjà pour ce compte → skip (ou update si flag).

**Edge function `import-vcard`**
- Reçoit le contenu du fichier `.vcf` + `account_id`.
- Parse vCard (FN, N, TEL, EMAIL, ORG, NOTE).
- Même logique de normalisation/déduplication que Google.
- Retourne `{ imported, skipped, errors }`.

### Frontend

**`src/pages/ContactsPage.tsx`**
- Remplacer le bouton "Importer" désactivé par un `DropdownMenu` :
  - "Depuis Google Contacts" → lance OAuth (popup ou redirection vers edge function `google-contacts-start`).
  - "Depuis un fichier (.vcf)" → ouvre `<input type="file" accept=".vcf">`, lit le contenu, appelle l'edge function.
- Toast de progression + résultat (`X contacts importés, Y ignorés`).
- Invalide `["contacts"]` après succès.

**Nouveau composant `src/components/contacts/ImportContactsMenu.tsx`**
- Encapsule le menu + la logique de fichier + l'appel OAuth.
- Gère le retour OAuth via `?import=google&status=success` (similar au pattern existant pour calendar).

### Base de données

**Migration** :
- Nouvelle table `contact_import_connections` : `id, account_id, profile_id, provider ('google'), access_token_encrypted, refresh_token_encrypted, token_expires_at, scope, created_at, updated_at`.
- RLS : membres du compte uniquement.
- Étendre l'enum `source` de `contacts` (si typé) pour accepter `google_import` et `vcard_import`. Sinon garder en text libre.

### Détails techniques

- **Chiffrement tokens** : réutiliser `bridge-server/src/auth/crypto.js` logic mais côté edge function (AES-256-GCM avec `ENCRYPTION_KEY`). Si pas dispo en edge → nouveau secret.
- **OAuth callback** : edge function `google-contacts-callback` qui échange le code, chiffre, stocke, redirige vers `/who?import=success`.
- **vCard parsing** : librairie légère `vcard4` ou parsing manuel (vCard est simple : split lignes, regex sur `TEL:`, `FN:`, etc.). Préférer parsing manuel pour éviter dépendance.

### Hors scope
- Sync continue (one-shot import seulement).
- Assignation auto à un groupe (les contacts importés vont dans "Non classés", l'utilisateur peut les déplacer après).
- Photos de contacts.

### Risques / questions ouvertes
- Le flux OAuth Google nécessite que les domaines de callback soient autorisés dans la Google Cloud Console du projet.
- Pour iCloud spécifiquement : pas d'autre option que vCard. Documenter dans la UI : "Pour iCloud : Réglages → exporter vCard, puis importer ici".

