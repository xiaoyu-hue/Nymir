/**
 * Nymir 端到端加密管理器
 * 
 * 职责：
 * - 管理 E2EE 密钥对
 * - 管理签名密钥对
 * - 协调密钥交换
 * - 提供加密/解密/签名/验证接口
 */

import {
  generateKeyPair,
  exportPublicKey,
  importPeerPublicKey,
  exportKeyPair,
  importKeyPair,
  encryptMessage,
  decryptMessage,
  clearSharedKey,
  clearAllSharedKeys,
  type KeyPair,
} from './e2ee'

import {
  generateSignKeyPair,
  exportSignPublicKey,
  importPeerSignPublicKey,
  exportSignKeyPair,
  importSignKeyPair,
  signMessage,
  verifySignature,
  type SignKeyPair,
} from './sign'

import {
  buildFingerprint,
  type IdentityKeys,
  type Fingerprint,
} from './fingerprint'

import { log, error } from '../utils/logger'
import { uint8ToBase64 } from '../utils/base64'
import { saveIdentity, loadIdentity } from '../persistence/db'
import { securityManager } from './manager'

export type E2EEStatus = 'initializing' | 'ready' | 'error'

export type TOFUStatus = 'trusted' | 'untrusted' | 'new'

/**
 * 带外验证状态：
 * - unverified：从未核对过安全码
 * - verified：当前指纹与上次核对时一致
 * - changed：上次核对过，但当前指纹变了（疑似中间人换钥或对方重装）
 */
export type VerificationState = 'verified' | 'unverified' | 'changed'

// 历史：曾在每 100 条消息时自动 rotateKeys，因无对端通知与 TOFU 衔接已关闭。
const TOFU_STORAGE_KEY = 'nymir_tofu'
// 用户手动核对过的安全码指纹，按 peerId 存当前会话内的钉住值。
const VERIFIED_STORAGE_KEY = 'nymir_verified'

interface VerifiedRecord {
  /** 上次核对时的 decimal 指纹（15 位数字） */
  fingerprint: string
  /** 核对时间戳（ms） */
  verifiedAt: number
}

function loadTOFU(): Map<string, string> {
  try {
    const raw = localStorage.getItem(TOFU_STORAGE_KEY)
    if (!raw) return new Map()
    // 新数据：base64 编码存储；旧数据：明文 JSON，尝试直接解析以兼容
    let jsonStr: string
    try {
      jsonStr = atob(raw)
    } catch {
      jsonStr = raw
    }
    return new Map(Object.entries(JSON.parse(jsonStr)))
  } catch {
    return new Map()
  }
}

function saveTOFU(map: Map<string, string>): void {
  // base64 编码存储，避免明文 JSON（TOFU 数据虽非敏感，但与本地加密理念一致）
  const jsonStr = JSON.stringify(Object.fromEntries(map))
  localStorage.setItem(TOFU_STORAGE_KEY, btoa(jsonStr))
}

function loadVerified(): Map<string, VerifiedRecord> {
  try {
    const raw = localStorage.getItem(VERIFIED_STORAGE_KEY)
    if (!raw) return new Map()
    let jsonStr: string
    try {
      jsonStr = atob(raw)
    } catch {
      jsonStr = raw
    }
    return new Map(Object.entries(JSON.parse(jsonStr)))
  } catch {
    return new Map()
  }
}

function saveVerified(map: Map<string, VerifiedRecord>): void {
  const jsonStr = JSON.stringify(Object.fromEntries(map))
  localStorage.setItem(VERIFIED_STORAGE_KEY, btoa(jsonStr))
}

class E2EEManager {
  private keyPair: KeyPair | null = null
  private signKeyPair: SignKeyPair | null = null
  private peerPublicKeys = new Map<string, CryptoKey>()
  private peerSignPublicKeys = new Map<string, CryptoKey>()
  // 对方公钥的原始 base64 字符串（peerPublicKeys 只存 import 后的 CryptoKey，无法反推原文）
  private peerPublicKeyStrings = new Map<string, string>()
  private peerSignPublicKeyStrings = new Map<string, string>()
  private status: E2EEStatus = 'initializing'
  private _publicKeyString: string | null = null
  private _signPublicKeyString: string | null = null
  private messageCount = 0
  private onKeyRotationCallback: (() => void) | null = null
  private tofuStore = loadTOFU()
  private verifiedStore = loadVerified()

