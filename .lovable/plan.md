## Plan: SaaS Dashboard for Personal AI Phone Assistant

### Architecture
- Left sidebar layout using shadcn Sidebar component
- 7 main pages + existing assistant page preserved
- Realistic mock data throughout
- Premium, personal assistant aesthetic (not call center)

### Pages to Create
1. **Dashboard** (`/`) - Summary cards, recent activity, quick actions
2. **Profiles** (`/profiles`) - Work/Personal/Night/Focus modes with behavior config
3. **Caller Groups** (`/groups`) - Family/Clients/Unknown/Deliveries/VIP with default behaviors
4. **Call Handling** (`/handling`) - Visual flow of what happens per group
5. **Call History** (`/history`) - List with summaries, transcripts, actions
6. **Calendar** (`/calendar`) - Availability, booking rules
7. **Settings** (`/settings`) - General preferences
8. **Assistant** (`/assistant`) - Existing voice agent UI (moved from `/`)

### Components to Create
- `AppSidebar` - Navigation sidebar
- `DashboardLayout` - Layout wrapper with sidebar
- Mock data module
- Page-specific components

### Design Direction
- Dark theme (keep existing), refined typography
- Card-based layouts, subtle borders
- Personal/premium feel - think "concierge" not "call center"
