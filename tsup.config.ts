import { defineConfig } from 'tsup';

// Build the library to dual ESM + CJS with type declarations.
// React/react-dom are externalized via peerDependencies in package.json.
// `use client` directives are preserved so the component works in
// Next.js App Router server-component trees without consumer setup.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  banner: ({ format }) => {
    // Preserve "use client" — tsup strips top-level directives by default
    // but App Router needs them on the bundled output too.
    if (format === 'esm' || format === 'cjs') {
      return { js: '"use client";' };
    }
    return {};
  },
});
