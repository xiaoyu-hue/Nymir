/* e2e/nostr-browser-test.mjs - 浏览器内 Nostr 建连验证（Playwright 两页面）
 * 用法：node e2e/nostr-browser-test.mjs
 */
import { chromium } from '@playwright/test'

const DEV = 'http://127.0.0.1:5173/dev-nostr.html'

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    const logs = { A: [], B: [] }
    pageA.on('console', (m) => logs.A.push(m.text()))
    pageB.on('console', (m) => logs.B.push(m.text()))

    await pageA.goto(DEV + '?role=A')
    await pageB.goto(DEV + '?role=B')

    // 等 40s：建连 + 消息
    await pageA.waitForTimeout(40000)
    const aLog = (await pageA.locator('#log').textContent()) || ''
    const bLog = (await pageB.locator('#log').textContent()) || ''
    console.log('--- A log ---\n' + aLog)
    console.log('--- B log ---\n' + bLog)
    const ok =
      /peer joined via nostr/.test(aLog) &&
      /peer joined via nostr/.test(bLog) &&
      /B received via nostr: hello-over-nostr/.test(bLog)
    console.log(ok ? '\n✅ NOSTR BROWSER TEST PASS' : '\n❌ NOSTR BROWSER TEST FAIL')
    process.exit(ok ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
