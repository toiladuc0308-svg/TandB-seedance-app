import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Dùng đường dẫn tương đối để chạy được dưới dạng file:// (Electron)
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      '/gommo-api': {
        target: 'https://api.gommo.net/api/apps/go-mmo',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gommo-api/, ''),
        secure: false,
        headers: {
          Origin: 'https://79ai.net',
          Referer: 'https://79ai.net/',
        },
      },
      '/catbox-upload': {
        target: 'https://catbox.moe',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/catbox-upload/, '/user/api.php'),
        secure: false,
      },
      '/litterbox-upload': {
        target: 'https://litterbox.catbox.moe',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/litterbox-upload/, '/resources/internals/api.php'),
        secure: false,
      },
    },
  },
});
