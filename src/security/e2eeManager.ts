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

/** 自动密钥轮换阈值：每发送 N 条消息触发一次可验证轮换（ADR-007） */
export const AUTO_ROTATION_INTERVAL = 100

export type E2EEStatus = 'initializing' | 'ready' | 'error'

export type TOFUStatus = 'trusted' | 'untrusted' | 'new'

/**
 * 带外验证状态：
 * - unverified：从未核对过安全码
 * - verified：当前指纹与上次核对时一致
 * - changed：上次核对过，但当前指纹变了（疑似中间人换钥或对方重装）
 */
export type VerificationState = 'verified' | 'unverified' | 'changed'

/**
 * 可验证密钥轮换证明（签名衔接协议，ADR-007）。
 *
 * 语义：换钥时用「旧签名私钥」对「新公钥材料」签名，对端用已固定的旧签名
 * 公钥验签通过后才接受新公钥——证明新旧身份是同一实体，防中间人直接注入假新钥。
 */
export interface KeyRotationNotice {
  /** 不含签名的证明体 JSON（被签名的对象） */
  proof: string
  /** 用旧签名私钥对 proof 的签名（base64） */
  signature: string
}

/** 证明体内部结构（v1） */
interface KeyRotationBody {
  v: 1
  /** 发起端轮换前的签名公钥（对端用它验签） */
  oldSignPub: string
  /** 新 E2EE 加密公钥 */
  newEncPub: string
  /** 新签名公钥 */
  newSignPub: string
  rotatedAt: number
}

export type KeyRotationResult = 'accepted' | 'rejected' | 'ignored' | 'no-peer-key'

