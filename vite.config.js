import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [vue()],

  // Force Vite to pre-bundle Phaser eagerly at startup rather than on first
  // browser request — eliminates the 13s cold-compile hit in dev mode.
  optimizeDeps: {
    include: ['phaser'],
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    // Phaser is ~1.5 MB minified; that's unavoidable for a game engine.
    // Suppress the default 500 KB chunk warning for this known large chunk.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Separate Phaser and Vue into their own cached chunks.
        // After a deploy, only the small game-logic chunk needs re-downloading
        // by returning visitors — the 1.2 MB Phaser chunk stays in cache.
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['vue'],
        },
      },
    },
  },
  server: {
    // Fixed port prevents Vite randomly changing the local port
    port: 3000,
    strictPort: true,
    open: true,
    // Pre-warm the Phaser pre-bundle so it's in memory on first browser load.
    warmup: {
      clientFiles: ['./Game/main.js'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
});

