import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@sim': resolve(__dirname, 'src/sim'),
      '@ui': resolve(__dirname, 'src/ui'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
