# Post-Task Workflow

## Standard Completion Checklist

### 1. Code Quality
- [ ] Run `npm run lint` to check for linting errors
- [ ] Fix any ESLint violations before committing

### 2. Testing
- [ ] Run `npm test` to ensure unit tests pass
- [ ] Consider running `npm run test:watch` during development for iteration
- [ ] Add or update tests if implementing new features

### 3. Manual Verification
- [ ] Start dev server with `npm run dev`
- [ ] Test the feature/fix in browser at `http://localhost:8080`
- [ ] Verify responsive design on mobile breakpoints
- [ ] Check dark mode functionality if applicable
- [ ] Test with screen reader/accessibility tools if UI changes

### 4. Build Verification
- [ ] Run `npm run build` to ensure production build succeeds
- [ ] Check `dist/` folder is generated correctly
- [ ] Run `npm run preview` to test production build locally

### 5. Git Commit
- [ ] Stage relevant files: `git add <files>`
- [ ] Create descriptive commit with: `git commit -m "message"`
- [ ] Follow conventional commit format when possible
- [ ] Reference issue numbers if applicable

### 6. Mobile/Capacitor (if applicable)
- [ ] For mobile changes, verify with `npm run build:mobile`
- [ ] Test on iOS/Android simulators if native features affected

## Priority Order
1. Fix linting issues first (prevents CI failures)
2. Run tests to ensure correctness
3. Manual browser testing for UI/UX verification
4. Build production bundle
5. Git commit with clear message

## Notes
- HMR during `npm run dev` provides instant feedback
- TypeScript compilation is strict for type safety despite loose rules
- Tailwind classes are purged at build time, so all classes must be in source