import { useState, type ReactNode } from 'react';
import { Thumbwheel, type ThumbwheelItem } from 'thumbwheel';

// Tiny inline SVG icons so the demo has zero dependencies. Real
// consumers would pass icons from lucide-react / heroicons / etc.
function Icon({ d }: { d: string }): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

// Desaturated, low-chroma palette — distinct sectors without a rainbow
// look. Reads as a curated set of natural pigments rather than primary
// colors. Each value picked for adjacent-sector contrast (even/odd
// alternation visually grouped while remaining individually identifiable).
const ITEMS: ThumbwheelItem[] = [
  { id: 'home',      label: 'Home',      color: '#f5e9d4', icon: <Icon d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" /> },
  { id: 'news',      label: 'News',      color: '#dde2d7', icon: <Icon d="M4 4h12v16H4zM16 8h4v12h-4M8 8h4M8 12h4M8 16h4" /> },
  { id: 'learn',     label: 'Learn',     color: '#e8dfc8', icon: <Icon d="M22 10L12 4 2 10l10 6 10-6zM6 12v5c3 2 9 2 12 0v-5" /> },
  { id: 'directory', label: 'Directory', color: '#cfd6d0', icon: <Icon d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" /> },
  { id: 'projects',  label: 'Projects',  color: '#e3cfb5', icon: <Icon d="M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /> },
  { id: 'books',     label: 'Books',     color: '#d4c8be', icon: <Icon d="M4 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H4zM20 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" /> },
  { id: 'profile',   label: 'Profile',   color: '#e7e0e0', icon: <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /> },
  { id: 'help',      label: 'Help',      color: '#c9d2d2', icon: <Icon d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /> },
  { id: 'settings',  label: 'Settings',  color: '#dcd3c5', icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /> },
  { id: 'login',     label: 'Sign in',   color: '#ece4d3', icon: <Icon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /> },
];

const ITEM_COUNTS = [4, 6, 8, 10] as const;

// Inline-styled range slider matching the segmented control's row
// layout (label on the left, control in the middle, value on the right).
function Slider(props: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const { label, min, max, step = 1, value, onChange, unit = '' } = props;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px' }}>
      <span
        style={{
          fontSize: '11px',
          color: '#78716c',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          minWidth: '60px',
        }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#1c1917' }}
      />
      <span
        style={{
          fontSize: '12px',
          color: '#44403c',
          minWidth: '44px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {unit}
      </span>
    </div>
  );
}

// Inline-styled segmented control. Each option is a button; the active
// option is filled with the dark tone, others are outlined. No colored
// edge stripes — pressed state is conveyed via fill swap, not accents.
function Segmented<T extends string | number>(props: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { label, options, value, onChange } = props;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px' }}>
      <span
        style={{
          fontSize: '11px',
          color: '#78716c',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          minWidth: '60px',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', border: '1px solid #d6d3d1', borderRadius: '6px', overflow: 'hidden' }}>
        {options.map((opt, i) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: active ? '#1c1917' : 'transparent',
                color: active ? '#fafaf9' : '#44403c',
                border: 'none',
                borderLeft: i === 0 ? 'none' : '1px solid #d6d3d1',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: active ? 500 : 400,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function App() {
  const [lastTapped, setLastTapped] = useState<ThumbwheelItem | null>(null);
  const [tickSound, setTickSound] = useState(true);
  const [itemCount, setItemCount] = useState<(typeof ITEM_COUNTS)[number]>(10);
  const [fixed, setFixed] = useState(false);
  const [rows, setRows] = useState<1 | 2>(1);
  const [bandWidth, setBandWidth] = useState(5);

  const visibleItems = ITEMS.slice(0, itemCount);

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>Thumbwheel demo</h1>
      <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#57534e', margin: '0 0 16px' }}>
        Tap the round button to open the wheel. Drag the trigger sideways to dock
        it on the other edge. Spin by dragging on the dim backdrop or directly on
        the wheel; flick to coast. Drag the rim bump to resize.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '16px',
          background: 'white',
          border: '1px solid #e7e5e4',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <Segmented
          label="Sound"
          value={tickSound ? 'on' : 'off'}
          onChange={(v) => setTickSound(v === 'on')}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
        />
        <Segmented
          label="Items"
          value={itemCount}
          onChange={setItemCount}
          options={ITEM_COUNTS.map((n) => ({ value: n, label: String(n) }))}
        />
        <Segmented
          label="Motion"
          value={fixed ? 'fixed' : 'spin'}
          onChange={(v) => setFixed(v === 'fixed')}
          options={[
            { value: 'spin', label: 'Spinning' },
            { value: 'fixed', label: 'Fixed' },
          ]}
        />
        <Segmented
          label="Rows"
          value={rows}
          onChange={setRows}
          options={[
            { value: 1, label: '1 row' },
            { value: 2, label: '2 rows' },
          ]}
        />
        <Slider
          label="Band"
          min={0}
          max={20}
          step={1}
          value={bandWidth}
          onChange={setBandWidth}
          unit="px"
        />
      </div>

      <div
        style={{
          padding: '16px',
          background: 'white',
          border: '1px solid #e7e5e4',
          borderRadius: '6px',
          minHeight: '64px',
        }}
      >
        <p style={{ fontSize: '11px', margin: '0 0 4px', color: '#a8a29e', letterSpacing: '0.05em' }}>
          Last tap
        </p>
        {lastTapped ? (
          <p style={{ fontSize: '15px', margin: 0, fontWeight: 500 }}>{lastTapped.label}</p>
        ) : (
          <p style={{ fontSize: '13px', margin: 0, color: '#a8a29e', fontStyle: 'italic' }}>
            Nothing yet — open the wheel and tap a sector.
          </p>
        )}
      </div>

      <Thumbwheel
        items={visibleItems}
        onSelect={setLastTapped}
        enableResize
        tickSound={tickSound}
        fixed={fixed}
        rows={rows}
        geometry={{ outerBandWidth: bandWidth }}
      />
    </div>
  );
}
