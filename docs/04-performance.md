# Performance report

Measured with Lighthouse 12 against `next start` (production build),
Chromium headless. Mobile uses Lighthouse's default 4× CPU throttling and
slow-4G — i.e. roughly the mid-range Android on 4G this product targets (§34).

## Results

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| **Desktop** | **100** | **100** | **100** | **100** |
| **Mobile** | **95** | **100** | **100** | **100** |
| Target (§33) | 90+ | 95+ | 95+ | 95+ |

| Metric | Desktop | Mobile |
|---|---|---|
| LCP | 0.6 s | 2.8 s |
| Total blocking time | 0 ms | 20 ms |
| Cumulative layout shift | **0** | **0** |

## The two fixes that mattered

Both were found by measuring, not by guessing.

### 1. Animation runtime in the shared bundle — mobile 83 → 95

`BottomNav` used motion's `layoutId` for the active-tab indicator. `layoutId`
pulls in the full layout-animation engine, and because the nav is in the root
layout, **every route** paid for it: ~137 KiB of unused JavaScript and ~740 ms
of main-thread work on a throttled device — to animate a 32 px underline.

The tabs are equal width, so a single element with a CSS `transform`
transition is visually identical. `SaveButton` similarly used
`AnimatePresence` for a 180 ms scale; that became a CSS keyframe.

Motion is now loaded **only** where the interaction genuinely needs gesture
physics: the draggable bottom sheet (`/map`) and drag-reorder (`/plan`).

Result: LCP 4.7 s → 2.8 s on mobile.

### 2. Render-blocking Devanagari font

Both font families were preloaded and render-blocking. Marathi is secondary
text on every screen, so Mukta now loads with `preload: false`, only the two
weights actually used, and a `Noto Sans Devanagari` fallback. Manrope (the
primary face) still preloads.

## Accessibility: 96 → 100

Lighthouse found eight contrast failures on card metadata: the `--faint`
token resolved to **3.31:1** on card surfaces, below the 4.5:1 required at
12 px.

This was a *token* defect, not a usage defect — so it was fixed once, at the
token. The alpha was computed against all three surface tokens rather than
eyeballed:

| Alpha | on `--raat` | on `--dhoop` | on `--dhoop-2` |
|---|---|---|---|
| 0.40 (was) | 3.33 ❌ | 3.31 ❌ | 3.25 ❌ |
| 0.52 | 4.78 ✅ | 4.70 ✅ | 4.54 ✅ |
| **0.56 (now)** | **5.39 ✅** | **5.23 ✅** | **5.03 ✅** |

0.56 was chosen over the 0.52 minimum for headroom, while staying visibly
below `--muted` (0.62) so the type hierarchy survives.

## Deliberate performance decisions

| Decision | Why |
|---|---|
| Catalogue rendered in Server Components | Mandal content is in the initial HTML; the page is useful before hydration |
| Maps JS behind `next/dynamic` | Routes without a map ship no Maps JS at all |
| Nearby sorting is local haversine | Zero API calls, zero cost, works offline |
| Routes matrix requested once per optimisation | The TSP solver runs locally over the result, not one call per candidate ordering |
| Routes field masks | Only the 3 fields rendered are requested — the main cost and latency lever |
| Search is in-memory with `useDeferredValue` | No request per keystroke, no debounce timer, no Places call for what local data can answer |
| Markers managed imperatively | Selecting a marker does not re-render the list |
| SVG data-URI markers | No network request per marker on a congested connection |
| 45 pages statically generated | Mandal, area and category pages are CDN-served |

## Verified layout integrity

`npm run visual` sweeps 320 / 375 / 390 / 430 / 768 / 1280 / 1440 px across 14
page/width combinations, asserting `scrollWidth <= clientWidth` and zero
console errors. **All pass** — no horizontal overflow anywhere (§63).

CLS is **0** on both profiles.
