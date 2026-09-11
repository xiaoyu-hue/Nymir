import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const basePath = process.env.BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Nymir · 树洞',
        short_name: 'Nymir',
        description: '匿名树洞阅读即焚应用 — 无后端、无服务器、无数据记录',
        theme_color: '#0a0a1a',
        background_color: '#0a0a1a',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'zh-CN',
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,webmanifest,svg,png,woff2}'],
        navigateFallback: `${basePath}index.html`,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tracker\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tracker-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/main.tsx',
        'src/i18n/**',
        'src/utils/logger.ts',
      ],
      // 覆盖率阈值：低于此值则测试失败（CI 门禁）
      // 当前基线设定为保守值（2026-09-11），后续可逐步提高
      // 已知低覆盖区域：peer.ts(0%)、UI组件(大部分0%)、room.ts(35%)、message.ts(45%)
      thresholds: {
        lines: 45,
        functions: 35,
        branches: 28,
        statements: 44,
      },
    },
  },
})
