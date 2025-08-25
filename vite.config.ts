import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  const port = parseInt(env.VITE_DEV_PORT) || 3000;

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@renderer': path.resolve(__dirname, './src/renderer'),
        '@main': path.resolve(__dirname, './src/main'),
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
    server: {
      port,
      strictPort: true, // Fail if port is already in use instead of trying another port
      host: true, // Allow external connections
    },
  };
});
