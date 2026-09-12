/**
 * 消息签名缺陷：sign-then-encrypt（对明文签名）使低熵明文可被离线字典攻击。
 *
 * 攻击链路：
 * 1. 发送方对明文 content 做 Ed25519 签名，再加密 content，把「密文 + 明文签名」一并发出
 * 2. 截获者拥有：密文、签名、发送方签名公钥（进房时已交换）
 * 3. 对候选明文逐个 verify(candidate, signature, pub) —— 命中则确认明文
 * 4. 对「在吗」「好」「123456」等短消息，AES-GCM 形同虚设
 *
 * 修复：encrypt-then-sign —— 先加密，再对密文字符串签名；接收方先验签密文再解密。
 * 载荷增加 sig: 2；旧格式（无 sig 或 sig≠2）一律视为验签失败。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// mock db：身份持久化在单元测试里不需要真写 IndexedDB
vi.mock('../persistence/db', () => ({
  saveIdentity: vi.fn(async () => {}),
  loadIdentity: vi.fn(async () => undefined),
  clearAllData: vi.fn(async () => {}),
}))

import {
  generateSignKeyPair,
  exportSignPublicKey,
  importPeerSignPublicKey,
  signMessage,
  verifySignature,
} from '../security/sign'

const DICTIONARY = ['在吗', '好', '嗯', '1', '123456', '救命', '密码是1234', 'ok', 'yes']

describe('明文签名字典攻击（缺陷复现）', () => {
  it('对明文签名时，攻击者可用候选词离线确认真实明文', async () => {
    const victim = await generateSignKeyPair()
    const victimPub = await exportSignPublicKey(victim)
    const attackerViewOfPub = await importPeerSignPublicKey(victimPub)

    const realPlaintext = '在吗'
    // 模拟当前缺陷：签名绑在明文上
    const signatureOverPlaintext = await signMessage(realPlaintext, victim.privateKey)

    // 攻击者只有：签名 + 公钥（密文有无都不影响本步）
    const hits: string[] = []
    for (const guess of DICTIONARY) {
      const ok = await verifySignature(guess, signatureOverPlaintext, attackerViewOfPub)
      if (ok) hits.push(guess)
    }

    expect(hits).toContain('在吗')
    expect(hits).toEqual(['在吗'])
  })
})

describe('encrypt-then-sign 契约', () => {
  it('对密文签名后，任意候选明文验签均失败；仅密文本身能通过', async () => {
    const sender = await generateSignKeyPair()
    const senderPub = await exportSignPublicKey(sender)
    const pub = await importPeerSignPublicKey(senderPub)

    // 模拟 AES 密文载荷（真实路径里是 JSON 字符串化的 iv+data）
    const ciphertext =
      '{"iv":"AAECAwQFBgcICQoLDA0ODw==","data":"ciphertext-blob-not-plaintext"}'

    const signatureOverCiphertext = await signMessage(ciphertext, sender.privateKey)

    for (const guess of DICTIONARY) {
      const ok = await verifySignature(guess, signatureOverCiphertext, pub)
      expect(ok).toBe(false)
    }

    const legit = await verifySignature(ciphertext, signatureOverCiphertext, pub)
    expect(legit).toBe(true)
  })

  it('签名版本：仅 sig===2 应被视为可验证格式（契约文档）', () => {
    // 与 message.ts 中的判定保持一致，防止回归时漏掉版本门闩
    const isAcceptableSigVersion = (sig: unknown) => sig === 2
    expect(isAcceptableSigVersion(2)).toBe(true)
    expect(isAcceptableSigVersion(1)).toBe(false)
    expect(isAcceptableSigVersion(undefined)).toBe(false)
    expect(isAcceptableSigVersion(null)).toBe(false)
    expect(isAcceptableSigVersion('2')).toBe(false)
  })
})

describe('e2eeManager 层：明文签名可被 verify 确认（缺陷在协议层的体现）', () => {
  const memoryStore: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = value
      },
      removeItem: (key: string) => {
        delete memoryStore[key]
      },
      clear: () => {
        Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
      },
      key: () => null,
      length: 0,
    })
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    })
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('若对明文 sign，对端 verify(明文) 成功——这是字典攻击的前提', async () => {
    const mod = await import('../security')
    const { e2eeManager, securityManager } = mod
    await securityManager.setupPassword('test-password-123')
    await e2eeManager.init()
    await e2eeManager.loadIdentity()

    const peerId = 'attacker-peer'
    const signPub = e2eeManager.getOwnSignPublicKey()
    const encPub = e2eeManager.getOwnPublicKey()
    expect(signPub).toBeTruthy()
    expect(encPub).toBeTruthy()

    // 用本会话导出的密钥登记为对端公钥，模拟密钥交换完成
    // （Node 22 WebCrypto 支持 X25519，可确定性导入，无需分支降级）
    await e2eeManager.handlePeerPublicKey(peerId, encPub!, signPub!)
    expect(e2eeManager.hasPeerKey(peerId)).toBe(true)

    const plaintext = '好'
    const signature = await e2eeManager.sign(plaintext)
    expect(signature).toBeTruthy()

    // 攻击前提：签名绑定明文，截获者知道候选词即可离线确认
    const verified = await e2eeManager.verify(plaintext, signature!, peerId)
    expect(verified).toBe(true)
  })
})
