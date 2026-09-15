/* e2e/burn-mode-test.mjs - 阅读即焚双端验证
 * Timed（10s 倒计时焚毁） + Read-once（显示即焚）双场景
 * 用法：node e2e/burn-mode-test.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import path from 'path';

const BASE = 'http://127.0.0.1:4173';
const PASS = 'dual-pass-2026';
const OUT = '/home/user/Doubao/chats/1482372049645826/Nymir/test-results/burn-mode';
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

let passed = 0, failed = 0;
function check(name, ok) {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}: ${name}`);
  ok ? passed++ : failed++;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    // ---- 双端建立房间并连接 ----
    const A = await setupDevice(browser, 'A');
    await A.page.locator('.room-panel-input-name').fill('Burn-mode test room');
    await A.page.getByRole('button', { name: 'Create Room' }).click();
    await A.page.locator('.chat-view').waitFor({ timeout: 30000 });
    const code = (await A.page.locator('.room-code-value').textContent()).trim();

    const B = await setupDevice(browser, 'B');
    await B.page.getByRole('tab', { name: 'Join' }).click();
    await B.page.locator('.room-panel-input-code').fill(code);
    await B.page.getByRole('button', { name: 'Join Room' }).click();
    await B.page.locator('.chat-view').waitFor({ timeout: 30000 });

    let connected = false;
    for (let i = 0; i < 18; i++) {
      await A.page.waitForTimeout(3000);
      const aS = (await A.page.locator('.chat-status-text').textContent()) || '';
      const bS = (await B.page.locator('.chat-status-text').textContent()) || '';
      if (aS.includes('online') && bS.includes('online')) { connected = true; break; }
    }
    check('双端在线', connected);
    if (!connected) { console.log('A errors:', A.errors.slice(0,4)); process.exit(1); }

    // ================= Timed：10s 倒计时焚毁 =================
    console.log('\n--- Timed (10s) ---');
    const timedMsg = 'burn-after-10s-' + Date.now();
    await A.page.getByRole('button', { name: 'Timed' }).click();
    // 默认 burnAfter=60s，需显式选 10s
    await A.page.locator('.burn-timer-select').selectOption('10');
    await A.page.locator('.chat-textarea').fill(timedMsg);
    await A.page.getByRole('button', { name: 'Send' }).click();

    // B 收到明文
    const bTimed = B.page.locator('.message-wrapper.other .message-content-box', { hasText: timedMsg });
    await bTimed.waitFor({ timeout: 20000 });
    const visibleText = await bTimed.textContent();
    check('B 收到 Timed 明文（未焚毁前内容可见）', visibleText.includes(timedMsg.split('-').pop()));

    // 等焚毁（10s 倒计时 + 动画余量）
    await A.page.waitForTimeout(15000);

    // 原文从双方列表彻底消失（焚毁 = 内容清除，无残留占位）
    const aTextGone = (await A.page.locator('.message-wrapper', { hasText: timedMsg }).count()) === 0;
    const bTextGone = (await B.page.locator('.message-wrapper', { hasText: timedMsg }).count()) === 0;
    check('A 侧 Timed 明文已焚毁消失', aTextGone);
    check('B 侧 Timed 明文已焚毁消失', bTextGone);
    await A.page.screenshot({ path: path.join(OUT, 'timed-burned.png') });

    // ================= Read-once：显示即焚 =================
    console.log('\n--- Read-once ---');
    const roMsg = 'read-once-secret-' + Date.now();
    await A.page.getByRole('button', { name: 'Read-once' }).click();
    await A.page.locator('.chat-textarea').fill(roMsg);
    await A.page.getByRole('button', { name: 'Send' }).click();

    // B 一显示即自动 markRead → 双方焚毁（等动画结束）
    await B.page.waitForTimeout(3000);
    const bRoTextGone = (await B.page.locator('.message-wrapper', { hasText: roMsg }).count()) === 0;
    check('B 侧 Read-once 显示后即焚毁（原文消失）', bRoTextGone);

    await B.page.waitForTimeout(1500);
    const aRoTextGone = (await A.page.locator('.message-wrapper', { hasText: roMsg }).count()) === 0;
    check('A 侧 Read-once 同步焚毁（原文不可见）', aRoTextGone);
    await B.page.screenshot({ path: path.join(OUT, 'readonce-burned.png') });

    console.log(`\n==== 结果：${passed} passed, ${failed} failed ====`);
    console.log('A errors:', A.errors.filter((e) => !e.includes('favicon')).slice(0, 4));
    console.log('B errors:', B.errors.filter((e) => !e.includes('favicon')).slice(0, 4));
    process.exit(failed > 0 ? 1 : 0);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