  get currentStatus(): E2EEStatus {
    return this.status
  }

  get publicKeyString(): string | null {
    return this._publicKeyString
  }

  get signPublicKeyString(): string | null {
    return this._signPublicKeyString
  }

  /**
   * 初始化 E2EE 管理器（不生成密钥对）
   * 密钥对在 loadIdentity() 中加载或创建，需在解锁后调用。
   */
  async init(): Promise<void> {
    this.status = 'initializing'
  }

  /**
   * 加载或创建持久化身份密钥。
   * - 解锁后调用：从 IndexedDB 读加密密钥，用锁屏密码解密
   * - 首次使用：生成新密钥对，加密后存 IndexedDB
   *
   * 持久化后，刷新页面身份不变，TOFU/verified 状态长期有效。
   */
  async loadIdentity(): Promise<void> {
    try {
      const stored = await loadIdentity()
      if (stored) {
        // 解密持久化的密钥材料
        const encKeypairJson = await securityManager.decrypt(stored.encKeypair)
        const signKeypairJson = await securityManager.decrypt(stored.signKeypair)
        this.keyPair = await importKeyPair(JSON.parse(encKeypairJson))
        this.signKeyPair = await importSignKeyPair(JSON.parse(signKeypairJson))
      } else {
        // 首次使用：生成新身份
        this.keyPair = await generateKeyPair()
        this.signKeyPair = await generateSignKeyPair()
        // 加密持久化
        const encKeypair = JSON.stringify(await exportKeyPair(this.keyPair))
        const signKeypair = JSON.stringify(await exportSignKeyPair(this.signKeyPair))
        await saveIdentity(
          await securityManager.encrypt(encKeypair),
          await securityManager.encrypt(signKeypair),
        )
      }
      this._publicKeyString = await exportPublicKey(this.keyPair)
      this._signPublicKeyString = await exportSignPublicKey(this.signKeyPair)
      this.status = 'ready'
      log('[E2EE] Identity loaded (persistent)')
    } catch (e) {
      error('[E2EE] loadIdentity failed:', e)
      this.status = 'error'
    }
  }

  /**
   * 获取自己的公钥字符串（用于交换）
   */
  getOwnPublicKey(): string | null {
    return this._publicKeyString
  }

  /**
   * 获取自己的签名公钥字符串（用于交换）
   */
  getOwnSignPublicKey(): string | null {
    return this._signPublicKeyString
  }

