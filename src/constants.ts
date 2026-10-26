// Security
export const LOCK_TIMEOUT_MS = 5 * 60 * 1000
export const MIN_PASSWORD_LENGTH = 10

// Messages
export const READ_ONCE_AUTO_DESTROY_MS = 30 * 60 * 1000
export const COPY_FEEDBACK_MS = 2000
export const EXIT_ANIMATION_MS = 300

// Noise
// 噪声发送间隔改为随机区间，打破「固定每 30s」的可识别周期特征
export const NOISE_MIN_INTERVAL_MS = 8_000
export const NOISE_MAX_INTERVAL_MS = 28_000
// 噪声载荷长度改为随机区间，打破「固定 48 字节」的可识别长度特征；
// 上限贴近真实加密消息的长度分布，使观察者更难区分噪声与真实消息
export const NOISE_MIN_LEN = 24
export const NOISE_MAX_LEN = 512
export const FAKE_ID_LENGTH = 20

// Network
export const BROADCAST_DELAY_MS = 100
export const STRATEGY_FALLBACK_MS = 10000
export const RECONNECT_INTERVAL_MS = 3000
export const RECONNECT_BASE_DELAY_MS = 1000
export const RECONNECT_MAX_DELAY_MS = 30_000
export const RECONNECT_MAX_ATTEMPTS = 10

// Connection Monitor
// ping 间隔改为随机区间（约 5s ±40% jitter），打破「固定每 5s 一个规律小包」的元数据特征
export const MONITOR_PING_MIN_INTERVAL_MS = 3_500
export const MONITOR_PING_MAX_INTERVAL_MS = 7_000
export const QUALITY_EXCELLENT_MS = 100
export const QUALITY_GOOD_MS = 300
export const QUALITY_FAIR_MS = 800

// UI
export const STAR_COUNT_LOW = 40
export const STAR_COUNT_HIGH = 80
export const SHOOTING_STAR_MAX_TRAILING = 3
export const SHOOTING_STAR_REMOVAL_MS = 1500
export const SHOOTING_STAR_INTERVAL_MIN_MS = 4000
export const SHOOTING_STAR_INTERVAL_MAX_MS = 10000
export const BURN_URGENT_THRESHOLD_MS = 10_000
export const SHAKE_ANIMATION_MS = 400
