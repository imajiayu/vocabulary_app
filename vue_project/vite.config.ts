import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: process.env.NODE_ENV === 'production' ? 5173 : 443,
    host: '0.0.0.0',
    open: true,
    https: process.env.NODE_ENV === 'production'
      ? undefined
      : (fs.existsSync(resolve(__dirname, 'localhost+2-key.pem')) ? {
          key: fs.readFileSync(resolve(__dirname, 'localhost+2-key.pem')),
          cert: fs.readFileSync(resolve(__dirname, 'localhost+2.pem')),
        } : undefined),
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]',
      },
    },
  },
})