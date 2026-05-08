# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`thumbwheel` is a single-component React library (pre-1.0, published to npm) — a thumb-anchored radial wheel UI for one-handed mobile navigation. The repo is the library + a Vite-served demo. There is no app, no backend, no database. Most "feature work" here means editing one file: `src/Thumbwheel.tsx`.

## Commands

```bash
npm install
npm run dev        # Vite demo on 0.0.0.0:5173 (LAN-accessible for phone testing)
npm run build      # tsup -> dist/ (ESM + CJS + .d.ts + .d.cts), runs `clean` first
npm run typecheck  # tsc --noEmit
npm run lint       # ⚠ declared in package.json but eslint is NOT installed — script will fail
```

CI (`.github/workflows/ci.yml`) runs only `typecheck` + `build` on Node 24. There is no test suite. There is no linter. Verification = typecheck passes + build passes + manually exercise the demo on a real iPhone (the iOS Safari quirks below cannot be caught by either typecheck or build).

`prepublishOnly` runs typecheck then build — that's the gate before `npm publish`.

## Architecture

Three files in `src/`:

- `src/index.ts` — barrel re-exporting `Thumbwheel` and the public type names.
- `src/types.ts` — the entire public API surface (`ThumbwheelProps`, `ThumbwheelItem`, `ThumbwheelTheme`, `ThumbwheelGeometry`, `ThumbwheelPhysics`, `ThumbwheelDock`). When changing prop shapes, this is the only place consumers see.
- `src/Thumbwheel.tsx` — everything else: SVG path math, gesture state machines, momentum physics, iOS Safari workarounds, rendering. Top of file (`use client` directive) → constants/defaults → SVG path helpers (`polar`, `annularSectorPath`, `wedgeClipPath`) → component.

The `demo/` directory is served by Vite via the alias `thumbwheel: src/index.ts` (see `vite.config.ts`), so the demo is also an *integration test of the public API* — if a refactor breaks the consumer-facing import, the demo breaks first.

The library is built with **tsup** (not Vite). `vite` is only the dev server for the demo. `tsup.config.ts` does two non-default things worth knowing:

1. Externalizes `react` and `react-dom` (peerDependencies, so consumers' React is used).
2. Re-injects a top-level `'use client';` directive into both ESM and CJS output via `banner`. tsup strips top-level directives by default, but Next.js App Router server-component trees need the directive on the bundled output for `import { Thumbwheel } from 'thumbwheel'` to work without a client wrapper.

## Coordinate system & rendering model

The wheel is **corner-anchored**, not centered. The pivot sits at `(anchorInset, viewport.h - anchorInset)` for left dock, `(viewport.w - anchorInset, viewport.h - anchorInset)` for right dock. A `direction: 1 | -1` flag flips all the angle math between the two docks; nearly every render-time calculation in the file consumes it.

- Angles are in **radians** internally. `wheelRotationDeg = (direction * spinOffset * 180) / Math.PI` converts at the SVG boundary only.
- Sectors are drawn as **annular sectors** (donut wedges) via hand-rolled SVG path strings in `annularSectorPath`. The visible arc is clipped to a wedge via `<clipPath>` (`wedgeClipPath`) — so even though the sector ring is a full circle in the DOM, only `visibleArc` radians (default 100°) of it actually renders. Spinning rotates the inner `<g>`, not the clip path.
- Icons are placed at the sector midpoint and **counter-rotated** so they stay upright as the wheel spins (`iconCounterRotationDeg = -wheelRotationDeg`).

If you're tempted to refactor the SVG into divs / `transform: rotate` — don't. The annular-sector + clip-path approach is what makes per-sector hit testing, per-sector colors, and the partial-arc visible region all work together cleanly.

## Load-bearing iOS Safari quirks (do not "clean up")

These look like bugs but are deliberate workarounds. The `Known constraints` section of `README.md` is the public-facing version of this list; this section is the *do-not-refactor-this* version.

1. **No `setPointerCapture`**. The trigger button uses **window-level** `pointermove` / `pointerup` / `pointercancel` listeners, attached inside the `pointerdown` handler. iOS Safari silently drops touches on `<button>` elements when `setPointerCapture` is used. The window-listener pattern is the only thing that works.

2. **AudioContext is created synchronously inside `pointerdown`** (`ensureAudioContext()` called from both `handleTriggerPointerDown` and `handleSpinPointerDown`). iOS Safari's user-gesture rule requires AudioContext creation/resume to happen *during* a confirmed user gesture — a `useEffect` runs after commit, which is too late. The context stays in `'suspended'` state forever and no audio plays. Do not move this into a `useEffect`. Do not lazy-create on first tick.

3. **`100lvh` probed via a hidden `<div>`, not read from CSS**. The wheel needs to extend behind iOS Safari's bottom address bar. `window.innerHeight` returns the *small* viewport (excludes the bar's territory). The `useEffect` that sets `viewport.h` creates a `position: fixed; height: 100lvh` probe element, reads `offsetHeight`, and removes the probe. Re-runs on `visualViewport` resize. The wheel's wrapper uses `height: 100lvh` directly; the SVG `viewBox` uses the probed value so coordinates match.

