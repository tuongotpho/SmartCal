import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['@tauri-apps/plugin-shell', '@tauri-apps/api']
    }
  },
  server: {
    port: 3000,
    strictPort: true
  }
});