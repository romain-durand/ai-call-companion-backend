

## Refonte navigation : barre d'onglets en bas (3 onglets)

### Structure finale

3 onglets en bas sur mobile, sidebar conservée sur desktop.

| Onglet | Icône | Route | Contenu |
|---|---|---|---|
| **Accueil** | `LayoutDashboard` | `/` | Tableau de bord actuel |
| **Activité** | `History` | `/activity` | Sous-onglets : Historique + Missions |
| **Réglages** | `SlidersHorizontal` | `/more` | Hub liste : À propos de moi, Qui peut me joindre, Comment gérer, Quand me prévenir, Calendrier, Réglages, Profil/Compte (email + lien d'appel + déconnexion) |

La page `/test` (Tester l'assistant) est retirée de la navigation (route conservée mais sans entrée visible).

### Ergonomie

- **Mobile (< 768px)** : barre fixe en bas (~64px + safe-area iOS), icône + label, état actif coloré en `primary` avec petit indicateur. Sidebar masquée, header simplifié sans `SidebarTrigger`.
- **Desktop (≥ 768px)** : sidebar latérale actuelle conservée intacte, mais réorganisée en 3 sections miroir (Accueil / Activité / Réglages) pour cohérence avec le mobile.
- **Sous-navigation Activité** : `<Tabs>` shadcn en haut de page (Historique | Missions).
- **Hub Réglages** : liste verticale style iOS Settings, chaque item = ligne cliquable avec icône à gauche, label, chevron à droite. Section "Compte" en bas avec email, bouton déconnexion, et lien d'appel (QR code).
- **Safe-area iOS** : `pb-[env(safe-area-inset-bottom)]` sur la barre, `pb-20` sur `<main>` mobile pour éviter le recouvrement.

### Détails techniques

1. **Nouveau** `src/components/BottomTabBar.tsx` : 3 `NavLink`, fixe `bottom-0`, visible uniquement mobile via `md:hidden`.
2. **Modifier** `src/components/DashboardLayout.tsx` :
   - Utiliser `useIsMobile()` (déjà existant).
   - Mobile → masquer sidebar/trigger, afficher `<BottomTabBar>`, `<main>` avec `pb-20`.
   - Desktop → comportement actuel.
3. **Nouvelle page** `src/pages/ActivityPage.tsx` (route `/activity`) :
   - `<Tabs>` shadcn avec deux `TabsContent` qui rendent `<CallHistory />` et `<MissionsPage />` (réutilisation des composants existants tels quels, sans duplication).
4. **Nouvelle page** `src/pages/MoreMenuPage.tsx` (route `/more`) :
   - Liste de liens vers `/about-me`, `/who`, `/how`, `/when`, `/calendar`, `/settings`.
   - Section "Compte" intégrée en bas : email utilisateur, lien d'appel + QR (extrait de `SettingsPage`), bouton "Se déconnecter".
5. **Modifier** `src/App.tsx` : ajouter routes `/activity` et `/more`. Conserver toutes les routes existantes pour compatibilité (les pages restent accessibles depuis le hub Réglages).
6. **Modifier** `src/components/AppSidebar.tsx` (desktop) : regrouper les entrées en 3 sections (Accueil, Activité, Réglages) cohérentes avec la barre du bas. Retirer "Tester" de la sidebar.

### Aperçu mobile

```text
┌─────────────────────────┐
│ Bonjour Victor          │
│ [contenu page]          │
│                         │
│                         │
├─────────────────────────┤
│   🏠      📊      ⚙️    │
│ Accueil Activité Réglag │
└─────────────────────────┘
```

### Fichiers touchés

- Créés : `src/components/BottomTabBar.tsx`, `src/pages/ActivityPage.tsx`, `src/pages/MoreMenuPage.tsx`
- Modifiés : `src/components/DashboardLayout.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`

