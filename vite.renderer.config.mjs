import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  server: {
    open: false, // Don't open browser - Electron window handles the UI
  },
});
