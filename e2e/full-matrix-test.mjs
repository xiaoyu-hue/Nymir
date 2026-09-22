/* e2e/full-matrix-test.mjs - Nymir 全矩阵验收
 * 中/英 × 桌面/手机 × 双端联调 + 阅读即焚（桌面场景）
 * 用法：先 npm run build && npm run preview（另开终端），再 node e2e/full-matrix-test.mjs
 * 截图输出到 test-results/matrix/
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://127.0.0.1:4173'
const PASS = process.env.NYMIR_E2E_PASSWORD || 'matrix-pass-2026'
const OUT = path.resolve(__dirname, '..', 'test-results', 'matrix')
mkdirSync(OUT, { recursive: true })

let passed = 0, failed = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${extra ? ' — ' + extra : ''}`)
  ok ? passed++ : failed++
}

async function setupDevice(browser, { locale, viewport, isMobile, ui, tag }) {
  const context = await browser.newContext({
    locale,
    viewport,
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 3 : 1,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  await page.goto(BASE)
  await page.locator('.lock-input').nth(0).waitFor({ timeout: 30000 })
  await page.locator('.lock-input').nth(0).fill(PASS)
  await page.locator('.lock-input').nth(1).fill(PASS)
  await page.getByRole('button', { name: ui.setup }).click()
  await page.locator('.room-panel-input-name').waitFor({ timeout: 30000 })
  return { context, page, errors }
}

async function runScenario(browser, { name, locale, viewport, isMobile, ui, doBurn }) {
  console.log(`\n===== ${name} (${locale} · ${isMobile ? '手机' : '桌面'}) =====`)
  const A = await setupDevice(browser, { locale, viewport, isMobile, ui, tag: 'A' })
  // A 创建房间
  await A.page.locator('.room-panel-input-name').fill(`Matrix ${name}`)
  await A.page.getByRole('button', { name: ui.createBtn }).click()
  await A.page.locator('.chat-view').waitFor({ timeout: 30000 })
  const code = (await A.page.locator('.room-code-value').textContent()).trim()
  check('A 创建房间（房间码 ' + code + '）', code.length >= 6)

  // B 加入
  const B = await setupDevice(browser, { locale, viewport, isMobile, ui, tag: 'B' })
  await B.page.getByRole('tab', { name: ui.joinTab }).click()
  await B.page.locator('.room-panel-input-code').fill(code)
  await B.page.getByRole('button', { name: ui.joinBtn }).click()
  await B.page.locator('.chat-view').waitFor({ timeout: 30000 })
  check('B 加入房间', true)

  // UI 语言断言
  const aPlaceholder = await A.page.locator('.chat-textarea').getAttribute('placeholder')
  check('A 界面语言 = ' + ui.lang, aPlaceholder === ui.placeholder)

  // 等在线
  let connected = false
  for (let i = 0; i < 18; i++) {
    await A.page.waitForTimeout(4000)
    const aS = (await A.page.locator('.chat-status-text').textContent()) || ''
    const bS = (await B.page.locator('.chat-status-text').textContent()) || ''
    if (aS.includes(ui.online) && bS.includes(ui.online)) { connected = true; break }
  }
  check('双端在线（P2P 建立）', connected)

  // 双向消息
  const msgA = 'from-A-' + name + '-' + Date.now()
  await A.page.locator('.chat-textarea').fill(msgA)
  await A.page.getByRole('button', { name: ui.send }).click()
  let a2b = true
  try { await B.page.locator('.message-wrapper.other .message-content-box', { hasText: msgA }).waitFor({ timeout: 20000 }) } catch { a2b = false }
  check('A → B 消息送达', a2b)

  const msgB = 'from-B-' + name + '-' + Date.now()
  await B.page.locator('.chat-textarea').fill(msgB)
  await B.page.getByRole('button', { name: ui.send }).click()
  let b2a = true
  try { await A.page.locator('.message-wrapper.other .message-content-box', { hasText: msgB }).waitFor({ timeout: 20000 }) } catch { b2a = false }
  check('B → A 消息送达', b2a)

  await B.page.waitForFunction(() => document.querySelectorAll('.message-wrapper').length >= 2, null, { timeout: 10000 }).catch(() => {})
  await A.page.waitForFunction(() => document.querySelectorAll('.message-wrapper').length >= 2, null, { timeout: 10000 }).catch(() => {})
  const aCount = await A.page.locator('.message-wrapper').count()
  const bCount = await B.page.locator('.message-wrapper').count()
  check('消息列表完整（A:' + aCount + ' B:' + bCount + '）', aCount >= 2 && bCount >= 2)

  await A.page.screenshot({ path: path.join(OUT, name + '-chat.png') })

  // 阅读即焚（桌面场景）
  if (doBurn) {
    // Timed 10s
    const timedMsg = 'burn-timed-' + name + '-' + Date.now()
    await A.page.getByRole('button', { name: ui.timed }).click()
    await A.page.locator('.burn-timer-select').selectOption('10')
    await A.page.locator('.chat-textarea').fill(timedMsg)
    await A.page.getByRole('button', { name: ui.send }).click()
    let timedVisible = true
    try { await B.page.locator('.message-wrapper.other .message-content-box', { hasText: timedMsg }).waitFor({ timeout: 20000 }) } catch { timedVisible = false }
    check('Timed 明文可见（焚毁前）', timedVisible)
    await A.page.waitForTimeout(15000)
    const aGone = (await A.page.locator('.message-wrapper', { hasText: timedMsg }).count()) === 0
    const bGone = (await B.page.locator('.message-wrapper', { hasText: timedMsg }).count()) === 0
    check('Timed 10s 双方焚毁', aGone && bGone)

    // Read-once
    const roMsg = 'burn-readonce-' + name + '-' + Date.now()
    await A.page.getByRole('button', { name: ui.readOnce }).click()
    await A.page.locator('.chat-textarea').fill(roMsg)
    await A.page.getByRole('button', { name: ui.send }).click()
    await B.page.waitForTimeout(3000)
    const bRoGone = (await B.page.locator('.message-wrapper', { hasText: roMsg }).count()) === 0
    check('Read-once B 侧即焚', bRoGone)
    await B.page.waitForTimeout(2000)
    const aRoGone = (await A.page.locator('.message-wrapper', { hasText: roMsg }).count()) === 0
    check('Read-once A 侧同步焚毁', aRoGone)
    await B.page.screenshot({ path: path.join(OUT, name + '-burn.png') })
  }

  const errs = [...A.errors, ...B.errors].filter((e) => !e.includes('favicon') && !e.includes('test.mosquitto'))
  if (errs.length > 0) console.log('  ⚠️ console 错误:', errs.slice(0, 3))
  await A.context.close()
  await B.context.close()
}

const scenarios = [
  { name: 'CN-desktop', locale: 'zh-CN', viewport: { width: 1280, height: 800 }, isMobile: false, doBurn: true, ui: {
    lang: '中文', setup: '设置密码', createBtn: '创建房间', joinTab: '加入', joinBtn: '加入房间', send: '发送',
    online: '在线', placeholder: '说点什么...', timed: '定时', readOnce: '阅后即焚',
  } },
  { name: 'EN-desktop', locale: 'en-US', viewport: { width: 1280, height: 800 }, isMobile: false, doBurn: true, ui: {
    lang: '英文', setup: 'Set Password', createBtn: 'Create Room', joinTab: 'Join', joinBtn: 'Join Room', send: 'Send',
    online: 'online', placeholder: 'Say something...', timed: 'Timed', readOnce: 'Read-once',
  } },
  { name: 'CN-mobile', locale: 'zh-CN', viewport: { width: 390, height: 844 }, isMobile: true, doBurn: false, ui: {
    lang: '中文', setup: '设置密码', createBtn: '创建房间', joinTab: '加入', joinBtn: '加入房间', send: '发送',
    online: '在线', placeholder: '说点什么...', timed: '定时', readOnce: '阅后即焚',
  } },
  { name: 'EN-mobile', locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, doBurn: false, ui: {
    lang: '英文', setup: 'Set Password', createBtn: 'Create Room', joinTab: 'Join', joinBtn: 'Join Room', send: 'Send',
    online: 'online', placeholder: 'Say something...', timed: 'Timed', readOnce: 'Read-once',
  } },
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const s of scenarios) {
      try {
        await runScenario(browser, s)
      } catch (e) {
        console.log(`  ❌ 场景异常: ${e.message}`)
        failed++
      }
    }
    console.log(`\n========== 全矩阵结果：${passed} passed / ${failed} failed ==========`)
    process.exit(failed > 0 ? 1 : 0)
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
