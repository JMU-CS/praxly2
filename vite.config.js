import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { resolve } from 'path';

export default defineConfig({
  base: '/v2/',
  plugins: [
    checker({
      typescript: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        embed: resolve(__dirname, 'embed.html'),
        main: resolve(__dirname, 'main.html'),
        sandbox: resolve(__dirname, 'sandbox.html'),
      },
    },
  },
});
