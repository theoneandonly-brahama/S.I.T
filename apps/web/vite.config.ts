import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// The API currently serves its endpoints at the server root (no global
// prefix), so the dev proxy hands requests over at the bare origin and
// rewrites the `/api` base away. When the API introduces a real
// versioned prefix (e.g. `api/v1` as anticipated in .env.example), the
// rewrite target changes here — clients keep calling the `/api` base.
// The target is overridable for non-default API hosts via SIT_API_TARGET.
const API_TARGET = process.env.SIT_API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
