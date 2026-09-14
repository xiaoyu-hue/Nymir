/* playwright.config.js - 冒烟 E2E：三端（桌面/手机/平板）真实渲染验证
 * Nymir 为 React + Vite SPA：webServer 先 build 再用 vite preview 提供 dist
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 40000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 240000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-ios',
      use: {
        browserName: 'webkit',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-ipad',
      use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
});
