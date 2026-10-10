import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds <gsic-ecosystem-map> (src/embed.tsx), the version of the map that
// mounts directly in another site's page instead of an iframe.
//
// Runs after the main build and writes into the same dist/, under embed/, with
// one stable entry file (embed/ecosystem-map.js) that host pages load. The
// base is absolute because the code runs on someone else's page: data, fonts
// and code chunks must load from the map's own site, not the host's.
const ORIGIN = process.env.EMBED_ORIGIN ?? 'https://ecosystem-map.gasocialimpact.com/';

export default defineConfig({
  plugins: [react()],
  base: ORIGIN,
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/embed.tsx',
      // Keep the custom element registration even though nothing imports it.
      preserveEntrySignatures: 'allow-extension',
      output: {
        entryFileNames: 'embed/ecosystem-map.js',
        chunkFileNames: 'embed/assets/[name]-[hash].js',
        assetFileNames: 'embed/assets/[name]-[hash][extname]',
      },
    },
  },
});
