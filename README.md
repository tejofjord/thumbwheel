# thumbwheel

Thumb-anchored radial wheel UI for one-handed mobile navigation. SVG sectors with radial spokes and arcs, momentum-spin gesture, dock-snapping trigger button.

> Status: pre-1.0. API surface may shift. Battle-tested on iOS Safari.
>
> Live demo: **https://thumbwheel.vercel.app** — open on a phone for the intended one-handed feel.

## Install

```bash
npm install thumbwheel
```

Peer deps: `react >=18`, `react-dom >=18`. The library imports zero icon packages — bring your own (lucide-react, heroicons, inline SVG, emoji, anything React can render).

## Usage

```tsx
import { Thumbwheel, type ThumbwheelItem } from 'thumbwheel';
import { Home, Newspaper, User } from 'lucide-react';

const items: ThumbwheelItem[] = [
  { id: 'home', label: 'Home', icon: <Home /> },
  { id: 'news', label: 'News', icon: <Newspaper /> },
  { id: 'profile', label: 'Profile', icon: <User /> },
  // ...
];

export function App() {
  return (
    <Thumbwheel
      items={items}
      onSelect={(item) => router.push(`/${item.id}`)}
    />
  );
}
```

The component renders a fixed-position floating trigger button. Tap to open the wheel; tap a sector to select; tap the dim backdrop or the trigger again to close. Drag the trigger sideways to dock it on the other edge — choice persists in `localStorage`.

## Behavior

- **Tap the trigger** to toggle the wheel.
- **Drag the trigger** sideways to relocate it; it snaps to `left` or `right`.
- **Drag tangentially** on the dim backdrop or the wheel to spin it.
- **Flick** to release with momentum — the wheel coasts and decelerates.
- **Tap a sector** to select that item (`onSelect` fires).
- **Tap the backdrop** without dragging to close the wheel.
- **iOS Safari hardened** — no `setPointerCapture` (which silently breaks touches on `<button>`), pull-to-refresh disabled while open, body scroll locked.

## Props

```ts
interface ThumbwheelProps {
  items: ThumbwheelItem[];
  onSelect?: (item: ThumbwheelItem) => void;

  defaultDock?: 'left' | 'right';      // default 'right'
  storageKey?: string;                  // default 'thumbwheel-dock'

  triggerIcon?: ReactNode;              // default: hamburger SVG
  closeIcon?: ReactNode;                // default: X SVG

  theme?: ThumbwheelTheme;              // colors (hex strings)
  geometry?: ThumbwheelGeometry;        // radii, arc, trigger size
  physics?: ThumbwheelPhysics;          // momentum tuning

  triggerLabelOpen?: string;            // a11y, default 'Close navigation'
  triggerLabelClose?: string;           // a11y, default 'Open navigation'
}

interface ThumbwheelItem {
  id: string;
  label: string;
  icon?: ReactNode;
}
```

See `src/types.ts` for full theme / geometry / physics shape.

## Why this exists

iOS-friendly radial menus with momentum aren't cleanly available as a React library. Most existing options are either (a) wheel-of-fortune libraries built for landing on prizes, (b) centered popup pie menus that don't fit a one-handed thumb-arc usage pattern, or (c) prototypes that fall apart on iOS Safari due to `setPointerCapture` + `<button>` quirks. This component started life inside an Agora codebase, hardened against iOS Safari real-device behavior, and was extracted because it had no business living inside a vertical-product monorepo.

## Development

```bash
npm install
npm run dev          # Vite demo at http://localhost:5173
npm run build        # tsup -> dist/ (ESM + CJS + .d.ts)
npm run typecheck
```

## Known constraints

A few things you'll trip on otherwise:

- **iOS hardware silent switch overrides `tickSound`.** Web Audio respects iOS's hardware silent toggle (the orange-dot switch on the side of the phone). When silent mode is on, ticks won't play regardless of any `AudioContext` setup. There's no clean web workaround — flip the switch to ring mode to test audio. The library still creates the AudioContext synchronously in pointerdown so it's correctly activated for iOS's user-gesture rule; this is purely a hardware mute.

- **iOS Safari address-bar extension needs `viewport-fit=cover`.** The wheel uses `100lvh` and a probe-based viewport detection so it can extend behind iOS Safari's bottom address bar. For that to actually render edge-to-edge (rather than getting cropped at the safe-area boundary), the host page must opt into edge-to-edge layout via the viewport meta tag:

  ```ts
  // Next.js 15+ App Router
  export const viewport: Viewport = { viewportFit: 'cover' };
  ```

  ```html
  <!-- plain HTML -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  ```

- **Local LAN dev (testing on a real phone) needs `allowedDevOrigins`.** Next.js 16 blocks cross-origin requests to `/_next/static/*` by default. A page served at `localhost:3000` is treated as a different origin from `192.168.1.x:3000`, so a phone hitting the LAN IP gets HTML but no JS. Add this to your Next config:

  ```ts
  // next.config.ts
  module.exports = {
    allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*'],
  };
  ```

- **`'use client'` is on the component file.** The build preserves the directive in both ESM and CJS output, so consumers in Next.js App Router server-component trees can `import { Thumbwheel } from 'thumbwheel'` directly without wrapping it in a custom client component.

- **localStorage access is guarded for SSR.** The component checks `typeof window === 'undefined'` before reading dock or radius preferences, so a server-render won't throw.

## License

MIT — see [LICENSE](./LICENSE).
