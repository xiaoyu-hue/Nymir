/**
 * 信令（Signaling）可配置模块
 *
 * 背景：
 *   原实现把公共 MQTT / Nostr / WebTorrent 信令地址硬编码在 peer.ts 中，
 *   用户无法改用自托管 / 更可信的信令节点，等于把所有用户的"发现与建连"
 *   都押在少数公共服务上（见 THREAT_MODEL §5.3 / §7 第 2 条）。
 *
 * 本模块把"默认公共配置"抽出来，并允许用户在 localStorage 中覆盖：
 *   - 每个传输策略可单独配置 relay URLs 与 redundancy；
 *   - 可指定默认策略（mqtt / nostr / torrent）；
 *   - 清空某策略的 URLs 即等于"禁用该策略"（用户可只留自托管节点）。
 *
 * 安全边界（重要）：
 *   - 信令服务器本就不被信任（只用于发现/建连，不接触消息明文），
 *     所以允许用户指向任意自托管节点是安全的，反而降低了对公共服务的依赖。
 *   - 但自定义 wss 地址需 index.html 的 CSP `connect-src` 允许；本模块
 *     默认配置配套的 CSP 已放开 `wss:` 通配以兼容自托管。
 *   - 所有 URL 必须是以 ws:// 或 wss:// 开头的合法 WebSocket 地址，
 *     解析失败 / 非法 URL 一律回退到默认，绝不静默接受错误配置。
 */

export type SignalingStrategy = 'mqtt' | 'nostr' | 'torrent'

export interface StrategyRelayConfig {
  /** relay / tracker / websocket 接入点 */
  urls: string[]
  /** 同时维持的连接数（Trystero redundancy） */
  redundancy: number
}

export interface SignalingConfig {
  defaultStrategy: SignalingStrategy
  mqtt: StrategyRelayConfig
  nostr: StrategyRelayConfig
  torrent: StrategyRelayConfig
}

/** 默认公共信令配置（原 peer.ts 中的硬编码值，作为出厂默认值保留） */
export const DEFAULT_SIGNALING: SignalingConfig = {
  defaultStrategy: 'mqtt',
  mqtt: {
    urls: [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://broker-cn.emqx.io:8084/mqtt',
      'wss://broker.hivemq.com:8884/mqtt',
      'wss://test.mosquitto.org:8081/mqtt',
      'wss://public:public@public.cloud.shiftr.io',
    ],
    redundancy: 5,
  },
  nostr: {
    urls: [
      'wss://nos.lol',
      'wss://nostr-relay.corb.net',
      'wss://nostr.data.haus',
      'wss://basspistol.org',
      'wss://bucket.coracle.social',
      'wss://chorus.pjv.me',
      'wss://koru.bitcointxoko.org',
      'wss://nostr-01.yakihonne.com',
    ],
    redundancy: 5,
  },
  torrent: {
    urls: [
      'wss://tracker.openwebtorrent.com',
      'wss://open.ftorrent.com',
      'wss://tracker.webtorrent.dev',
      'wss://tracker.btorrent.xyz',
      'wss://tracker.files.fm:7073/announce',
    ],
    redundancy: 5,
  },
}

const STORAGE_KEY = 'nymir:signaling-config'

function isWsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^wss?:\/\/\S+$/.test(value.trim())
}

function clampRedundancy(redundancy: unknown, urlCount: number): number {
  const n = typeof redundancy === 'number' && Number.isFinite(redundancy) ? Math.floor(redundancy) : urlCount
  if (urlCount <= 0) return 0
  return Math.min(Math.max(n, 1), urlCount)
}

function sanitizeStrategy(input: unknown): StrategyRelayConfig {
  if (!input || typeof input !== 'object') return { urls: [], redundancy: 0 }
  const obj = input as Record<string, unknown>
  const urls = Array.isArray(obj.urls) ? obj.urls.filter(isWsUrl) : []
  return { urls, redundancy: clampRedundancy(obj.redundancy, urls.length) }
}

function resolveStrategy(
  input: unknown,
  fallback: StrategyRelayConfig,
): StrategyRelayConfig {
  // 用户未提供、或提供的 URLs 为空 → 用出厂默认（不静默接受空配置）
  if (!input || typeof input !== 'object') return { ...fallback, urls: [...fallback.urls] }
  const obj = input as Record<string, unknown>
  if (!Array.isArray(obj.urls) || obj.urls.filter(isWsUrl).length === 0) {
    return { ...fallback, urls: [...fallback.urls] }
  }
  return sanitizeStrategy(input)
}

function isValidStrategy(s: unknown): s is SignalingStrategy {
  return s === 'mqtt' || s === 'nostr' || s === 'torrent'
}

function cloneConfig(cfg: SignalingConfig): SignalingConfig {
  return {
    defaultStrategy: cfg.defaultStrategy,
    mqtt: { ...cfg.mqtt, urls: [...cfg.mqtt.urls] },
    nostr: { ...cfg.nostr, urls: [...cfg.nostr.urls] },
    torrent: { ...cfg.torrent, urls: [...cfg.torrent.urls] },
  }
}

/**
 * 读取当前生效的信令配置。
 * 优先使用 localStorage 中的用户覆盖；任何字段缺失 / 非法都回退到默认值，
 * 解析异常整体回退到默认（fail-safe，绝不因坏配置让应用崩溃）。
 */
export function loadSignalingConfig(): SignalingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneConfig(DEFAULT_SIGNALING)
    const parsed = JSON.parse(raw) as Partial<SignalingConfig>
    return {
      defaultStrategy: isValidStrategy(parsed.defaultStrategy)
        ? parsed.defaultStrategy
        : DEFAULT_SIGNALING.defaultStrategy,
      mqtt: resolveStrategy(parsed.mqtt, DEFAULT_SIGNALING.mqtt),
      nostr: resolveStrategy(parsed.nostr, DEFAULT_SIGNALING.nostr),
      torrent: resolveStrategy(parsed.torrent, DEFAULT_SIGNALING.torrent),
    }
  } catch {
    return cloneConfig(DEFAULT_SIGNALING)
  }
}

/**
 * 持久化用户信令配置。会按与 load 相同的规则校验/清洗，
 * 非法 URL 被静默丢弃（只保留 wss/ws 合法项）。
 * 返回清洗后的配置（供 UI 回显真实写入了什么）。
 */
export function saveSignalingConfig(cfg: SignalingConfig): SignalingConfig {
  const cleaned: SignalingConfig = {
    defaultStrategy: isValidStrategy(cfg.defaultStrategy)
      ? cfg.defaultStrategy
      : DEFAULT_SIGNALING.defaultStrategy,
    mqtt: sanitizeStrategy(cfg.mqtt),
    nostr: sanitizeStrategy(cfg.nostr),
    torrent: sanitizeStrategy(cfg.torrent),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
  } catch {
    // 隐私模式 / 配额满：不抛错，内存中仍可用（下次启动回退默认）
  }
  return cleaned
}

/** 清除用户覆盖，恢复出厂默认信令配置。 */
export function resetSignalingConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
