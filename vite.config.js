import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import react from '@vitejs/plugin-react';

// No dev proxy here on purpose. Google's OAuth redirect URI points at
// k12-llm-backend's own /api/auth/callback/google in every environment, so the
// browser talks to the backend directly (see src/api/config.ts) and the dev
// server never sits in the middle. Proxying /api/auth here would give dev a
// different code path than production — which is exactly how the two drift.
export default defineConfig({
  base: '/v2/',
  plugins: [
    react(),
    checker({
      typescript: true,
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.grammar.js', '.grammar'],
  },
});
