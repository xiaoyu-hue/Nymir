/* e2e/smoke.spec.js - 冒烟 E2E（真实浏览器）
 * 覆盖：零错误加载 / CSP 零违规 / 静态资源完整性 / 首次设置密码 / 创建房间进入聊天
 * 依赖 DOM 契约（组件同款 class）：.lock-input、.room-panel-input-name、
 * .room-panel-submit、.chat-view。语言跟随浏览器（E2E 环境默认英文界面）。
 */
import { test, expect } from '@playwright/test';

function collectBreaches(page) {
  const arr = [];
  page.on('pageerror', (e) => arr.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') arr.push('console: ' + m.text());
  });
  page.on('requestfailed', (r) =>
    arr.push('requestfailed: ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')),
  );
  page.on('response', (r) => {
    if (r.status() >= 400) arr.push('http' + r.status() + ': ' + r.url());
  });
  return arr;
}

/** 环境网络噪声：沙箱代理导致的 WebSocket 建连失败（真实用户环境不出现） */
function isNetworkNoise(msg) {
  return (
    (msg.includes('WebSocket connection to') && msg.includes('failed')) ||
    msg.includes('tunnel via proxy')
  );
}

test('冒烟: 首页零错误、CSP 零违规、静态资源全部 200', async ({ page }) => {
  const breaches = collectBreaches(page);
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(e.violatedDirective + ' :: ' + e.blockedURI);
    });
  });
  await page.goto('/');
  // 首次访问：安全密码界面（LockScreen）出现
  await expect(page.locator('.lock-input').first()).toBeVisible({ timeout: 20000 });
  // 忽略 favicon 等非关键资源缺失（浏览器对图标请求容忍度差异大）
  expect(breaches.filter((b) => !b.includes("favicon") && !isNetworkNoise(b))).toEqual([]);
  const csp = await page.evaluate(() => window.__cspViolations);
  expect(csp).toEqual([]);
});

test('冒烟: 首次设置密码 → 创建房间 → 进入聊天界面', async ({ page }) => {
  const breaches = collectBreaches(page);
  await page.goto('/');
  // 1) 设置密码（两个输入框一致）
  await expect(page.locator('.lock-input').first()).toBeVisible({ timeout: 20000 });
  await page.locator('.lock-input').nth(0).fill('e2e-pass-2026');
  await page.locator('.lock-input').nth(1).fill('e2e-pass-2026');
  await page.getByRole('button', { name: 'Set Password' }).click();
  // 2) 房间面板出现（默认"创建"页签）
  await expect(page.locator('.room-panel-input-name')).toBeVisible({ timeout: 25000 });
  await page.locator('.room-panel-input-name').fill('E2E smoke room');
  await page.getByRole('button', { name: 'Create Room' }).click();
  // 3) 进入聊天界面（房间创建成功；信令为 P2P 可选，房间本身本地即可进入）
  await expect(page.locator('.chat-view')).toBeVisible({ timeout: 30000 });
  expect(breaches.filter((b) => !b.includes("favicon") && !isNetworkNoise(b))).toEqual([]);
});
