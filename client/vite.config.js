import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FinFlow',
        short_name: 'FinFlow',
        theme_color: '#0F6E56',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }
    })
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:5010',
      '/socket.io': {
        target: 'http://localhost:5010',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});
