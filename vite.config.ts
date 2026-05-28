import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is set to a relative path so the built site works whether it is
// served from a domain root or a project subpath (e.g. GitHub Pages).
export default defineConfig({
  plugins: [react()],
  base: './',
});
