/**
 * Nymir 文件传输模块
 * 
 * 使用 WebRTC DataChannel 进行 P2P 文件传输
 * 支持：
 * - 图片/文件 E2EE 传输
 * - 分块传输（大文件）
 * - 进度回调
 * - 传输取消
 */

import { peerManager, type Channel } from './peer'
import { e2eeManager } from '../security/e2eeManager'
import { generateMessageId } from '../utils/id'
import { log, warn, error } from '../utils/logger'
import { uint8ToBase64 } from '../utils/base64'
import type { AnyPayload } from '../core/types'

const CHUNK_SIZE = 16 * 1024 // 16KB per chunk
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export type FileType = 'image' | 'file'

export interface FileMetadata {
  id: string
  name: string
  type: FileType
  mimeType: string
  size: number // 原始文件大小（用于显示）
  chunks: number // 原始文件块数（用于显示）
  encryptedSize: number // 加密后数据总大小（用于接收端分配合并缓冲区）
  encryptedChunks: number // 加密后数据块数（用于接收端判断是否收完）
  sender: string
  timestamp: number
  hash: string // SHA-256 hex of original file data
}

export interface FileTransfer {
  id: string
  metadata: FileMetadata
  progress: number
  status: 'transferring' | 'complete' | 'error' | 'cancelled'
  chunksReceived: number
  data?: ArrayBuffer
  error?: string
}

export type TransferListener = (transfer: FileTransfer) => void

class FileTransferManager {
  private channel: Channel<AnyPayload> | null = null
  private transfers = new Map<string, FileTransfer>()
  private listeners: TransferListener[] = []
  private incomingChunks = new Map<string, Map<number, Uint8Array>>()
  private activeSendAbort: AbortController | null = null

  init(): void {
    this.channel = peerManager.makeChannel<AnyPayload>('file-transfer')

    this.channel.onMessage(async (data, { peerId }) => {
      try {
        if (data.type === 'file-meta') {
          await this.handleMetadata(data.metadata, peerId)
        } else if (data.type === 'file-chunk') {
          await this.handleChunk(data.transferId, data.index, data.data, peerId)
        } else if (data.type === 'file-cancel') {
          this.handleCancel(data.transferId)
        }
      } catch (err) {
        error('[FileTransfer] Handler error:', err)
      }
    })
  }

  /**
   * 发送文件
   */
  async sendFile(file: File, peerId?: string): Promise<string> {
    if (!this.channel) throw new Error('FileTransfer not initialized')
    if (file.size > MAX_FILE_SIZE) throw new Error('File too large (max 50MB)')

    const transferId = generateMessageId()
    const buffer = await file.arrayBuffer()
    const chunks = Math.ceil(buffer.byteLength / CHUNK_SIZE)

    // 计算文件 SHA-256 哈希
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const fileHash = uint8ToBase64(new Uint8Array(hashBuffer))

    const isImage = file.type.startsWith('image/')
    let metadata: FileMetadata = {
      id: transferId,
      name: file.name,
      type: isImage ? 'image' : 'file',
      mimeType: file.type,
      size: file.size,
      chunks,
      encryptedSize: 0, // 加密后填充
      encryptedChunks: 0, // 加密后填充
      sender: peerManager.id,
      timestamp: Date.now(),
      hash: fileHash,
    }

    const transfer: FileTransfer = {
      id: transferId,
      metadata,
      progress: 0,
      status: 'transferring',
      chunksReceived: 0,
    }
    this.transfers.set(transferId, transfer)
    this.notifyListeners(transfer)

    try {
      // 确定目标 peers
      const targets = peerId ? [peerId] : peerManager.peerList
      if (targets.length === 0) throw new Error('No peers connected')

      this.activeSendAbort = new AbortController()

      // 第一步：先为所有 peer 加密，存储加密结果
      // 必须先加密才能知道加密后大小和块数，元数据中需要携带这些信息
      const encryptedBuffers = new Map<string, ArrayBuffer>()
      for (const target of targets) {
        const encryptedBuffer = await e2eeManager.encryptFile(buffer, target)
        if (!encryptedBuffer) {
          warn(`[FileTransfer] Encryption failed for peer ${target}, skipping`)
          continue
        }
        encryptedBuffers.set(target, encryptedBuffer)
      }

      if (encryptedBuffers.size === 0) {
        throw new Error('Encryption failed for all peers')
      }

      // 用第一个成功加密的 peer 计算加密后大小和块数
      // AES-GCM 输出大小固定，所有 peer 的加密结果大小一致
      const firstEncrypted = encryptedBuffers.values().next().value as ArrayBuffer
      const encryptedSize = firstEncrypted.byteLength
      const encryptedChunks = Math.ceil(encryptedSize / CHUNK_SIZE)

      // 更新元数据，携带加密后大小和块数
      metadata = { ...metadata, encryptedSize, encryptedChunks }
      transfer.metadata = metadata

      // 第二步：发送元数据（携带加密后大小和块数）
      for (const target of encryptedBuffers.keys()) {
        this.channel.send({ type: 'file-meta', metadata }, target)
      }

      // 第三步：为每个 peer 发送加密后的块
      for (const [target, encryptedBuffer] of encryptedBuffers) {
        for (let i = 0; i < encryptedChunks; i++) {
          if (this.activeSendAbort.signal.aborted) {
            transfer.status = 'cancelled'
            this.notifyListeners(transfer)
            return transferId
          }

          const start = i * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, encryptedBuffer.byteLength)
          const chunk = encryptedBuffer.slice(start, end)

          this.channel.send(
            { type: 'file-chunk', transferId, index: i, data: chunk },
            target,
          )

          // 小延迟避免阻塞
          if (i % 10 === 0) {
            await new Promise((r) => setTimeout(r, 0))
          }
        }
      }

      transfer.status = 'complete'
      transfer.progress = 100
      this.notifyListeners(transfer)
      log(`[FileTransfer] Sent ${file.name} (${file.size} bytes) to ${targets.length} peer(s)`)
    } catch (err) {
      transfer.status = 'error'
      transfer.error = err instanceof Error ? err.message : String(err)
      this.notifyListeners(transfer)
      throw err
    }