// 历史：曾在每 100 条消息时自动 rotateKeys，因无对端通知与 TOFU 衔接已关闭。
const TOFU_STORAGE_KEY = 'nymir_tofu'
// 用户手动核对过的安全码指纹，按对方公钥 SHA-256 哈希存（跨会话持久）。
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
  private onKeyRotationCallback: ((notice: KeyRotationNotice | null) => void) | null = null
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
   * 记录消息发送并检查自动轮换阈值。
   *
   * 可验证自动轮换（ADR-007 协议就绪后重新启用）：
   * - 每发送 AUTO_ROTATION_INTERVAL（默认 100）条消息触发一次 rotateKeysVerifiable()——
   *   签名衔接证明经 key-rotation 通道广播，对端验签通过才 re-pin。
   *   （早期"每 100 条自动换"因无对端通知、无签名衔接导致解密失败，缺陷已由协议解决。）
   * - 仅在至少一个对端在线时触发（onlinePeerCount > 0）：轮换证明需要实时广播，
   *   对端离线时轮换会导致其仍持旧公钥、后续消息无法解密（ADR-007 已知后果）。
   * - 对端离线时跳过本次触发，计数继续累计，待下次发消息且对端在线时补触发。
   *
   * @param onlinePeerCount 当前在线对端数（由通信层传入 peerManager.getPeers().length）
   * @returns 是否触发了自动轮换
   */
  recordMessageSent(onlinePeerCount = 0): boolean {
    this.messageCount++
    if (this.messageCount >= AUTO_ROTATION_INTERVAL && onlinePeerCount > 0) {
      // 先清零避免异步轮换期间重入触发；rotateKeysVerifiable 内部也会清零（幂等）。
      this.messageCount = 0
      log('[E2EE] Auto rotation threshold reached, rotating keys (verifiable)')
      void this.rotateKeysVerifiable()
      return true
    }
    return false
  }

  /**
   * 显式轮换密钥对（向后兼容；不产生可验证证明，生产路径请用 rotateKeysVerifiable）。
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
      this.onKeyRotationCallback?.(null)
    } catch (e) {
      error('[E2EE] Key rotation failed:', e)
    }
  }

  /**
   * 可验证密钥轮换（签名衔接协议，ADR-007）。
   *
   * 1. 生成新加密/签名密钥对；
   * 2. 用旧签名私钥对「新公钥材料」签名，形成 KeyRotationNotice；
   * 3. 应用并持久化新身份（刷新后仍为新钥）；
   * 4. 触发 onKeyRotation 回调，由通信层把证明广播给所有 peer。
   *
   * 对端 handleKeyRotation 验签通过才 re-pin；生产路径应调用本方法而非 rotateKeys()。
   */
  async rotateKeysVerifiable(): Promise<KeyRotationNotice | null> {
    const oldSignKeyPair = this.signKeyPair
    const oldSignPub = this._signPublicKeyString
    if (!this.keyPair || !oldSignKeyPair || !oldSignPub) {
      error('[E2EE] Key rotation skipped: identity not loaded')
      return null
    }

    const newEncPair = await generateKeyPair()
    const newSignPair = await generateSignKeyPair()
    const newEncPub = await exportPublicKey(newEncPair)
    const newSignPub = await exportSignPublicKey(newSignPair)

    const body: KeyRotationBody = {
      v: 1,
      oldSignPub,
      newEncPub,
      newSignPub,
      rotatedAt: Date.now(),
    }
    const proof = JSON.stringify(body)
    const signature = await signMessage(proof, oldSignKeyPair.privateKey)

    // 应用新身份
    this.keyPair = newEncPair
    this.signKeyPair = newSignPair
    this._publicKeyString = newEncPub
    this._signPublicKeyString = newSignPub
    this.messageCount = 0
    clearAllSharedKeys()

    // 持久化新身份（刷新页面后仍为新钥）
    try {
      const encKeypair = JSON.stringify(await exportKeyPair(newEncPair))
      const signKeypair = JSON.stringify(await exportSignKeyPair(newSignPair))
      await saveIdentity(
        await securityManager.encrypt(encKeypair),
        await securityManager.encrypt(signKeypair),
      )
    } catch (e) {
      error('[E2EE] Failed to persist rotated identity:', e)
    }

    log('[E2EE] Keys rotated (verifiable)')
    this.onKeyRotationCallback?.({ proof, signature })
    return { proof, signature }
  }

  /**
   * 处理对端的可验证密钥轮换通知。
   *
   * - 无已固定的旧签名公钥 → 'no-peer-key'（首次交换请走 handlePeerPublicKey）
   * - 证明格式非法 / oldSignPub 与已固定旧钥不符 / 验签失败 → 'rejected'（不更新任何状态）
   * - 新公钥与当前一致（重复广播）→ 'ignored'
   * - 验签通过 → 更新对端公钥 + TOFU re-pin + 迁移已验证记录（保留旧指纹，
   *   getVerificationState 因此自然返回 'changed'，UI 提示重新核对）→ 'accepted'
   */
  async handleKeyRotation(
    peerId: string,
    notice: KeyRotationNotice,
  ): Promise<KeyRotationResult> {
    const oldSignKey = this.peerSignPublicKeys.get(peerId)
    const oldEncStr = this.peerPublicKeyStrings.get(peerId)
    if (!oldSignKey || !oldEncStr) {
      log('[E2EE] Key rotation rejected: no pinned old keys for peer', peerId)
      return 'no-peer-key'
    }

    let body: KeyRotationBody
    try {
      body = JSON.parse(notice.proof)
    } catch {
      return 'rejected'
    }
    if (
      body.v !== 1 ||
      typeof body.newEncPub !== 'string' ||
      typeof body.newSignPub !== 'string' ||
      typeof body.oldSignPub !== 'string'
    ) {
      return 'rejected'
    }
    // 重复广播：新加密公钥与当前一致 → 忽略。
    // 必须放在最前：若已接受过一次，本端固定的公钥已更新，重放同一证明
    // 会因 oldSignPub/验签检查误判 rejected；且此处不改变任何状态，安全。
    if (body.newEncPub === oldEncStr) return 'ignored'

    // 旧签名公钥必须与本端已固定的旧钥一致（防伪造来源：新公钥必须由上一代签名）
    if (body.oldSignPub !== this.peerSignPublicKeyStrings.get(peerId)) {
      return 'rejected'
    }

    const ok = await verifySignature(notice.proof, notice.signature, oldSignKey)
    if (!ok) {
      log('[E2EE] Key rotation REJECTED (signature failed) for peer', peerId)
      return 'rejected'
    }

    // 验签通过：计算新旧公钥哈希（先算旧的，map 更新后拿不到）
    const oldKeyHash = await this.hashPubKey(oldEncStr)
    const newKeyHash = await this.hashPubKey(body.newEncPub)

    // 更新对端公钥
    const newEncKey = await importPeerPublicKey(body.newEncPub)
    const newSignKey = await importPeerSignPublicKey(body.newSignPub)
    this.peerPublicKeys.set(peerId, newEncKey)
    this.peerPublicKeyStrings.set(peerId, body.newEncPub)
    this.peerSignPublicKeys.set(peerId, newSignKey)
    this.peerSignPublicKeyStrings.set(peerId, body.newSignPub)

    // TOFU re-pin：新公钥哈希钉住（身份延续已由签名证明）
    this.tofuStore.set(newKeyHash, 'pinned')
    saveTOFU(this.tofuStore)

    // verified 迁移：保留"曾核对"历史（旧指纹 → 状态自然变 'changed'，UI 提示重新核对）
    const verified = this.verifiedStore.get(oldKeyHash)
    if (verified) {
      this.verifiedStore.delete(oldKeyHash)
      this.verifiedStore.set(newKeyHash, verified)
      saveVerified(this.verifiedStore)
    }

    log('[E2EE] Key rotation ACCEPTED for peer', peerId)
    return 'accepted'
  }

  /**
   * 注册密钥轮换回调（通知通信层向所有 peer 广播新公钥证明）。
   * notice 为 null 表示非可验证轮换（旧 rotateKeys），调用方应只处理 notice 非空的情况。
   */
  onKeyRotation(cb: (notice: KeyRotationNotice | null) => void): void {
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
    const keyHash = await this.getKeyHashForPeer(peerId)
    if (!keyHash) return
    this.verifiedStore.set(keyHash, {
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
   *
   * key 用公钥哈希（不是临时 peerId），切换传输策略/刷新后仍有效。
   */
  async getVerificationState(peerId: string): Promise<VerificationState> {
    const keyHash = await this.getKeyHashForPeer(peerId)
    if (!keyHash) return 'unverified'
    const record = this.verifiedStore.get(keyHash)
    if (!record) return 'unverified'
    const fp = await this.computePeerFingerprint(peerId)
    if (!fp) return 'unverified'
    return record.fingerprint === fp.decimal ? 'verified' : 'changed'
  }

  /**
   * 主动清除某 peer 的已验证记录。
   * 用于用户点"不再信任"，或指纹变化后需要重新核对的场景。
   */
  async unverifyPeer(peerId: string): Promise<void> {
    const keyHash = await this.getKeyHashForPeer(peerId)
    if (!keyHash) return
    if (this.verifiedStore.delete(keyHash)) {
      saveVerified(this.verifiedStore)
      log('[E2EE] Peer verification cleared:', peerId)
    }
  }

  /** 根据 peerId 查对方公钥字符串的 SHA-256 哈希（verifiedStore 的 key） */
  private async getKeyHashForPeer(peerId: string): Promise<string | null> {
    const pubKeyStr = this.peerPublicKeyStrings.get(peerId)
    if (!pubKeyStr) return null
    return this.hashPubKey(pubKeyStr)
  }

  /** 公钥字符串 → SHA-256 哈希（TOFU / verifiedStore 的 key） */
  private async hashPubKey(pubKeyStr: string): Promise<string> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pubKeyStr))
    return uint8ToBase64(new Uint8Array(hashBuffer))
  }
}

export const e2eeManager = new E2EEManager()
