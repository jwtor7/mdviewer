import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  server: {
    open: false, // Don't open browser window for Electron app
  },
});
