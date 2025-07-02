import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 从根目录加载所有环境变量（包括非 VITE_ 前缀的）
  const env = loadEnv(mode, resolve(__dirname, '..'), '')

  return {
    plugins: [vue()],
    // 将后端的环境变量映射给前端使用（复用现有配置，无需 VITE_ 前缀）
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
      'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
      'import.meta.env.VITE_GOOGLE_STT_API_KEY': JSON.stringify(env.GOOGLE_STT_API_KEY),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      open: true,
      proxy: {
        '/api/relations': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
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
          // 手动分包 - 将大型第三方库独立打包，提升缓存效率
          manualChunks: {
            // Vue 核心库
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            // 图表库（较大，独立打包）
            'echarts': ['echarts', 'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          },
        },
      },
      // 提高警告阈值，避免不必要的警告
      chunkSizeWarningLimit: 600,
    },
  }
})
