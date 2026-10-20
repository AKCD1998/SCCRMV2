import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL = '' } = loadEnv(mode, process.cwd(), 'VITE_API_BASE_URL');
  if (mode === 'production') {
    const target = new URL(VITE_API_BASE_URL);
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) {
      throw new Error('Production VITE_API_BASE_URL must be an HTTPS API URL without credentials.');
    }
  }
  return {
    plugins: [react()],
    // Only the public API location is allowed into a browser build.
    envPrefix: [],
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(VITE_API_BASE_URL) },
  };
});
