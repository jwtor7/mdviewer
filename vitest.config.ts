import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom environment for React component tests
    environment: 'jsdom',

    // Setup file for test environment (matchers, mocks, etc.)
    setupFiles: ['./src/test/setup.ts'],

    // Enable globals (describe, it, expect, etc.) without imports
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'out/',
        '.vite/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'src/main.ts', // Main process (Electron-specific, needs different test setup)
        'src/preload.ts', // Preload script (Electron-specific)
      ],
      // Coverage thresholds - reflecting comprehensive test suite (395+ tests)
      thresholds: {
        lines: 30,
        functions: 50,
        branches: 50,
        statements: 30,
      },
    },

    // Exclude patterns
    exclude: [
      'node_modules',
      'out',
      '.vite',
      'dist',
      '**/*.config.*',
      '**/mockData/**',
    ],

    // Include patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },

  // Resolve configuration matching the renderer vite config
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      // Add path aliases if needed in the future
      '@': path.resolve(__dirname, './src'),
    },
  },
});
