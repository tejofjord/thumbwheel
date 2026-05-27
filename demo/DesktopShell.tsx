import { type CSSProperties } from 'react';

// Inner screen dimensions match a modern iPhone-class device so the
// thumbwheel's window-scoped APIs (position: fixed, 100lvh, window
// pointer listeners) bind to a viewport that actually feels phone-sized.
const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 14;
const OUTER_RADIUS = 56;
// Concentric corner radii: inner = outer - bezel. Same rule real phones
// follow; mismatched radii read as visually wrong even when viewers
// can't articulate why.
const SCREEN_RADIUS = OUTER_RADIUS - BEZEL;

const wrapperStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 28,
  padding: 32,
  boxSizing: 'border-box',
  background:
    'radial-gradient(ellipse at 50% 20%, #fafaf9 0%, #e7e5e4 60%, #d6d3d1 100%)',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#1c1917',
};

const headerStyle: CSSProperties = {
  textAlign: 'center',
  maxWidth: 420,
};

const titleStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  margin: 0,
};

const captionStyle: CSSProperties = {
  fontSize: 13,
  color: '#57534e',
  lineHeight: 1.55,
  marginTop: 8,
};

const linkStyle: CSSProperties = {
  color: '#1c1917',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

const phoneStyle: CSSProperties = {
  position: 'relative',
  width: SCREEN_W + BEZEL * 2,
  height: SCREEN_H + BEZEL * 2,
  borderRadius: OUTER_RADIUS,
  padding: BEZEL,
  boxSizing: 'border-box',
  background:
    'linear-gradient(155deg, #2a2724 0%, #1c1917 35%, #1c1917 65%, #2a2724 100%)',
  boxShadow:
    '0 40px 80px -28px rgba(0, 0, 0, 0.5), 0 18px 40px -18px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
};

// Diagonal gloss across the chassis. pointer-events: none so the user
// can still drag the wheel right through this layer.
const rimGlossStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: OUTER_RADIUS,
  pointerEvents: 'none',
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)',
};

const screenStyle: CSSProperties = {
  position: 'relative',
  width: SCREEN_W,
  height: SCREEN_H,
  borderRadius: SCREEN_RADIUS,
  overflow: 'hidden',
  background: '#fafaf9',
  boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.5)',
};

// Dynamic Island. pointer-events: none so it doesn't intercept drags
// that begin near the top of the screen.
const islandStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 124,
  height: 36,
  borderRadius: 18,
  background: '#0a0a0a',
  zIndex: 2,
  pointerEvents: 'none',
  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
};

const iframeStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 'none',
  background: '#fafaf9',
};

export function DesktopShell() {
  return (
    <div style={wrapperStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Thumbwheel</h1>
        <p style={captionStyle}>
          A thumb-anchored radial wheel for one-handed mobile navigation.
          Drag inside the device to spin; tap the corner button to open.
          For the real feel, open{' '}
          <a href={window.location.href} style={linkStyle}>
            this page
          </a>{' '}
          on a phone.
        </p>
      </header>
      <div style={phoneStyle}>
        <div style={screenStyle}>
          <div style={islandStyle} />
          <iframe
            src="?embed=1"
            title="Thumbwheel interactive demo"
            style={iframeStyle}
          />
        </div>
        <div style={rimGlossStyle} />
      </div>
    </div>
  );
}