  /**
   * 处理接收到的对端公钥（带 TOFU 验证）
   *
   * TOFU key 是对方公钥的 SHA-256 哈希（不是临时 peerId）。
   * 这样刷新页面后 peerId 变了，但只要对方公钥没变，TOFU 仍然有效。
   */
  async handlePeerPublicKey(
    peerId: string,
    publicKeyStr: string,
    signPublicKeyStr?: string,
  ): Promise<TOFUStatus> {
    try {
      // TOFU: 计算公钥哈希并验证
      const encoder = new TextEncoder()
      const keyBytes = encoder.encode(publicKeyStr)
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes)
      const keyHash = uint8ToBase64(new Uint8Array(hashBuffer))

      // 导入对端公钥（按 peerId 存，用于本次会话的消息路由）
      const peerKey = await importPeerPublicKey(publicKeyStr)
      this.peerPublicKeys.set(peerId, peerKey)
      this.peerPublicKeyStrings.set(peerId, publicKeyStr)

      if (signPublicKeyStr) {
        const peerSignKey = await importPeerSignPublicKey(signPublicKeyStr)
        this.peerSignPublicKeys.set(peerId, peerSignKey)
        this.peerSignPublicKeyStrings.set(peerId, signPublicKeyStr)
      }

      // TOFU：按公钥哈希钉住（跨会话持久）
      const pinned = this.tofuStore.has(keyHash)
      if (!pinned) {
        this.tofuStore.set(keyHash, 'pinned')
        saveTOFU(this.tofuStore)
        log('[E2EE] TOFU: Pinned new peer key')
        return 'new'
      }

      log('[E2EE] Received peer keys (TOFU verified)')
      return 'trusted'
    } catch (e) {
      error('[E2EE] Failed to import peer keys:', e)
      return 'untrusted'
    }
  }

  /**
   * 检查是否已与某个 peer 建立 E2EE
   */
  hasPeerKey(peerId: string): boolean {
    return this.peerPublicKeys.has(peerId)
  }

  /**
   * 加密发送给指定 peer 的消息（会话级静态 ECDH + 每消息 HKDF，非强前向保密）
   */
  async encrypt(plaintext: string, peerId: string, messageId: string): Promise<string | null> {
    if (!this.keyPair) return null
    const peerKey = this.peerPublicKeys.get(peerId)
    if (!peerKey) return null

    try {
      const payload = await encryptMessage(
        plaintext,
        peerId,
        this.keyPair.privateKey,
        peerKey,
        messageId,
      )
      return JSON.stringify(payload)
    } catch (e) {
      error('[E2EE] Encrypt failed:', e)
      return null
    }
  }

  /**
   * 解密来自指定 peer 的消息（会话级静态 ECDH + 每消息 HKDF，非强前向保密）
   */
  async decrypt(ciphertext: string, peerId: string, messageId: string): Promise<string | null> {
    if (!this.keyPair) return null
    const peerKey = this.peerPublicKeys.get(peerId)
    if (!peerKey) return null

    try {
      const payload = JSON.parse(ciphertext)
      return await decryptMessage(payload, peerId, this.keyPair.privateKey, peerKey, messageId)
    } catch (e) {
      error('[E2EE] Decrypt failed:', e)
      return null
    }
  }

  /**
   * 签名消息
   */
  async sign(message: string): Promise<string | null> {
    if (!this.signKeyPair) return null
    try {
      return await signMessage(message, this.signKeyPair.privateKey)
    } catch (e) {
      error('[E2EE] Sign failed:', e)
      return null
    }
  }

  /**
   * 验证消息签名
   */
  async verify(
    message: string,
    signature: string,
    peerId: string,
  ): Promise<boolean> {
    const peerSignKey = this.peerSignPublicKeys.get(peerId)
    if (!peerSignKey) return false

    try {
      return await verifySignature(message, signature, peerSignKey)
    } catch (e) {
      error('[E2EE] Verify failed:', e)
      return false
    }
  }

  /**
   * 清除某个 peer 的密钥。
   * 注意：verifiedStore 不在此处清除——用户"已验证"的是身份指纹，
   * 不应因 peerId 临时离开房间就遗忘；若公钥真的变了，
   * getVerificationState 会自动落到 'changed'。
   */
  removePeerKey(peerId: string): void {
    this.peerPublicKeys.delete(peerId)
    this.peerSignPublicKeys.delete(peerId)
    this.peerPublicKeyStrings.delete(peerId)
    this.peerSignPublicKeyStrings.delete(peerId)
    clearSharedKey(peerId)
  }

  /**
   * 清除所有密钥
   */
  clearAll(): void {
    this.peerPublicKeys.clear()
    this.peerSignPublicKeys.clear()
    this.peerPublicKeyStrings.clear()
    this.peerSignPublicKeyStrings.clear()
    clearAllSharedKeys()
  }

  /**
   * 记录消息发送。
   *
   * 注意：自动密钥轮换已禁用（方案 C）。
   * 原因：轮换后未通知对端、TOFU 按临时 peerId 固定且无签名衔接，
   * 会导致长对话从约第 100 条起全部解密失败。
   * messageCount 仍累计，供日后实现可验证轮换时使用。
   * 前向保密现状：会话级静态 ECDH + 每条消息 HKDF(messageId)，
   * 私钥泄露可影响本场已截获密文——不提供强前向保密。
   */
  recordMessageSent(): void {
    this.messageCount++
    // 自动轮换已关闭。勿在此处调用 rotateKeys()。
    // 若重新启用，必须先具备：对端通知 + 旧签名钥衔接 + TOFU re-pin 协议。
  }

  /**
   * 显式轮换密钥对（当前无自动调用）。
   *
   * 警告：调用前必须确保已通过 onKeyRotation 注册“向所有 peer 广播新公钥”
   * 的回调，且对端能验证并 re-pin。否则对端仍持旧公钥，消息将无法解密。
   * 在签名衔接协议就绪之前，生产路径不应调用本方法。
   */
  async rotateKeys(): Promise<void> {
    try {
      this.keyPair = await generateKeyPair()
      this._publicKeyString = await exportPublicKey(this.keyPair)
      this.signKeyPair = await generateSignKeyPair()
      this._signPublicKeyString = await exportSignPublicKey(this.signKeyPair)
      this.messageCount = 0
      clearAllSharedKeys()
      log('[E2EE] Keys rotated')
      this.onKeyRotationCallback?.()
    } catch (e) {
      error('[E2EE] Key rotation failed:', e)
    }
  }

  /**
   * 注册密钥轮换回调（用于通知 peer 新公钥）。
   * 自动轮换关闭期间仍保留接口，供日后可验证轮换使用。
   */
  onKeyRotation(cb: () => void): void {
    this.onKeyRotationCallback = cb
  }

  // ------------------------------------------------------------------
  // 带外身份核对（安全码指纹）
  // ------------------------------------------------------------------

  /**
   * 获取自己的两个身份公钥（供指纹计算）。
   */
  getOwnIdentityKeys(): IdentityKeys | null {
    if (!this._publicKeyString || !this._signPublicKeyString) return null
    return { encPub: this._publicKeyString, signPub: this._signPublicKeyString }
  }

  /**
   * 获取某 peer 的两个身份公钥（供指纹计算）。
   * 若对方尚未交换公钥，或未提供签名公钥，返回 null。
   */
  getPeerIdentityKeys(peerId: string): IdentityKeys | null {
    const enc = this.peerPublicKeyStrings.get(peerId)
    const sign = this.peerSignPublicKeyStrings.get(peerId)
    if (!enc || !sign) return null
    return { encPub: enc, signPub: sign }
  }

  /**
   * 计算与某 peer 的共同安全码指纹。
   * 任一侧公钥未就绪时返回 null（例如尚未完成公钥交换）。
   */
  async computePeerFingerprint(peerId: string): Promise<Fingerprint | null> {
    const own = this.getOwnIdentityKeys()
    const peer = this.getPeerIdentityKeys(peerId)
    if (!own || !peer) return null
    try {
      return await buildFingerprint(own, peer)
    } catch (e) {
      error('[E2EE] computePeerFingerprint failed:', e)
      return null
    }
  }

  /**
   * 用户在 UI 上确认"已和对方带外核对一致"后调用，把当前指纹钉住。
   */
  async markPeerVerified(peerId: string): Promise<void> {
    const fp = await this.computePeerFingerprint(peerId)
    if (!fp) return
    this.verifiedStore.set(peerId, {
      fingerprint: fp.decimal,
      verifiedAt: Date.now(),
    })
    saveVerified(this.verifiedStore)
    log('[E2EE] Peer marked as verified:', peerId)
  }

  /**
   * 查询与某 peer 的带外验证状态。
   * - 从未核对过 → 'unverified'
   * - 当前指纹与上次核对一致 → 'verified'
   * - 上次核对过但当前指纹变了 → 'changed'（疑似中间人换钥，或对方换设备）
   */
  async getVerificationState(peerId: string): Promise<VerificationState> {
    const record = this.verifiedStore.get(peerId)
    if (!record) return 'unverified'
    const fp = await this.computePeerFingerprint(peerId)
    if (!fp) return 'unverified'
    return record.fingerprint === fp.decimal ? 'verified' : 'changed'
  }

  /**
   * 主动清除某 peer 的已验证记录。
   * 用于用户点"不再信任"，或指纹变化后需要重新核对的场景。
   */
  unverifyPeer(peerId: string): void {
    if (this.verifiedStore.delete(peerId)) {
      saveVerified(this.verifiedStore)
      log('[E2EE] Peer verification cleared:', peerId)
    }
  }
}

export const e2eeManager = new E2EEManager()
