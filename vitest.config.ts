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
      // Coverage thresholds - start low, increase as more tests are added
      // Current coverage: ~6% lines, ~48% functions (with 3 example tests)
      // Target: Gradually increase to 60%+ as test suite grows
      thresholds: {
        lines: 5,
        functions: 45,
        branches: 50,
        statements: 5,
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
