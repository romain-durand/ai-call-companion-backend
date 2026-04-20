# Project Structure

## Directory Layout

```
ai-call-companion/
├── src/
│   ├── pages/              # Page components (route-level)
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Assistant.tsx   # AI assistant page
│   │   ├── ContactsPage.tsx
│   │   ├── CallHistory.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── AboutMePage.tsx
│   │   ├── Login.tsx       # Authentication
│   │   └── ... (other pages)
│   │
│   ├── components/         # Reusable React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── contacts/      # Contact-related components
│   │   ├── DashboardLayout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── ... (feature components)
│   │
│   ├── hooks/             # Custom React hooks
│   │   └── ... (useAuth, useQuery wrappers, etc)
│   │
│   ├── contexts/          # React Context providers
│   │   └── AuthContext.ts
│   │
│   ├── lib/               # Utility functions
│   │   └── ... (helpers, formatters, etc)
│   │
│   ├── data/              # Data providers & constants
│   │   └── providers/     # Data provider implementations
│   │
│   ├── integrations/      # External service integrations
│   │   ├── supabase/      # Supabase client setup
│   │   └── lovable/       # Lovable auth integration
│   │
│   ├── test/              # Test utilities & helpers
│   │
│   ├── App.tsx            # Root app component with routing
│   ├── main.tsx           # Vite entry point
│   └── index.css          # Global styles
│
├── public/                # Static assets
├── dist/                  # Build output (generated)
├── .vscode/               # VS Code settings
├── .github/               # GitHub workflows
├── vite.config.ts         # Vite build configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── eslint.config.js       # ESLint configuration
├── postcss.config.js      # PostCSS configuration
├── package.json           # Project dependencies
├── README.md              # Project documentation
└── .gitignore             # Git ignore rules

## Key Files

### Configuration Files
- `vite.config.ts` - Dev server (port 8080), build config, path aliases
- `tsconfig.json` - TypeScript compiler options (loose typing)
- `tsconfig.app.json` - App-specific TS config
- `tsconfig.node.json` - Node/build tools TS config
- `tailwind.config.ts` - Tailwind utilities, colors, animations
- `eslint.config.js` - Linting rules
- `postcss.config.js` - CSS processing

### Entry Points
- `src/main.tsx` - Vite entry point
- `src/App.tsx` - React app root with routing
- `src/index.css` - Global styles

### Data Flow
Pages → Components → Hooks (useAuth, useQuery) → Contexts (AuthContext) → Services (Supabase, Integrations)