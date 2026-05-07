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

const ITEMS: ThumbwheelItem[] = [
  { id: 'home', label: 'Home', icon: <Icon d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" /> },
  { id: 'news', label: 'News', icon: <Icon d="M4 4h12v16H4zM16 8h4v12h-4M8 8h4M8 12h4M8 16h4" /> },
  { id: 'learn', label: 'Learn', icon: <Icon d="M22 10L12 4 2 10l10 6 10-6zM6 12v5c3 2 9 2 12 0v-5" /> },
  { id: 'directory', label: 'Directory', icon: <Icon d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" /> },
  { id: 'projects', label: 'Projects', icon: <Icon d="M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /> },
  { id: 'books', label: 'Books', icon: <Icon d="M4 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H4zM20 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" /> },
  { id: 'profile', label: 'Profile', icon: <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /> },
  { id: 'help', label: 'Help', icon: <Icon d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /> },
  { id: 'settings', label: 'Settings', icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /> },
  { id: 'login', label: 'Sign in', icon: <Icon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /> },
];

export function App() {
  const [lastTapped, setLastTapped] = useState<ThumbwheelItem | null>(null);

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>Thumbwheel demo</h1>
      <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#57534e', margin: '0 0 12px' }}>
        Tap the round button (bottom-{lastTapped ? 'corner' : 'right by default'}) to open the
        wheel. Drag the trigger sideways to dock it left or right. Spin the wheel by dragging
        on the dim backdrop or directly on the wheel; flick to coast on momentum.
      </p>
      <div
        style={{
          padding: '16px',
          background: 'white',
          border: '1px solid #e7e5e4',
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

      <Thumbwheel items={ITEMS} onSelect={setLastTapped} />
    </div>
  );
}
