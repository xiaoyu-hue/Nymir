/* e2e/dual-device.mjs - 双端联调（模拟两台设备）
 * A：设置密码 → 创建房间 → 拿房间码
 * B：设置密码 → 加入 A 的房间
 * 断言：双方在线状态、A→B 消息、B→A 消息
 * 用法：node e2e/dual-device.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const PASS = 'dual-pass-2026';

async function setupDevice(browser, tag) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE);
  // 首次访问设置密码
  await page.locator('.lock-input').nth(0).waitFor({ timeout: 30000 });
  await page.locator('.lock-input').nth(0).fill(PASS);
  await page.locator('.lock-input').nth(1).fill(PASS);
  await page.getByRole('button', { name: 'Set Password' }).click();
  await page.locator('.room-panel-input-name').waitFor({ timeout: 30000 });
  console.log(`[${tag}] device ready (password set)`);
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
    const code = await A.page.locator('.room-code-value').textContent();
    console.log(`[A] room created, code = ${code}`);

    // ---- B 加入房间 ----
    const B = await setupDevice(browser, 'B');
    await B.page.getByRole('tab', { name: 'Join' }).click();
    await B.page.locator('.room-panel-input-code').fill(code.trim());
    await B.page.getByRole('button', { name: 'Join Room' }).click();
    await B.page.locator('.chat-view').waitFor({ timeout: 30000 });
    console.log(`[B] joined room ${code.trim()}`);

    // ---- 等双方在线（最多 90s）----
    let connected = false;
    for (let i = 0; i < 18; i++) {
      await A.page.waitForTimeout(5000);
      const aStatus = await A.page.locator('.chat-status-text').textContent();
      const bStatus = await B.page.locator('.chat-status-text').textContent();
      console.log(`[wait ${(i + 1) * 5}s] A status="${aStatus}" | B status="${bStatus}"`);
      if (aStatus.includes('online') && bStatus.includes('online')) { connected = true; break; }
    }
    if (!connected) {
      console.log('FAIL: peers never connected');
      console.log('A errors:', A.errors.filter((e) => !e.includes('favicon')).slice(0, 5));
      console.log('B errors:', B.errors.filter((e) => !e.includes('favicon')).slice(0, 5));
      process.exit(1);
    }
    console.log('PASS: both devices online');

    // ---- A 发消息 → B 收到 ----
    const msgA = 'hello from A ' + Date.now();
    await A.page.locator('.chat-textarea').fill(msgA);
    await A.page.getByRole('button', { name: 'Send' }).click();
    await B.page.locator('.message-wrapper.other .message-content-box', { hasText: msgA })
      .waitFor({ timeout: 20000 });
    console.log('PASS: A->B message delivered:', msgA);

    // ---- B 回复 → A 收到 ----
    const msgB = 'hello from B ' + Date.now();
    await B.page.locator('.chat-textarea').fill(msgB);
    await B.page.getByRole('button', { name: 'Send' }).click();
    await A.page.locator('.message-wrapper.other .message-content-box', { hasText: msgB })
      .waitFor({ timeout: 20000 });
    console.log('PASS: B->A message delivered:', msgB);

    // ---- 双方消息列表各自包含两条 ----
    const aCount = await A.page.locator('.message-wrapper').count();
    const bCount = await B.page.locator('.message-wrapper').count();
    console.log(`A message count: ${aCount}, B message count: ${bCount}`);
    if (aCount < 2 || bCount < 2) { console.log('FAIL: message lists incomplete'); process.exit(1); }

    console.log('\n✅ ALL PASS: Nymir 双端联调成功');
    console.log('A errors:', A.errors.filter((e) => !e.includes('favicon')));
    console.log('B errors:', B.errors.filter((e) => !e.includes('favicon')));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
