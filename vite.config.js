import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/v2/',
  plugins: [
    react(),
    checker({
      typescript: true,
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.grammar.js', '.grammar']
  }
});
