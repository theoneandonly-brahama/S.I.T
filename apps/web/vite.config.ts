import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

// The repository-root .env is the single source of local configuration
// (the API loads the same file). Vite only auto-loads .env from the
// package directory, so read the root one explicitly.
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// https://vite.dev/config/
// The API currently serves its endpoints at the server root (no global
// prefix), so the dev proxy hands requests over at the bare origin and
// rewrites the `/api` base away. When the API introduces a real
// versioned prefix (e.g. `api/v1` as anticipated in .env.example), the
// rewrite target changes here — clients keep calling the `/api` base.
// The target is overridable via SIT_API_TARGET (shell wins over .env).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, REPO_ROOT, '');
  const apiTarget =
    process.env.SIT_API_TARGET ?? env.SIT_API_TARGET ?? 'http://127.0.0.1:3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