4. **`'use client'` directive must survive the build.** Preserved by the `banner` config in `tsup.config.ts`. Removing this breaks Next.js App Router consumers.

5. **localStorage reads guarded by `typeof window === 'undefined'`** for SSR. Two such guards (dock preference, radius preference). Don't remove.

6. **Body scroll lock when open.** Sets `position: fixed`, `top: -scrollY`, `overscroll-behavior-y: none` on body/html, restores on close. This disables iOS pull-to-refresh while the wheel is open and prevents the page scrolling under the backdrop. The cleanup path restores the scroll position via `window.scrollTo(0, scrollY)`.

7. **Tick sound respects iOS hardware silent switch.** Web Audio is muted by the orange-dot side switch; this is a hardware gate, not a code bug. Test with the switch in ring mode.

## Gesture state machines

Two parallel pointer pipelines, each with its own ref-tracked state:

- **`spinDragRef`** — set in `handleSpinPointerDown` on the wheel/backdrop. Tracks `startAngle`, `startOffset`, `moved` (true once movement crosses `SPIN_THRESHOLD_RAD`). On pointerup, if `moved` and velocity > `flickThreshold`, kicks off `startMomentum()` (rAF loop with friction-decayed velocity). The `moved` flag is *also* read by `handleBackdropClick` and the per-sector `onClick` to suppress click-through when the gesture was a drag (with a `setTimeout(0)` cleanup so React's click event fires *before* the ref is nulled).

- **`triggerDragRef`** — set in `handleTriggerPointerDown` on the floating button. Tracks `startClientX`, `startTriggerX`, `moved`. If `moved` (delta > `TRIGGER_DRAG_THRESHOLD_PX`) on pointerup, snaps to the nearest dock side and persists to localStorage. Otherwise treated as a tap and toggles `isOpen`.

The momentum loop reads/writes `velocityRef` and `momentumFrameRef`; it's cancelled on close (`isOpen` effect), unmount (same effect's cleanup), and on the next pointerdown (`stopMomentum()`).

## Conventions

- **Zero icon dependency.** The library imports no icon packages. Default trigger icons are inline `<svg>` literals at module top. All consumer icons come through `ThumbwheelItem.icon: ReactNode`. Don't add `lucide-react` or similar as a dep.
- **Colors are hex strings, never CSS variables.** Survives missing theme contexts and dark-mode quirks in host apps. `theme` props are typed as `string` and merged against the `DEFAULTS` constant near the top of `Thumbwheel.tsx`.
- **No CSS file, no Tailwind, no styled-components.** Inline `style` objects only. Don't introduce a styling system.
- **`tsconfig.json` is strict** with `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. Type-only imports must use `import type`. Indexed access into arrays returns `T | undefined` — pattern in the file is `samples[0]?.time ?? 0`.

## When the dev server seems broken on a phone

Vite is configured with `host: '0.0.0.0'` so a phone on the same Wi-Fi can hit `http://<lan-ip>:5173`. If a Next.js consumer reports a similar problem (HTML loads but JS chunks 404), see the `Known constraints` section of `README.md` — they need `allowedDevOrigins` in their `next.config.ts`, which is a host-app fix, not a library fix.
