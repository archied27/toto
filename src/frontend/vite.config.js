import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
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
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
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
                    { src: 'icons/toto-apple-touch-icon-v3.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
                    { src: 'icons/toto-apple-touch-icon-1024-v3.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                cleanupOutdatedCaches: true,
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/weather/, /^\/ws/],
            },
            devOptions: {
                enabled: true
            },
            injectManifest: {
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            },
        })
    ],
    server: command === 'serve' ? {
        https: {
            key: fs.readFileSync('../certs/archlinux.tail802449.ts.net.key'),
            cert: fs.readFileSync('../certs/archlinux.tail802449.ts.net.crt'),
        },
        host: '0.0.0.0',
        hmr: {
            host: 'archlinux.tail802449.ts.net',
            protocol: 'wss',
            clientPort: 5173
        },
        watch: {
            ignored: ['**/.env', '**/certs/**', path.resolve(__dirname, '../certs/**'),]
        }
    } : {}
}));