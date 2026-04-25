import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Deployed at https://mhaegeman.github.io/kokken-alrum/
export default defineConfig({
  base: '/kokken-alrum/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'Køkken alrum',
        short_name: 'Kokken',
        description:
          'Tasks, timeline, budget, and notes for our Copenhagen kitchen renovation.',
        theme_color: '#3F5E4E',
        background_color: '#FBFBF9',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/kokken-alrum/',
        start_url: '/kokken-alrum/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'maskable-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the app shell + static assets aggressively. The app's data
        // comes from Supabase at runtime, so we don't bake API responses
        // into the SW — but Supabase fonts and the Google Fonts CDN are
        // worth caching for instant cold-start.
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Don't try to handle Supabase API or storage URLs — let the
        // network handle them and let the app degrade gracefully when
        // offline (we serve last-known state from localStorage).
        navigateFallbackDenylist: [/^\/api\//, /supabase\.co/],
      },
    }),
  ],
  server: { port: 5173 },
});
