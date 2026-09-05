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
  signMessage,
  verifySignature,
  type SignKeyPair,
} from './sign'

import { log, error } from '../utils/logger'
import { uint8ToBase64 } from '../utils/base64'

export type E2EEStatus = 'initializing' | 'ready' | 'error'

export type TOFUStatus = 'trusted' | 'untrusted' | 'new'

const KEY_ROTATION_THRESHOLD = 100
const TOFU_STORAGE_KEY = 'nymir_tofu'

function loadTOFU(): Map<string, string> {
  try {
    const raw = localStorage.getItem(TOFU_STORAGE_KEY)
    if (!raw) return new Map()
    return new Map(Object.entries(JSON.parse(raw)))
  } catch {
    return new Map()
  }
}

function saveTOFU(map: Map<string, string>): void {
  localStorage.setItem(TOFU_STORAGE_KEY, JSON.stringify(Object.fromEntries(map)))
}

class E2EEManager {
  private keyPair: KeyPair | null = null
  private signKeyPair: SignKeyPair | null = null
  private peerPublicKeys = new Map<string, CryptoKey>()
  private peerSignPublicKeys = new Map<string, CryptoKey>()
  private status: E2EEStatus = 'initializing'
  private _publicKeyString: string | null = null
  private _signPublicKeyString: string | null = null
  private messageCount = 0
  private onKeyRotationCallback: (() => void) | null = null
  private tofuStore = loadTOFU()

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
   * 初始化 E2EE
   */
  async init(): Promise<void> {
    try {
      this.keyPair = await generateKeyPair()
      this._publicKeyString = await exportPublicKey(this.keyPair)

      this.signKeyPair = await generateSignKeyPair()
      this._signPublicKeyString = await exportSignPublicKey(this.signKeyPair)

      this.status = 'ready'
      log('[E2EE] Initialized with encryption + signing')
    } catch (e) {
      error('[E2EE] Init failed:', e)
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

      const storedHash = this.tofuStore.get(peerId)
      if (storedHash && storedHash !== keyHash) {
        error('[E2EE] TOFU: Peer key changed for', peerId)
        return 'untrusted'
      }

      const peerKey = await importPeerPublicKey(publicKeyStr)
      this.peerPublicKeys.set(peerId, peerKey)

      if (signPublicKeyStr) {
        const peerSignKey = await importPeerSignPublicKey(signPublicKeyStr)
        this.peerSignPublicKeys.set(peerId, peerSignKey)
      }

      // 首次连接：存储公钥哈希
      if (!storedHash) {
        this.tofuStore.set(peerId, keyHash)
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
   * 加密发送给指定 peer 的消息（带前向保密）
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
   * 解密来自指定 peer 的消息（带前向保密）
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
   * 清除某个 peer 的密钥
   */
  removePeerKey(peerId: string): void {
    this.peerPublicKeys.delete(peerId)
    this.peerSignPublicKeys.delete(peerId)
    clearSharedKey(peerId)
  }

  /**
   * 清除所有密钥
   */
  clearAll(): void {
    this.peerPublicKeys.clear()
    this.peerSignPublicKeys.clear()
    clearAllSharedKeys()
  }

  /**
   * 清除 TOFU 信任库
   */
  clearTOFU(): void {
    this.tofuStore.clear()
    localStorage.removeItem(TOFU_STORAGE_KEY)
  }

  /**
   * 检查 peer 公钥是否已固定
   */
  isTOFUPinned(peerId: string): boolean {
    return this.tofuStore.has(peerId)
  }

  /**
   * 记录消息发送并检查是否需要轮换密钥
   */
  recordMessageSent(): void {
    this.messageCount++
    if (this.messageCount >= KEY_ROTATION_THRESHOLD) {
      this.rotateKeys()
    }
  }

  /**
   * 轮换密钥对（前向保密）
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
   * 注册密钥轮换回调（用于通知 peer 新公钥）
   */
  onKeyRotation(cb: () => void): void {
    this.onKeyRotationCallback = cb
  }
}

export const e2eeManager = new E2EEManager()
