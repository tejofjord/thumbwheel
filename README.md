# thumbwheel

Thumb-anchored radial wheel UI for one-handed mobile navigation. SVG sectors with radial spokes and arcs, momentum-spin gesture, dock-snapping trigger button.

> Status: pre-1.0. API surface may shift. Battle-tested on iOS Safari.

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

## License

MIT — see [LICENSE](./LICENSE).
