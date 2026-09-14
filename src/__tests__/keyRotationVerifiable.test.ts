/**
 * 可验证密钥轮换（签名衔接协议，ADR-007）单元测试
 *
 * 协议要点：
 * - rotateKeysVerifiable()：生成新钥对，用「旧签名私钥」对「新公钥材料」签名，
 *   持久化新身份后经 onKeyRotation 回调广播 KeyRotationNotice。
 * - handleKeyRotation()：对端用已固定的旧签名公钥验签；通过才 re-pin + 更新公钥 +
 *   迁移已验证记录；失败/伪造一律拒绝，不更新任何状态。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateKeyPair,
  exportPublicKey,
  clearAllSharedKeys,
} from '../security/e2ee'
import {
  generateSignKeyPair,
  exportSignPublicKey,
  signMessage,
  importPeerSignPublicKey,
  verifySignature,
} from '../security/sign'

// mock db：身份持久化在这些单元测试里不需要真写 IndexedDB
vi.mock('../persistence/db', () => ({
  saveIdentity: vi.fn(async () => {}),
  loadIdentity: vi.fn(async () => undefined),
  clearAllData: vi.fn(async () => {}),
}))

/** 用一个全新管理器实例（单例 + resetModules 保证隔离） */
async function freshManagers() {
  vi.resetModules()
  const { e2eeManager, securityManager } = await import('../security')
  await securityManager.setupPassword('test-password-123')
  await e2eeManager.init()
  await e2eeManager.loadIdentity()
  return { e2eeManager }
}

type E2eeManagerLike = Awaited<ReturnType<typeof freshManagers>>['e2eeManager']

