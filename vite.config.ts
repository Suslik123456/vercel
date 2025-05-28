// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: () => 'bundle', // force a single bundle
        entryFileNames: `bundle.js`,
        chunkFileNames: `bundle.js`,
        assetFileNames: `assets/[name][extname]`
      }
    }
  }
});

