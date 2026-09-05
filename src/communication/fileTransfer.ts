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

const CHUNK_SIZE = 16 * 1024 // 16KB per chunk
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export type FileType = 'image' | 'file'

export interface FileMetadata {
  id: string
  name: string
  type: FileType
  mimeType: string
  size: number
  chunks: number
  sender: string
  timestamp: number
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = Record<string, any>

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

    const isImage = file.type.startsWith('image/')
    const metadata: FileMetadata = {
      id: transferId,
      name: file.name,
      type: isImage ? 'image' : 'file',
      mimeType: file.type,
      size: file.size,
      chunks,
      sender: peerManager.id,
      timestamp: Date.now(),
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

      // 发送元数据
      for (const target of targets) {
        this.channel.send({ type: 'file-meta', metadata }, target)
      }

      this.activeSendAbort = new AbortController()

      // 为每个 peer 单独加密并发送（每个 peer 的共享密钥不同）
      for (const target of targets) {
        const encryptedBuffer = await e2eeManager.encryptFile(buffer, target)
        if (!encryptedBuffer) {
          warn(`[FileTransfer] Encryption failed for peer ${target}, skipping`)
          continue
        }

        const encryptedChunks = Math.ceil(encryptedBuffer.byteLength / CHUNK_SIZE)

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
    transfer.progress = Math.round((chunks.size / transfer.metadata.chunks) * 100)
    this.notifyListeners(transfer)

    // 检查是否所有块都已接收
    if (chunks.size === transfer.metadata.chunks) {
      try {
      // 合并所有块
      const merged = new Uint8Array(transfer.metadata.size)
      let offset = 0

        for (let i = 0; i < transfer.metadata.chunks; i++) {
          const chunk = chunks.get(i)
          if (chunk) {
            merged.set(chunk, offset)
            offset += chunk.byteLength
          }
        }

        // 解密（使用发送方的 peerId 作为密钥标识）
        const decrypted = await e2eeManager.decryptFile(merged.buffer, transfer.metadata.sender)
        if (!decrypted) throw new Error('Decryption failed')

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
