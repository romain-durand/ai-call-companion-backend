# Phase 1 Cleanup — Completed ✅

**Date**: 2026-04-20
**Commit**: 80ace3c

## Travail effectué

### 1. Suppression Assistant.tsx
- ✅ Supprimé fichier `/src/pages/Assistant.tsx` (page debug Gemini, inutilisée)
- ✅ Supprimé import dans `App.tsx`
- ✅ Supprimé route `/assistant` de la navigation
- **Raison**: Remplacé par `OwnerCallDialog` qui utilise le WS `/web-call` du bridge

### 2. Consolidation /history → /activity
- ✅ Supprimé route `/history` (standalone)
- ✅ Mis à jour `ActivityTimeline.tsx`:
  - `navigate("/history")` → `navigate("/activity")`
  - `navigate("/history#call-X")` → `navigate("/activity#call-X")`
- ✅ Nettoyé `BottomTabBar.tsx`: supprimé `/history` du pattern match
- ✅ Nettoyé `AppSidebar.tsx`: supprimé entrée menu "Historique" dupliquée
- **Raison**: `/activity` centralise Historique + Missions avec onglets; plus de deep-link dupliqué

## Résultats

| Métrique | Avant | Après | Δ |
|----------|-------|-------|---|
| Pages | 23 | 22 | -1 |
| Routes protégées | 17 | 15 | -2 |
| Fichiers modifiés | - | 5 | - |
| Build | ✓ | ✓ | Pas de régression |
| Linting | Baseline | Baseline | Pas de new errors |

## Clarifications dans le code

**Routes maintenant clairement organisées**:
- `/` = Dashboard
- `/activity` = Hub Activité (onglets: Historique + Missions)
- `/missions` = Missions page (si vue séparée nécessaire)
- `/more` = Hub Réglages (sous-pages: /who, /how, /when, /about-me, /calendar, /settings)
- `/call/:profileId` = Web call public (pas besoin d'auth)

**Pages supprimées** (candidats pour suppression future):
- `/test` = TestAssistant.tsx (simulateur scénarios mock — à conserver pour démo/QA)

## Prochaines phases

1. **Phase 2**: Tests unitaires providers (5-8h)
2. **Phase 3**: E2E Playwright (8-10h)
3. **Phase 4**: APNs/CallKit iOS (20-30h)

**Effort total Phase 1**: 1h
**QA**: Build ✓, Lint ✓, Git ✓