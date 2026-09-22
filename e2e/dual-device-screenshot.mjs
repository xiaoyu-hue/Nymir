/* e2e/dual-device-screenshot.mjs - 双端联调 + 关键节点截图
 * 用法：node e2e/dual-device-screenshot.mjs [输出目录]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:4173';
const PASS = process.env.NYMIR_E2E_PASSWORD || 'dual-pass-2026';
const OUT = process.argv[2] || path.resolve(__dirname, '..', 'test-results', 'dual-device');
mkdirSync(OUT, { recursive: true });

async function setupDevice(browser, tag) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE);
  await page.locator('.lock-input').nth(0).waitFor({ timeout: 30000 });
  await page.locator('.lock-input').nth(0).fill(PASS);
  await page.locator('.lock-input').nth(1).fill(PASS);
  await page.getByRole('button', { name: 'Set Password' }).click();
  await page.locator('.room-panel-input-name').waitFor({ timeout: 30000 });
  return { context, page, errors };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    // ---- A 创建房间 ----
    const A = await setupDevice(browser, 'A');
    await A.page.locator('.room-panel-input-name').fill('Dual-device test room');
    await A.page.getByRole('button', { name: 'Create Room' }).click();
    await A.page.locator('.chat-view').waitFor({ timeout: 30000 });
    const code = (await A.page.locator('.room-code-value').textContent()).trim();
    await A.page.screenshot({ path: path.join(OUT, '01-A-created-room.png'), fullPage: false });

    // ---- B 加入 ----
    const B = await setupDevice(browser, 'B');
    await B.page.getByRole('tab', { name: 'Join' }).click();
    await B.page.locator('.room-panel-input-code').fill(code);
    await B.page.getByRole('button', { name: 'Join Room' }).click();
    await B.page.locator('.chat-view').waitFor({ timeout: 30000 });
    await B.page.screenshot({ path: path.join(OUT, '02-B-joined-room.png'), fullPage: false });

    // ---- 等在线 ----
    let connected = false;
    for (let i = 0; i < 18; i++) {
      await A.page.waitForTimeout(3000);
      const aS = (await A.page.locator('.chat-status-text').textContent()) || '';
      const bS = (await B.page.locator('.chat-status-text').textContent()) || '';
      if (aS.includes('online') && bS.includes('online')) { connected = true; break; }
    }
    if (!connected) { console.log('FAIL: not connected'); process.exit(1); }

    // ---- A 发消息 ----
    const msgA = 'Hello from device A 👋 ' + Date.now();
    await A.page.locator('.chat-textarea').fill(msgA);
    await A.page.screenshot({ path: path.join(OUT, '03-A-typing.png'), fullPage: false });
    await A.page.getByRole('button', { name: 'Send' }).click();

    // ---- B 收到（截图：B 看到 A 的消息）----
    await B.page.locator('.message-wrapper.other .message-content-box', { hasText: msgA }).waitFor({ timeout: 20000 });
    await B.page.waitForTimeout(600);
    await B.page.screenshot({ path: path.join(OUT, '04-B-received-from-A.png'), fullPage: false });

    // ---- B 回复 ----
    const msgB = 'Hello from device B 👋 ' + Date.now();
    await B.page.locator('.chat-textarea').fill(msgB);
    await B.page.getByRole('button', { name: 'Send' }).click();

    // ---- A 收到（截图：A 看到 B 的消息）----
    await A.page.locator('.message-wrapper.other .message-content-box', { hasText: msgB }).waitFor({ timeout: 20000 });
    await A.page.waitForTimeout(600);
    await A.page.screenshot({ path: path.join(OUT, '05-A-received-from-B.png'), fullPage: false });

    console.log('ALL PASS');
    console.log('A errors:', A.errors.filter((e) => !e.includes('favicon')).slice(0, 5));
    console.log('B errors:', B.errors.filter((e) => !e.includes('favicon')).slice(0, 5));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
