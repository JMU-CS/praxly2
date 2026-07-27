import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read VITE_BACKEND_URL from .env so the OAuth proxy below always points at
  // the same backend the app itself talks to.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3000';

  return {
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
    server: {
      proxy: {
        // Google's registered redirect URI points at this dev server
        // (http://localhost:5173/api/auth/callback/google) because the OAuth
        // client's authorized origins are the app's, not the API's. The
        // callback itself is handled by k12-llm-backend, so forward the whole
        // /api/auth prefix there. In production, register the backend's own
        // callback URL and this proxy is never involved.
        '/api/auth': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
