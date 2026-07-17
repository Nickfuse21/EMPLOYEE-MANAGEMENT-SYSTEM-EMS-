import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration.
// - React plugin enables JSX/Fast-Refresh.
// - The dev server proxies "/api" to the backend so the frontend can call the
//   API on the same origin during development (avoids CORS friction).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libraries into their own cached chunks so the
        // main app bundle stays small and loads fast.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
