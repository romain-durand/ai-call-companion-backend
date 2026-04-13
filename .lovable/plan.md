

# Plan : Pré-connexion Gemini pendant la sonnerie

## Probleme actuel

Gemini se connecte seulement quand l'interlocuteur décroche (event `start` dans `outboundStreamHandler`). La séquence est :

```text
Twilio REST call → sonnerie → décrochage → WS Twilio "start"
  → connectOutboundGemini() → WS open → setup → setupComplete
  → attente parole → réponse
```

Le setup Gemini (connexion WS + envoi config + setupComplete) prend 1-3s, qui s'ajoutent après le décrochage.

## Solution

Lancer la connexion Gemini dès que l'appel Twilio est initié (pendant que ça sonne), puis la réutiliser quand le stream Twilio se connecte.

```text
Twilio REST call → sonnerie ──────────────────→ décrochage → WS "start"
                 ↘ connectOutboundGemini()                    → réutilise geminiWs (déjà prêt)
                    → WS open → setup → setupComplete (pendant la sonnerie)
```

## Modifications

### 1. `outboundCallExecutor.js`
- Après l'appel Twilio REST réussi, appeler `connectOutboundGemini` immédiatement avec un callCtx temporaire contenant les params de la mission
- Stocker le Gemini WS pré-connecté dans `callStateStore` avec la clé `mission:<missionId>`
- Le callCtx temporaire n'a pas de `onAudio` ni de `streamSid` — l'audio sera routé plus tard

### 2. `outboundGeminiConnection.js`
- Modifier `connectOutboundGemini` pour accepter un callback `onAudio` optionnel (peut être `null` au départ)
- Ajouter une méthode `setAudioCallback(fn)` sur le WS retourné pour brancher l'audio après coup
- Tant que `onAudio` est `null`, les paquets audio sont ignorés (pas de crash)

### 3. `outboundStreamHandler.js`
- Dans l'event `start`, au lieu de `connectOutboundGemini()`, chercher d'abord un WS pré-connecté via `callStore.get("mission:<missionId>")`
- Si trouvé et `geminiReady === true` : réutiliser le WS, brancher le callback audio, fusionner les params dans le callCtx existant → gain de 1-3s
- Si pas trouvé ou pas prêt : fallback à la connexion normale (aucune régression)
- Nettoyer l'entrée `mission:` du store

### 4. `callStateStore.js`
- Aucune modification nécessaire, le store accepte déjà des clés arbitraires

## Résultat attendu

- Gemini est déjà en état `setupComplete` quand l'interlocuteur décroche
- La réponse de l'assistant arrive dès la détection de parole, sans attente de connexion
- Fallback transparent si la pré-connexion échoue

---

# Governance Rules — Monorepo Consistency

> This project is not a simple CRUD app. The UI, database, runtime context, and AI behavior must remain strictly aligned.

---

## 1. Runtime Context Consistency (CRITICAL)

Any data exposed in the UI that affects call handling behavior **MUST** be reflected in the runtime context builder.

This includes:
- Caller groups
- Call handling rules
- Notification preferences
- Assistant control mode

> If a field is editable in the UI but not included in the runtime context, the AI behavior will become inconsistent.

---

## 2. Call Handling Rules Are Core Logic

The table `call_handling_rules` is the central decision system of the product.

- Lovable may modify queries or UI representation
- **BUT** any change to the meaning, structure, or interpretation of these rules must be validated on the backend side

Codex is responsible for ensuring:
- Consistency with runtime context
- Consistency with system prompt
- Consistency with tool behavior

---

## 3. Providers Are Product Layer (Not Just Data)

The folder `src/data/providers/` is not a simple data access layer. It represents the product model:
- Who can reach the user
- How calls are handled
- When the user is notified

Therefore:
- Naming must stay aligned with product concepts
- Structure must stay consistent with runtime context and backend expectations
- Exported function signatures must remain stable

---

## 4. Tool ↔ UI Alignment

Every user-visible action must map to a backend tool:
- "call back" → `create_callback`
- "notify user" → `notify_user`
- "urgent escalation" → `escalate_call`

> No UI feature should exist without a corresponding backend action.

---

## 5. Assistant Control Mode (CRITICAL)

The assistant supports two modes:
- `strict_policy`
- `model_discretion`

This control mode must be:
- Stored in DB (`assistant_modes`)
- Exposed in UI
- Injected in runtime context
- Respected in backend guardrails

> Any inconsistency will lead to incorrect AI decisions.

---

## 6. Backend (bridge-server) Remains Source of Truth for Behavior

Lovable can iterate on UI and data fetching.

But final behavioral logic (what actually happens during a call) is always enforced in:
- `runtimeContextBuilder`
- `toolRouter`
- Backend guardrails

> **Codex owns this layer.**

---

## Folder Ownership Summary

| Dossier | Owner | Risque si l'autre modifie |
|---|---|---|
| `src/pages/` | Lovable-first | Moyen |
| `src/components/ui/` | Lovable-first | Élevé |
| `src/components/` (hors ui/) | Mixed | Moyen |
| `src/hooks/` | Mixed | Moyen |
| `src/data/providers/` | Mixed | Élevé |
| `src/contexts/` | Lovable-first | Élevé |
| `src/lib/` | Mixed | Faible |
| `src/integrations/` | Sanctuarisé | Critique |
| `supabase/migrations/` | Lovable-first | Critique |
| `supabase/functions/` | Mixed | Moyen |
| `supabase/config.toml` | Sanctuarisé | Critique |
| `bridge-server/` | Codex-first | Faible |
| `.env` | Sanctuarisé | Critique |

## 5 Operational Rules

1. **Bridge-server = territoire Codex.** Refacto, tests, stabilisation, perf — tout passe par Codex.
2. **Nouvelles features end-to-end = Lovable-first.** Page + provider + migration = un seul flux Lovable.
3. **Ne jamais modifier les fichiers auto-générés.** `src/integrations/supabase/`, `.env`, `supabase/config.toml`.
4. **Codex ne crée jamais de migration SQL.** Toujours passer par l'outil migration de Lovable.
5. **Avant un passage Codex, toujours pull le dernier état Lovable.**

## 3 Zones Sanctuarisées

1. `src/integrations/supabase/` — client et types auto-générés
2. `supabase/migrations/` — uniquement via l'outil migration Lovable
3. `.env` + `supabase/config.toml` — configuration auto-gérée

