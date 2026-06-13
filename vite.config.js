import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Capture-screenshot waits for manual CAPTCHA + Playwright; default 60s proxy kills the request.
const LONG_API_MS = 30 * 60 * 1000; // 30 minutes

const apiProxy = {
  '/api': {
    target: 'http://localhost:5524',
    changeOrigin: true,
    proxyTimeout: LONG_API_MS,
    timeout: LONG_API_MS,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
