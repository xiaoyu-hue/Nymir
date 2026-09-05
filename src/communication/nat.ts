/**
 * Nymir NAT 类型探测
 * 
 * 使用 WebRTC ICE 候选类型检测 NAT 类型：
 * - host: 无 NAT（直连）
 * - srflx: 端口受限锥形 NAT
 * - prflx: 对称锥形 NAT
 * - relay: 需要中继（最严格）
 */

import { log, error } from '../utils/logger'

export type NATType = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown'

export interface NATInfo {
  type: NATType
  localIP?: string
  publicIP?: string
  candidates: string[]
}

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
]

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

class NATDetector {
  private cachedResult: NATInfo | null = null
  private cacheTime = 0
  private detecting = false

  async detect(): Promise<NATInfo> {
    if (this.cachedResult && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      return this.cachedResult
    }
    if (this.detecting) return { type: 'unknown', candidates: [] }

    this.detecting = true
    log('[NAT] Starting detection...')

    try {
      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS.map((urls) => ({ urls })),
      })

      const candidates: string[] = []
      let localIP = ''
      let publicIP = ''

      pc.createDataChannel('detect')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const result = await new Promise<NATInfo>((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            type: this.inferType(candidates),
            localIP,
            publicIP,
            candidates,
          })
        }, 3000)

        pc.onicecandidate = (event) => {
          if (!event.candidate) return

          const candidate = event.candidate.candidate
          candidates.push(candidate)

          const parts = candidate.split(' ')
          const ip = parts[4]
          const type = parts[7]

          if (type === 'host' && ip) localIP = ip
          if (type === 'srflx' && ip) publicIP = ip

          // 如果收集到 relay 候选，立即结束
          if (type === 'relay') {
            clearTimeout(timeout)
            resolve({
              type: 'relay',
              localIP,
              publicIP,
              candidates,
            })
          }
        }

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve({
              type: this.inferType(candidates),
              localIP,
              publicIP,
              candidates,
            })
          }
        }
      })

      await pc.close()
      this.cachedResult = result
      this.cacheTime = Date.now()
      log('[NAT] Detection complete:', result.type)
      return result
    } catch (e) {
      error('[NAT] Detection failed:', e)
      return { type: 'unknown', candidates: [] }
    } finally {
      this.detecting = false
    }
  }

  private inferType(candidates: string[]): NATType {
    const types = new Set<string>()
    for (const c of candidates) {
      const parts = c.split(' ')
      if (parts.length > 7) types.add(parts[7])
    }

    if (types.has('relay')) return 'relay'
    if (types.has('srflx')) return 'srflx'
    if (types.has('prflx')) return 'prflx'
    if (types.has('host')) return 'host'
    return 'unknown'
  }

  clearCache(): void {
    this.cachedResult = null
  }
}

export const natDetector = new NATDetector()
