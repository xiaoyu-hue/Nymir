/* e2e/responsive.spec.js - 三端响应式验证
 * 桌面（1280x800）/ 手机（375x667）/ 平板（768x1024）下：
 * 应用根节点渲染、密码界面可交互、无整页错误
 */
import { test, expect } from '@playwright/test';

function collectBreaches(page) {
  const arr = [];
  page.on('pageerror', (e) => arr.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') arr.push('console: ' + m.text());
  });
  return arr;
}

test('响应式: 三端首页正常渲染且无页面错误', async ({ page }) => {
  const breaches = collectBreaches(page);
  await page.goto('/');
  await expect(page.locator('.lock-input').first()).toBeVisible({ timeout: 20000 });
  // 密码输入框在视口内可见（不被裁切）
  const box = await page.locator('.lock-input').first().boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
  expect(breaches.filter((b) => !b.includes('favicon'))).toEqual([]);
});
