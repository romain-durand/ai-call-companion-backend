# Code Style & Conventions

## Naming Conventions
- **Components**: PascalCase (e.g., `Dashboard`, `ContactsPage`, `DashboardLayout`)
- **Functions/Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: camelCase
- **Page components**: `{Name}Page.tsx` or `{Name}.tsx`

## TypeScript Configuration
- **Loose typing philosophy**: `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`
- **Null checking disabled**: `strictNullChecks: false`
- **Path aliases**: `@/*` points to `src/*` directory
- **Skip lib check**: Enabled for faster compilation

## Import/Export Style
- Use `@/` alias for absolute imports from src directory
- Default exports for page components
- Named exports for utility functions and custom hooks

## Component Patterns
- Function components only (no class components)
- React Hooks extensively (useAuth, useQuery, custom hooks)
- Framer Motion for animations
- TailwindCSS for styling
- Radix UI primitives wrapped with shadcn/ui styling
- No inline styles - use TailwindCSS classes

## Styling
- **Framework**: TailwindCSS utility-first
- **Dark mode**: class-based darkMode support
- **Custom animations**: defined in tailwind config (fade-in, slide-in, pulse-ring, wave)
- **Spacing**: Use TailwindCSS spacing scale
- **Responsive**: Mobile-first approach with Tailwind breakpoints

## Linting Rules
- React refresh exports warning (allowConstantExport: true)
- React hooks rules enforced
- TypeScript recommended rules
- Unused variables not flagged (disabled rule)

## Project Structure
- **@/components/** - Reusable React components
- **@/pages/** - Page components (routes)
- **@/hooks/** - Custom React hooks
- **@/contexts/** - React Context providers
- **@/lib/** - Utility functions and helpers
- **@/data/** - Data providers and constants
- **@/integrations/** - External service integrations
- **@/test/** - Test utilities

## No Comments Unless Necessary
- Code should be self-documenting with clear naming
- Add comments only for non-obvious WHY, hidden constraints, or workarounds
- Avoid WHAT comments (naming explains this) or THIS flow comments (belongs in PR description)