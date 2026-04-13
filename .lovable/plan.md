

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

