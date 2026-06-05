/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use 'prompt' (not 'autoUpdate'): the app ships a manual update UI
      // (PWAPrompt) and a separate Firebase messaging service worker
      // (firebase-messaging-sw.js, registered by getToken at the same '/'
      // scope). With 'autoUpdate' the generated worker uses skipWaiting +
      // clientsClaim and reloads on every controllerchange, so the two
      // workers contending for control trigger an endless page-reload loop.
      // 'prompt' only reloads when the user clicks "Reload & Update".
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/icon-192x192.png', 'icons/icon-512x512.png'],
      manifest: {
        name: 'DSEasy - Financial Dashboard',
        short_name: 'DSEasy',
        description: 'Track DSE market data, trends, and analytics in real-time.',
        theme_color: '#6366f1',
        background_color: '#1e293b',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        importScripts: ['/firebase-messaging-sw.js'],
        navigateFallbackDenylist: [/^\/__/],
      }
    })
  ],
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-ui': ['lucide-react', 'react-datepicker']
        }
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/firestore.rules.test.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/utils/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/utils/chartTheme.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
})
