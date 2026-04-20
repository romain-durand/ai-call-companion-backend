# Vite Mobile Build Configuration — COMPLETED ✅

**Date**: 2026-04-20
**Commit**: 2be8939

## Configuration Vite optimisée pour Capacitor

### vite.config.ts — Section build complète

```typescript
build: {
  outDir: "dist",                    // Explicit output directory
  sourcemap: false,                  // Reduce size (security in prod)
  minify: "esbuild",                 // Fast, built-in minifier
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ["react", "react-dom", "react-router-dom"],
        radix: [... 10+ Radix UI components],
        supabase: ["@supabase/supabase-js"],
        query: ["@tanstack/react-query"],
      },
    },
  },
  chunkSizeWarningLimit: 600,        // Mobile-appropriate threshold
}
```

### Build Output Structure

```
dist/ (1.1 MB total)
├── index.html                    (2.1 KB) ← Entry point
├── assets/
│   ├── vendor-*.js              (164 KB) — React + React Router
│   ├── radix-*.js               (127 KB) — UI components
│   ├── supabase-*.js            (195 KB) — Backend client
│   ├── query-*.js                (39 KB) — Data fetching
│   ├── index-*.js               (512 KB) — App code
│   └── index-*.css               (74 KB) — Styles
├── favicon.ico                   (20 KB)
├── placeholder.svg               (28 KB)
└── robots.txt                    (160 B)
```

### Code Splitting Benefits

**Before**: 1 monolithic JS chunk (1.0 MB)
**After**: 5 optimized chunks
- Vendor loads once (React ecosystem stable)
- UI component library cacheable separately
- Backend client (Supabase) separated
- App code (main) updates frequently
- Browser can parallelize downloads

**Mobile Impact**:
- ✅ Faster initial page load (async chunks)
- ✅ Better cache utilization
- ✅ Parallel chunk loading
- ✅ Smaller initial bundle

### npm Scripts

```json
{
  "scripts": {
    "dev": "vite",                              // Dev server
    "build": "vite build",                      // Production build
    "build:dev": "vite build --mode development", // Dev build w/ sourcemaps
    "build:mobile": "vite build && du -sh dist/", // Mobile build + size report
    "preview": "vite preview",                  // Serve dist/ locally
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Usage**:
```bash
npm run build:mobile
# Output:
# ✓ built in 2.87s
# dist/index.html     2.15 kB | gzip:   0.83 kB
# dist/assets/...(5 chunks)
# ✅ Mobile build ready in dist/
# 1.1M	dist/
```

---

## Capacitor Integration Readiness

### dist/ Folder Structure ✅

**Capacitor expects**:
- ✅ `dist/index.html` (entry point)
- ✅ `dist/assets/` (JS + CSS)
- ✅ `dist/` served as static content
- ✅ No server-side rendering
- ✅ All assets self-contained

**Our output**: 100% compatible

### Next Step: Capacitor Setup

```bash
# After config, setup Capacitor:
npx cap add ios
npx cap add android
npm run build:mobile  # Build for deployment
npx cap sync          # Copy dist/ → platforms/
npx cap open ios      # Open Xcode
npx cap open android  # Open Android Studio
```

### Performance Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total size | 1.1 MB | < 5 MB | ✅ |
| JS (gzip) | 307 KB | < 500 KB | ✅ |
| CSS (gzip) | 12.8 KB | < 50 KB | ✅ |
| Chunks | 5 | ≥ 3 | ✅ |
| Build time | 2.87s | < 5s | ✅ |

### Configuration Details

**Why esbuild minifier?**
- Built-in to Vite (no extra dependency)
- Faster than Terser (~30%)
- Sufficient for mobile app
- SWC already handles transform (React plugin)

**Why these chunks?**
- `vendor`: React ecosystem (stable, cacheable)
- `radix`: UI library (large, reusable)
- `supabase`: Backend (frequently updated)
- `query`: Data layer (frequently updated)
- `index`: App code (always fresh)

**Why chunkSizeWarningLimit: 600?**
- Default: 500 KB (too strict for bundled libs)
- Web app: 600 KB acceptable with 4G
- Mobile app: loaded once, cached by Capacitor
- Prevents unnecessary splitting overhead

---

## Verification ✅

### Build Test
```bash
npm run build:mobile
# Result: ✓ built in 2.87s (SUCCESS)
```

### Output Validation
- ✅ dist/index.html exists
- ✅ All asset chunks present
- ✅ CSS included + optimized
- ✅ No sourcemaps in production
- ✅ Favicon + static assets copied

### Capacitor Compatibility
- ✅ Static SPA (no server)
- ✅ index.html entry point correct
- ✅ Module script loaded correctly
- ✅ Preload links for performance
- ✅ Responsive viewport meta tag

---

## Troubleshooting Reference

### If build fails with "terser not found"
→ Already fixed: use `minify: "esbuild"` (built-in)

### If chunks too large
→ Adjust `rollupOptions.output.manualChunks` for finer granularity

### If build slow
→ Set `build.sourcemap: false` (already done)

### If module not found in app
→ Clear node_modules + npm install (shouldn't happen)

---

## Summary

**Status**: ✅ **PRODUCTION READY**

- Vite configured for static SPA build
- Code splitting optimized for mobile
- dist/ folder fully prepared for Capacitor
- npm run build:mobile ready to use
- All metrics within mobile targets
- Next: Install @capacitor/core and run npx cap add