    return transferId
  }

  /**
   * 取消传输
   */
  cancel(transferId: string): void {
    this.activeSendAbort?.abort()
    this.channel?.send({ type: 'file-cancel', transferId })
    this.handleCancel(transferId)
  }

  /**
   * 获取传输状态
   */
  getTransfer(id: string): FileTransfer | undefined {
    return this.transfers.get(id)
  }

  /**
   * 获取所有传输
   */
  getAllTransfers(): FileTransfer[] {
    return [...this.transfers.values()]
  }

  onTransfer(cb: TransferListener): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== cb)
    }
  }

  private async handleMetadata(metadata: FileMetadata, peerId: string): Promise<void> {
    const transfer: FileTransfer = {
      id: metadata.id,
      metadata,
      progress: 0,
      status: 'transferring',
      chunksReceived: 0,
    }
    this.transfers.set(metadata.id, transfer)
    this.incomingChunks.set(metadata.id, new Map())
    this.notifyListeners(transfer)
    log(`[FileTransfer] Receiving ${metadata.name} from ${peerId}`)
  }

  private async handleChunk(
    transferId: string,
    index: number,
    data: ArrayBuffer,
    _peerId: string,
  ): Promise<void> {
    const transfer = this.transfers.get(transferId)
    if (!transfer || transfer.status !== 'transferring') return

    const chunks = this.incomingChunks.get(transferId)
    if (!chunks) return

    chunks.set(index, new Uint8Array(data))
    transfer.chunksReceived = chunks.size

    // 使用加密后的块数计算进度和判断是否收完
    // 向后兼容：旧版本元数据无 encryptedChunks 时回退到原始 chunks
    const totalChunks = transfer.metadata.encryptedChunks || transfer.metadata.chunks
    transfer.progress = Math.round((chunks.size / totalChunks) * 100)
    this.notifyListeners(transfer)

    // 检查是否所有块都已接收
    if (chunks.size === totalChunks) {
      try {
        // 合并所有块 — 必须使用加密后大小分配缓冲区
        // 向后兼容：旧版本元数据无 encryptedSize 时回退到原始 size
        const mergedSize = transfer.metadata.encryptedSize || transfer.metadata.size
        const merged = new Uint8Array(mergedSize)
        let offset = 0

        for (let i = 0; i < totalChunks; i++) {
          const chunk = chunks.get(i)
          if (chunk) {
            merged.set(chunk, offset)
            offset += chunk.byteLength
          }
        }

        // 解密（使用发送方的 peerId 作为密钥标识）
        const decrypted = await e2eeManager.decryptFile(merged.buffer, transfer.metadata.sender)
        if (!decrypted) throw new Error('Decryption failed')

        // 验证文件完整性
        const decryptedHashBuffer = await crypto.subtle.digest('SHA-256', decrypted)
        const decryptedHash = uint8ToBase64(new Uint8Array(decryptedHashBuffer))
        if (decryptedHash !== transfer.metadata.hash) {
          throw new Error('File integrity check failed: hash mismatch')
        }

        transfer.data = decrypted
        transfer.status = 'complete'
        transfer.progress = 100
        this.notifyListeners(transfer)

        this.incomingChunks.delete(transferId)
        log(`[FileTransfer] Received ${transfer.metadata.name}`)
      } catch (err) {
        transfer.status = 'error'
        transfer.error = err instanceof Error ? err.message : String(err)
        this.notifyListeners(transfer)
      }
    }
  }

  private handleCancel(transferId: string): void {
    const transfer = this.transfers.get(transferId)
    if (transfer) {
      transfer.status = 'cancelled'
      this.notifyListeners(transfer)
    }
    this.incomingChunks.delete(transferId)
  }

  private notifyListeners(transfer: FileTransfer): void {
    for (const cb of this.listeners) cb(transfer)
  }
}

export const fileTransferManager = new FileTransferManager()
