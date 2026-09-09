import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Toto',
        short_name: 'Toto',
        description: 'My application',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/weather/, /^\/ws/],
      },

      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    https: {
      key: fs.readFileSync('../certs/archie-mini-pc.tail802449.ts.net.key'),
      cert: fs.readFileSync('../certs/archie-mini-pc.tail802449.ts.net.crt'),
    },
    host: '0.0.0.0',
    hmr: {
      host: 'archie-mini-pc.tail802449.ts.net',
      protocol: 'wss',
      clientPort: 5173
    },
    watch: {
      ignored: ['**/.env', '**/certs/**', path.resolve(__dirname, '../certs/**'),]
    }
  }
})
