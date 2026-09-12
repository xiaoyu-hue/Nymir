/**
 * 带外身份核对（安全码指纹 + verified store）测试
 *
 * 覆盖：
 * - handlePeerPublicKey 后，对方公钥字符串可被读取（供指纹计算）
 * - 未核对 / 已核对 / 指纹变化 三态
 * - removePeerKey 不遗忘 verified 记录（peerId 临时掉线不应让用户重新核对）
 * - unverifyPeer 主动清除
 * - 签名公钥缺失时不崩溃
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateKeyPair, exportPublicKey } from '../security/e2ee'
import { generateSignKeyPair, exportSignPublicKey } from '../security/sign'

// mock db：身份持久化在这些单元测试里不需要真写 IndexedDB
vi.mock('../persistence/db', () => ({
  saveIdentity: vi.fn(async () => {}),
  loadIdentity: vi.fn(async () => undefined),
  clearAllData: vi.fn(async () => {}),
}))

const memoryStore: Record<string, string> = {}

async function freshManager() {
  vi.resetModules()
  // 每次重新 stub localStorage
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memoryStore[key] ?? null,
    setItem: (key: string, value: string) => { memoryStore[key] = value },
    removeItem: (key: string) => { delete memoryStore[key] },
    clear: () => { Object.keys(memoryStore).forEach((k) => delete memoryStore[k]) },
    key: () => null,
    length: 0,
  })
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  })
  const mod = await import('../security')
  const { e2eeManager, securityManager } = mod
  await e2eeManager.init()
  // 模拟首次使用：设密码解锁，再生成/加载身份
  await securityManager.setupPassword('test-password-123')
  await e2eeManager.loadIdentity()
  return e2eeManager
}

async function makePeerKeys() {
  const enc = await generateKeyPair()
  const sign = await generateSignKeyPair()
  return {
    encPub: await exportPublicKey(enc),
    signPub: await exportSignPublicKey(sign),
  }
}

describe('带外身份核对（verified store）', () => {
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('handlePeerPublicKey 后，对方公钥字符串可被读取', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    const status = await m.handlePeerPublicKey('peer-A', peer.encPub, peer.signPub)
    expect(status).toBe('new')

    const id = m.getPeerIdentityKeys('peer-A')
    expect(id).toEqual(peer)
  })

  it('未核对时 getVerificationState 为 unverified', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-B', peer.encPub, peer.signPub)
    expect(await m.getVerificationState('peer-B')).toBe('unverified')
  })

  it('markPeerVerified 后状态变为 verified，且指纹非空', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-C', peer.encPub, peer.signPub)

    const fp = await m.computePeerFingerprint('peer-C')
    expect(fp).not.toBeNull()
    expect(fp!.decimal).toMatch(/^\d{5} \d{5} \d{5}$/)

    await m.markPeerVerified('peer-C')
    expect(await m.getVerificationState('peer-C')).toBe('verified')
  })

  it('同一对身份，双方各自算出来的指纹 decimal 一致', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-D', peer.encPub, peer.signPub)

    const own = m.getOwnIdentityKeys()!
    const peerKeys = m.getPeerIdentityKeys('peer-D')!

    // A 侧视角：own 是自己，peerKeys 是对方
    const fpFromSelf = await m.computePeerFingerprint('peer-D')
    // B 侧视角：把对方和自己对调（用纯函数直接验证排序无关性）
    const { buildFingerprint } = await import('../security/fingerprint')
    const fpFromPeer = await buildFingerprint(peerKeys, own)
    expect(fpFromSelf!.decimal).toBe(fpFromPeer.decimal)
  })

  it('removePeerKey 后字符串被清，但 verified 记录保留', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-E', peer.encPub, peer.signPub)
    await m.markPeerVerified('peer-E')
    expect(await m.getVerificationState('peer-E')).toBe('verified')

    // peerId 临时掉线
    m.removePeerKey('peer-E')
    expect(m.getPeerIdentityKeys('peer-E')).toBeNull()

    // 重新建立公钥交换（同样的公钥字符串）
    await m.handlePeerPublicKey('peer-E', peer.encPub, peer.signPub)
    expect(m.getPeerIdentityKeys('peer-E')).not.toBeNull()
    // verified 不应被遗忘
    expect(await m.getVerificationState('peer-E')).toBe('verified')
  })

  it('自己 rotateKeys 后指纹变化，状态落到 changed', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-F', peer.encPub, peer.signPub)
    await m.markPeerVerified('peer-F')
    expect(await m.getVerificationState('peer-F')).toBe('verified')

    // 模拟自己换设备 / 重装：重新生成自己的密钥对
    await m.rotateKeys()

    // 对方公钥没变（TOFU 仍放行），但自己公钥变了 → 指纹不同
    expect(await m.getVerificationState('peer-F')).toBe('changed')
  })

  it('unverifyPeer 后回到 unverified', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-G', peer.encPub, peer.signPub)
    await m.markPeerVerified('peer-G')
    expect(await m.getVerificationState('peer-G')).toBe('verified')

    m.unverifyPeer('peer-G')
    expect(await m.getVerificationState('peer-G')).toBe('unverified')
  })

  it('签名公钥缺失时 getPeerIdentityKeys 返回 null', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    // 不传 signPublicKey
    await m.handlePeerPublicKey('peer-H', peer.encPub)
    expect(m.getPeerIdentityKeys('peer-H')).toBeNull()
    expect(await m.computePeerFingerprint('peer-H')).toBeNull()
    expect(await m.getVerificationState('peer-H')).toBe('unverified')
  })

  it('verified 记录持久化到 localStorage', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-I', peer.encPub, peer.signPub)
    await m.markPeerVerified('peer-I')

    // 应当写入 nymir_verified
    expect(memoryStore['nymir_verified']).toBeTruthy()
  })

  it('clearAll() 清空对方公钥字符串，但保留 verified 记录', async () => {
    const m = await freshManager()
    const peer = await makePeerKeys()
    await m.handlePeerPublicKey('peer-J', peer.encPub, peer.signPub)
    await m.markPeerVerified('peer-J')
    expect(m.getPeerIdentityKeys('peer-J')).not.toBeNull()

    m.clearAll()

    // 字符串 Map 被清
    expect(m.getPeerIdentityKeys('peer-J')).toBeNull()
    // verified 记录仍在（离开房间不应遗忘上次核对）
    expect(memoryStore['nymir_verified']).toBeTruthy()
  })
})
