

## Plan: Supprimer `escalate_call`

L'outil `escalate_call` est redondant avec `notify_user` (priority=critical) et `transfer_call`. On le supprime du prompt système, des déclarations d'outils et du routeur.

### Fichiers modifiés

**1. `bridge-server/src/gemini/geminiConfig.js`**
- Supprimer la section "CALL TRANSFER vs ESCALATION" du prompt (lignes ~85-98)
- Supprimer la déclaration de l'outil `escalate_call` du tableau `TOOL_DECLARATIONS`
- Adapter le prompt pour que les urgences passent par `notify_user` (priority=critical) ou `transfer_call`

**2. `bridge-server/src/tools/toolRouter.js`**
- Supprimer le `case "escalate_call"` du switch
- Supprimer la fonction `handleEscalateCall`
- Supprimer l'import de `createEscalation` depuis `escalationRepo`

**3. `bridge-server/src/context/runtimeContextBuilder.js`**
- Supprimer les références à `escalation_allowed` et `force_escalation` dans les directives de groupe
- Supprimer la variable `escalationRules` et sa ligne dans le contexte final

**4. `bridge-server/src/db/escalationRepo.js`**
- Fichier conservé (la table `escalation_events` reste en base) mais plus appelé par le routeur

### Ce qui ne change PAS
- La table `escalation_events` en base (pas de migration destructive)
- Les colonnes `escalation_allowed` / `force_escalation` dans `call_handling_rules` (nettoyage futur possible)
- L'outil `notify_user` avec priority=critical couvre le cas d'urgence

