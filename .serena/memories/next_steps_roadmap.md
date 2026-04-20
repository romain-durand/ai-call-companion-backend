# Roadmap & Plan d'Action — Post-Audit

## 🎯 Priorités Court Terme (Sprint actuel)

### 1. Nettoyage routes (Low effort, High clarity)
- [ ] Supprimer `Assistant.tsx` (/assistant) — remplacé par OwnerCallDialog
- [ ] Consolider `/history` route vers `/activity?tab=history` OU laisser comme deep-link privé (clarifier intention)
- [ ] Vérifier tous les `navigate('/history')` pointent vers la nouvelle location
- **Effort**: 1-2h | **Impact**: Clarté architecture

### 2. Ajouter `set_about_me` à la doc/mémoire
- [ ] Documenter que `set_about_me` vit dans `ownerGeminiConfig.js`, pas `geminiConfig.js`
- [ ] Clarifier les 3 configs Gemini distinctes (inbound/outbound/owner) dans code comments
- [ ] S'assurer que ownerToolRouter.js est clairement documenté
- **Effort**: 30min | **Impact**: Onboarding contributors

### 3. Tests — Phase 1 (Providers)
- [ ] Écrire tests unitaires pour `data/providers/contacts/live.ts`
  - Mock supabase client
  - Vérifier multi-tenant RLS implicite via useUserAccountId
  - Tester dedup, filtering
- [ ] Appliquer pattern à autres providers (callHistory, callerGroups, notifications)
- **Effort**: 4-6h | **Impact**: Confiance requêtes critiques

---

## 🎯 Moyen Terme (Prochains sprints)

### 4. Tests — Phase 2 (Bridge Backend)
- [ ] runtimeContextBuilder.js — vérifier injection contexte
- [ ] toolRouter.js — guard-fous fail-closed pour booking/callback
- [ ] transcriptBuffer.js — dedup consécutifs
- **Effort**: 6-8h | **Impact**: Stabilité logic métier

### 5. E2E — 3 Flux critiques (Playwright)
- [ ] Login OAuth (Google) → Dashboard
- [ ] Configurer mode/groupe → matrice mise à jour
- [ ] Web call `/call/:profileId` → Audio établi (mock Gemini)
- **Effort**: 8-10h | **Impact**: Régression détection

### 6. Bannières temps réel — Mock Realtime
- [ ] LiveConsultBanner avec Realtime mockée
- [ ] TransferCallBanner avec Realtime mockée
- [ ] Vérifier polling 3s + Realtime sync correctement
- **Effort**: 4-5h | **Impact**: Détection regressions UI temps réel

---

## 🎯 Long Terme (Q2-Q3)

### 7. APNs/CallKit pour iOS (Blocage notif système)
- [ ] Créer table `device_tokens` (migration)
- [ ] Implémenter `bridge/pushNotificationService.js`
- [ ] Intégrer `@capacitor/push-notifications`
- [ ] Listener `pushNotificationActionPerformed` → nav / (bannière prend le relais)
- [ ] Optionnel: CallKit + PushKit pour transfer_call (UI native d'appel)
- **Effort**: 20-30h | **Impact**: UX critique (notifications système)
- **Dépendance**: Certificat VoIP Apple (optionnel, si CallKit)

### 8. Durcissement TypeScript
- [ ] Activer `strictNullChecks` progressivement (fichier par fichier)
- [ ] Puis `noImplicitAny`
- [ ] Utiliser // @ts-check ciblés pour overrides
- **Effort**: 10-15h | **Impact**: Stabilité long terme

### 9. SMS — Élargir canaux (push, email, voice)
- [ ] Push notifications (APNs + FCM)
- [ ] Email notifications (SendGrid ou équivalent)
- [ ] Voice notifications (Twilio SMS→voice callback ?)
- **Effort**: 15-20h par canal | **Impact**: Compliance notification prefs

### 10. Calendrier — Sync multi-calendriers
- [ ] Aujourd'hui: selection UI existe
- [ ] À implémenter: check_availability sur tous les calendriers sélectionnés
- [ ] book_appointment sur calendrier cible
- **Effort**: 4-6h | **Impact**: UX booking

---

## 📋 Checklist Maintenance Continue

- [ ] Vérifier couverture Realtime après chaque nouveau tool Gemini
- [ ] Tester dedup transcriptBuffer après changements Twilio codec
- [ ] Monitoring n8n webhook failures (SMS retry logic)
- [ ] Vérifier RLS multi-tenant avant chaque migration (check_* triggers)
- [ ] Load test outbound missions poller (actuellement polling DB ~10s/mission)

---

## 🔧 Dépendances Internes

```
Phase 1 (Nettoyage) → Phase 2 (Tests)
Phase 2 (Tests) → Phase 3 (E2E)
Phase 3 (E2E) + Phase 4 (Backend tests) → Stabilité pour deployment
Phase 4 + Phase 5 → APNs/CallKit (bloquant pour iOS launch)
```

---

## 📊 Estimé Total

| Phase | Effort | Dépendance |
|-------|--------|-----------|
| 1-3 (Tests unitaires) | 5-8h | None |
| 4-6 (E2E + Backend) | 18-23h | Phase 1-3 |
| 7 (APNs/CallKit) | 20-30h | Phase 4-6 |
| 8 (TypeScript) | 10-15h | Anytime |
| 9 (Canaux notif) | 15-20h/canal | Phase 7 |
| 10 (Multi-calendrier) | 4-6h | Anytime |

**Total MVP stabilité**: ~40-50h (Phase 1-6)
**Total production-ready**: ~80-120h (all phases)