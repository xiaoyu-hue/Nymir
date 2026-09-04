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

export type E2EEStatus = 'initializing' | 'ready' | 'error'

class E2EEManager {
  private keyPair: KeyPair | null = null
  private peerPublicKeys = new Map<string, CryptoKey>()
  private status: E2EEStatus = 'initializing'
  private peerPublicKeyStrings = new Map<string, string>()

  get currentStatus(): E2EEStatus {
    return this.status
  }

  get publicKeyString(): string | null {
    return this._publicKeyString
  }

  private _publicKeyString: string | null = null

  /**
   * 初始化 E2EE
   */
  async init(): Promise<void> {
    try {
      this.keyPair = await generateKeyPair()
      this._publicKeyString = await exportPublicKey(this.keyPair)
      this.status = 'ready'
      console.log('[E2EE] Initialized')
    } catch (e) {
      console.error('[E2EE] Init failed:', e)
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
   * 处理接收到的对端公钥
   */
  async handlePeerPublicKey(peerId: string, publicKeyStr: string): Promise<void> {
    try {
      const peerKey = await importPeerPublicKey(publicKeyStr)
      this.peerPublicKeys.set(peerId, peerKey)
      this.peerPublicKeyStrings.set(peerId, publicKeyStr)
      console.log(`[E2EE] Received public key from ${peerId}`)
    } catch (e) {
      console.error(`[E2EE] Failed to import key from ${peerId}:`, e)
    }
  }

  /**
   * 检查是否已与某个 peer 建立 E2EE
   */
  hasPeerKey(peerId: string): boolean {
    return this.peerPublicKeys.has(peerId)
  }

  /**
   * 加密发送给指定 peer 的消息
   */
  async encrypt(plaintext: string, peerId: string): Promise<string | null> {
    if (!this.keyPair) return null
    const peerKey = this.peerPublicKeys.get(peerId)
    if (!peerKey) return null

    try {
      const payload = await encryptMessage(plaintext, peerId, this.keyPair.privateKey, peerKey)
      return JSON.stringify(payload)
    } catch (e) {
      console.error(`[E2EE] Encrypt failed for ${peerId}:`, e)
      return null
    }
  }

  /**
   * 解密来自指定 peer 的消息
   */
  async decrypt(ciphertext: string, peerId: string): Promise<string | null> {
    if (!this.keyPair) return null
    const peerKey = this.peerPublicKeys.get(peerId)
    if (!peerKey) return null

    try {
      const payload = JSON.parse(ciphertext)
      return await decryptMessage(payload, peerId, this.keyPair.privateKey, peerKey)
    } catch (e) {
      console.error(`[E2EE] Decrypt failed from ${peerId}:`, e)
      return null
    }
  }

  /**
   * 清除某个 peer 的密钥
   */
  removePeerKey(peerId: string): void {
    this.peerPublicKeys.delete(peerId)
    this.peerPublicKeyStrings.delete(peerId)
    clearSharedKey(peerId)
  }

  /**
   * 清除所有密钥
   */
  clearAll(): void {
    this.peerPublicKeys.clear()
    this.peerPublicKeyStrings.clear()
    clearAllSharedKeys()
  }
}

export const e2eeManager = new E2EEManager()