describe('可验证密钥轮换（ADR-007）', () => {
  const memoryStore: Record<string, string> = {}

  beforeEach(() => {
    clearAllSharedKeys()
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
  })

  afterEach(() => {
    clearAllSharedKeys()
    vi.unstubAllGlobals()
  })

  // ------------------------------------------------------------------
  // 发起端：rotateKeysVerifiable
  // ------------------------------------------------------------------

  it('轮换生成有效证明：新公钥≠旧公钥，签名可用旧签名公钥验证', async () => {
    const { e2eeManager } = await freshManagers()
    const oldEnc = e2eeManager.getOwnPublicKey()!
    const oldSign = e2eeManager.getOwnSignPublicKey()!

    let notice: Parameters<typeof e2eeManager.onKeyRotation>[0] extends (
      n: infer T,
    ) => void
      ? T
      : never = null
    e2eeManager.onKeyRotation((n) => {
      notice = n
    })
    const result = await e2eeManager.rotateKeysVerifiable()

    expect(result).not.toBeNull()
    expect(notice).toEqual(result)
    expect(e2eeManager.getOwnPublicKey()).not.toBe(oldEnc)
    expect(e2eeManager.getOwnSignPublicKey()).not.toBe(oldSign)

    const body = JSON.parse(result!.proof) as {
      v: number
      oldSignPub: string
      newEncPub: string
      newSignPub: string
      rotatedAt: number
    }
    expect(body.v).toBe(1)
    expect(body.oldSignPub).toBe(oldSign)
    expect(body.newEncPub).toBe(e2eeManager.getOwnPublicKey())
    expect(body.newSignPub).toBe(e2eeManager.getOwnSignPublicKey())
    expect(typeof body.rotatedAt).toBe('number')

    // 用旧签名公钥验签必须通过
    const oldSignKey = await importPeerSignPublicKey(oldSign)
    const ok = await verifySignature(result!.proof, result!.signature, oldSignKey)
    expect(ok).toBe(true)
  })

  it('轮换后新身份被持久化（saveIdentity 被调用）', async () => {
    vi.resetModules()
    const { saveIdentity } = await import('../persistence/db')
    const { e2eeManager, securityManager } = await import('../security')
    await securityManager.setupPassword('test-password-123')
    await e2eeManager.init()
    await e2eeManager.loadIdentity()

    const before = (saveIdentity as unknown as ReturnType<typeof vi.fn>).mock.calls
      .length
    await e2eeManager.rotateKeysVerifiable()
    const after = (saveIdentity as unknown as ReturnType<typeof vi.fn>).mock.calls
      .length
    expect(after).toBe(before + 1)
  })

  it('身份未加载时轮换返回 null', async () => {
    vi.resetModules()
    const { e2eeManager, securityManager } = await import('../security')
    await securityManager.setupPassword('test-password-123')
    await e2eeManager.init()
    // 不调用 loadIdentity() → 无密钥对
    const result = await e2eeManager.rotateKeysVerifiable()
    expect(result).toBeNull()
  })

  // ------------------------------------------------------------------
  // 对端：handleKeyRotation
  // ------------------------------------------------------------------

  /** 建立「本端已固定某对端旧公钥」+ 已核对 的状态，返回该对端信息 */
  async function pinPeerWithVerification(
    e2eeManager: E2eeManagerLike,
  ) {
    const peerId = 'peer-rot'
    const peerOldEnc = await generateKeyPair()
    const peerOldSign = await generateSignKeyPair()
    const peerOldEncPub = await exportPublicKey(peerOldEnc)
    const peerOldSignPub = await exportSignPublicKey(peerOldSign)

    const status = await e2eeManager.handlePeerPublicKey(
      peerId,
      peerOldEncPub,
      peerOldSignPub,
    )
    expect(status).toBe('new')
    await e2eeManager.markPeerVerified(peerId)
    return { peerId, peerOldEncPub, peerOldSignPub, peerOldSign }
  }

  /** 模拟对端轮换：用旧签名私钥签「新公钥材料」 */
  async function buildRotationNotice(
    oldSignPub: string,
    oldSignKey: CryptoKey,
  ) {
    const peerNewEnc = await generateKeyPair()
    const peerNewSign = await generateSignKeyPair()
    const newEncPub = await exportPublicKey(peerNewEnc)
    const newSignPub = await exportSignPublicKey(peerNewSign)
    const body = JSON.stringify({
      v: 1,
      oldSignPub,
      newEncPub,
      newSignPub,
      rotatedAt: Date.now(),
    })
    const signature = await signMessage(body, oldSignKey)
    return { body, signature, newEncPub, newSignPub }
  }

  it('验签通过：accepted，公钥更新 + TOFU re-pin + verified 迁移为 changed', async () => {
    const { e2eeManager } = await freshManagers()
    const { peerId, peerOldEncPub, peerOldSignPub, peerOldSign } =
      await pinPeerWithVerification(e2eeManager)

    const notice = await buildRotationNotice(peerOldSignPub, peerOldSign.privateKey)

    const result = await e2eeManager.handleKeyRotation(peerId, {
      proof: notice.body,
      signature: notice.signature,
    })
    expect(result).toBe('accepted')

    // 对端公钥已更新
    const keys = e2eeManager.getPeerIdentityKeys(peerId)!
    expect(keys.encPub).toBe(notice.newEncPub)
    expect(keys.signPub).toBe(notice.newSignPub)
    expect(keys.encPub).not.toBe(peerOldEncPub)

    // verified 迁移：指纹变化 → 'changed'（UI 提示重新核对，不静默通过）
    const vs = await e2eeManager.getVerificationState(peerId)
    expect(vs).toBe('changed')

    // TOFU re-pin：新公钥再走 handlePeerPublicKey 应返回 trusted
    const again = await e2eeManager.handlePeerPublicKey(
      peerId,
      notice.newEncPub,
      notice.newSignPub,
    )
    expect(again).toBe('trusted')
  })

  it('验签失败（篡改证明）：rejected，公钥保持不变', async () => {
    const { e2eeManager } = await freshManagers()
    const { peerId, peerOldEncPub, peerOldSignPub, peerOldSign } =
      await pinPeerWithVerification(e2eeManager)

    const notice = await buildRotationNotice(peerOldSignPub, peerOldSign.privateKey)

    // 篡改：证明里的 newEncPub 被换成别的东西，但签名不变 → 验签必失败
    const tampered = JSON.stringify({
      ...JSON.parse(notice.body),
      newEncPub: 'tampered-public-key',
    })

    const result = await e2eeManager.handleKeyRotation(peerId, {
      proof: tampered,
      signature: notice.signature,
    })
    expect(result).toBe('rejected')

    // 公钥未变
    const keys = e2eeManager.getPeerIdentityKeys(peerId)!
    expect(keys.encPub).toBe(peerOldEncPub)
  })

  it('oldSignPub 与本端固定旧钥不符：rejected（防伪造来源）', async () => {
    const { e2eeManager } = await freshManagers()
    const { peerId, peerOldEncPub } =
      await pinPeerWithVerification(e2eeManager)

    // 用「别的身份」的旧签名钥签发，且 oldSignPub 字段填成不匹配的值
    const strangerSign = await generateSignKeyPair()
    const strangerSignPub = await exportSignPublicKey(strangerSign)
    const notice = await buildRotationNotice(strangerSignPub, strangerSign.privateKey)

    const result = await e2eeManager.handleKeyRotation(peerId, {
      proof: notice.body,
      signature: notice.signature,
    })
    expect(result).toBe('rejected')
    const keys = e2eeManager.getPeerIdentityKeys(peerId)!
    expect(keys.encPub).toBe(peerOldEncPub)
  })

  it('证明格式非法：rejected', async () => {
    const { e2eeManager } = await freshManagers()
    const { peerId } = await pinPeerWithVerification(e2eeManager)

    const r1 = await e2eeManager.handleKeyRotation(peerId, {
      proof: 'not-json',
      signature: 'x',
    })
    expect(r1).toBe('rejected')

    const r2 = await e2eeManager.handleKeyRotation(peerId, {
      proof: JSON.stringify({ v: 999, newEncPub: 'a', newSignPub: 'b', oldSignPub: 'c' }),
      signature: 'x',
    })
    expect(r2).toBe('rejected')
  })

  it('无已固定的旧钥（首次交换场景）：no-peer-key', async () => {
    const { e2eeManager } = await freshManagers()
    const result = await e2eeManager.handleKeyRotation('stranger', {
      proof: '{}',
      signature: 'x',
    })
    expect(result).toBe('no-peer-key')
  })

  it('重复广播（新公钥与当前一致）：ignored', async () => {
    const { e2eeManager } = await freshManagers()
    const { peerId, peerOldSignPub, peerOldSign } =
      await pinPeerWithVerification(e2eeManager)

    const notice = await buildRotationNotice(peerOldSignPub, peerOldSign.privateKey)
    const payload = { proof: notice.body, signature: notice.signature }

    expect(await e2eeManager.handleKeyRotation(peerId, payload)).toBe('accepted')
    // 同一 notice 再发一次：newEncPub === 当前 → ignored
    expect(await e2eeManager.handleKeyRotation(peerId, payload)).toBe('ignored')
  })
})
