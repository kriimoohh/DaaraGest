import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Libs lourdes utilisées sur 1-2 écrans → chunks dédiés
          'recharts': ['recharts'],
          'qrcode': ['html5-qrcode'],
          'papaparse': ['papaparse'],
          // Vendor stable
          'react': ['react', 'react-dom', 'react-router-dom'],
          'i18n': ['i18next', 'react-i18next'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
