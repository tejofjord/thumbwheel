import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DesktopShell } from './DesktopShell';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

// Two-mode boot:
//   - ?embed=1 in the URL -> render the raw demo (used by the iframe
//     inside DesktopShell, and as a manual desktop override).
//   - narrow viewport -> phones get the raw demo; the framed shell
//     would just be a tiny phone inside a phone.
//   - everything else -> desktop shell with a skeu phone frame around
//     an iframe of `?embed=1`.
// Single boot-time check; resizing across the breakpoint requires a
// page refresh. Fine for a demo.
const isEmbed =
  new URL(window.location.href).searchParams.get('embed') === '1';
const isNarrow = window.matchMedia('(max-width: 600px)').matches;
const renderRaw = isEmbed || isNarrow;

createRoot(container).render(
  <React.StrictMode>{renderRaw ? <App /> : <DesktopShell />}</React.StrictMode>,
);
