import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite config for the demo app. The library itself is built with tsup
// (see tsup.config.ts). This is purely for `npm run dev` to spin up a
// local demo of the wheel for visual iteration.
export default defineConfig({
  root: 'demo',
  plugins: [react()],
  resolve: {
    alias: {
      // Demo imports the library by package name so the demo doubles as
      // an integration test of the public API.
      thumbwheel: path.resolve(__dirname, 'src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow LAN-private origins for testing on physical phones.
    // Mirrors the RFC1918 ranges so iPhones on the same Wi-Fi can hit
    // the dev server without cross-origin chunk blocking.
    cors: true,
  },
});
