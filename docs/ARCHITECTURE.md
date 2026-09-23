# Nymir 技术架构（当前 · v1.6.0）

> 本文档描述**当前代码真实结构**，与代码同步维护。安全信任边界以 [THREAT_MODEL.md](./THREAT_MODEL.md) 为准；"为什么这样设计"见 [adr/](./adr/README.md)。
> 维护约定：任何文件新增/移动/职责变化，必须同步更新本文档。

---

## 1. 分层总览

```
┌───────────────────────────────────────────────────────────┐
│ UI 层（React 19 + TS）                                     │
│   ChatView / RoomPanel / MessageBubble / LockScreen /      │
│   SafetyCheckDialog / BurnTimer / BackupPanel / Starfield  │
│   + hooks / i18n（zh/en）                                  │
└──────────────────────────────┬────────────────────────────┘
                               ↓ 调用单例管理器，不直接碰浏览器底层
┌──────────────────────────────┴────────────────────────────┐
│ 核心业务层（src/core/ 单例）                                │
│   MessageManager（消息收发/状态/签名校验）                   │
│   RoomManager（房间/连接状态/事件）                         │
│   burn.ts（阅后即焚判定 shouldDestroy/getRemainingMs）       │
│   types.ts（Message/RoomInfo/BurnConfig 数据模型）           │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ 安全层（src/security/，全部基于 WebCrypto，不实现密码学原语） │
│   crypto.ts（本地加密 PBKDF2-600k + AES-256-GCM，v4 格式）   │
│   e2ee.ts（X25519 密钥协商 + 每消息 HKDF + AES-256-GCM）      │
│   sign.ts（Ed25519 密文签名，encrypt-then-sign）             │
│   fingerprint.ts（15 位数字 + 7 emoji 安全码）               │
│   noise.ts（流量噪声：~30s 固定 ~48B 填充）                  │
│   pseudonym.ts（假名/房间内显示名）                          │
│   manager.ts（SecurityManager 锁屏/会话/自动锁定）           │
│   secureDelete.ts（localStorage 敏感键删除）                 │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ 通信层（src/communication/，基于 Trystero）                  │
│   peer.ts（PeerManager：WebRTC 通道、torrent/mqtt 策略）     │
│   offlineQueue.ts（离线消息队列 pending→sent→delivered）     │
│   monitor.ts（连接质量监控，ping/pong 心跳）                 │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ 持久化层（src/persistence/）                                │
│   db.ts（IndexedDB 字段级加密读写，idb 封装）                │
│   backup.ts（加密备份导出/导入，AES-256-GCM + 自带随机盐）    │
└──────────────────────────────┬────────────────────────────┘
                               ↓
┌──────────────────────────────┴────────────────────────────┐
│ 浏览器底座                                                  │
│   WebCrypto（X25519/AES-GCM/HKDF/Ed25519/PBKDF2）           │
│   IndexedDB（本地加密存储）· localStorage（非敏感元数据）      │
│   WebRTC（P2P 数据通道）· 公共信令（MQTT / WebTorrent）       │
└───────────────────────────────────────────────────────────┘
```

## 2. 一条消息的旅程（真实路径）

```
发送方：UI 输入 → MessageManager
  → e2ee.encrypt（X25519 会话密钥 + 每消息 HKDF → AES-256-GCM 加密）
  → sign.signMessage（Ed25519 签密文，encrypt-then-sign）
  → peer.send（WebRTC 数据通道；对端离线则进 offlineQueue）
  → monitor.recordMessageSent
接收方：peer 回调 → MessageManager
  → 验签（sign.ts，失败则 verified=false 且 UI 明示）
  → e2ee.decrypt（失败则 decryptFailed=true，content 占位）
  → db.saveMessage（字段级加密写入 IndexedDB）
  → 若 read_once：阅读后 burn 销毁（双方）
```

## 3. 文件职责清单

| 文件 | 职责 |
| --- | --- |
| `src/main.tsx` / `App.tsx` | React 入口与顶层编排 |
| `src/core/types.ts` | 数据模型：`Message`（含 verified/decryptFailed/destroyed）、`RoomInfo`、`BurnConfig`、`BurnMode`（read_once/timed/scheduled/persist） |
| `src/core/message.ts` | `MessageManager` 单例：消息加密发送/接收/状态机/签名校验/销毁（MESSAGE_SIG_VERSION=2） |
| `src/core/room.ts` | `RoomManager` 单例：房间生命周期、连接状态（connected/reconnecting/disconnected）、事件 |
| `src/core/burn.ts` | 阅后即焚纯函数：`shouldDestroy(msg)` / `getRemainingMs(msg)` |
| `src/security/crypto.ts` | 本地数据加密：PBKDF2(600k)+AES-256-GCM，v4 per-install 盐，兼容 v1/v2/v3 迁移（`needsMigration`/`verifyPassword`/`encryptWithSalt`） |
| `src/security/e2ee.ts` | 会话 E2EE：X25519 密钥对生成/导入导出（私钥 extractable:false）、每消息加密 |
| `src/security/sign.ts` | Ed25519 签名密钥对 + 密文签名/验签 |
| `src/security/fingerprint.ts` | 安全码：双方公钥 → 15 位数字 + 7 emoji（EMOJI_TABLE 64 个，独立实现） |
| `src/security/noise.ts` | 流量噪声：周期性填充 + `isNoiseMessage` 识别 |
| `src/security/pseudonym.ts` | 假名：`getAnonymousId` / 房间内显示名 / 重置 |
| `src/security/manager.ts` | `SecurityManager` 锁屏单例：锁定/解锁/自动锁定/密码材料清理 |
| `src/security/secureDelete.ts` | localStorage 敏感键清理（`clearLocalStorage`，仅 removeItem） |
| `src/communication/peer.ts` | `PeerManager`：Trystero 通道封装，Strategy='torrent'|'mqtt'，peer join/leave 回调 |
| `src/communication/offlineQueue.ts` | 离线消息队列：状态机 pending→sent→delivered/expired/failed |
| `src/communication/monitor.ts` | 连接质量：quality 分级、统计、ping/pong 心跳（明文，已知局限） |
| `src/persistence/db.ts` | IndexedDB 读写：saveRoom/getRoom/…/saveMessage/getMessagesByRoom/destroyMessage |
| `src/persistence/backup.ts` | 加密备份：`exportBackup(password)` 导出 JSON + `downloadBackup` 下载 |
| `src/ui/components/` | 组件：ChatView/RoomPanel/MessageBubble/LockScreen/SafetyCheckDialog/BurnTimer/BackupPanel/Starfield/GlassCard/ConfirmDialog/ErrorBoundary/InstallPrompt |
| `src/ui/hooks/` | React hooks（确认框、计时等） |
| `src/i18n/` | zh.ts / en.ts 双语资源 + index.tsx 提供 |
| `src/utils/` | base64 / id / logger / random / time 工具 |

## 4. 数据模型（src/core/types.ts）

```ts
BurnMode = 'read_once' | 'timed' | 'scheduled' | 'persist'

Message = {
  id, content, sender, timestamp,
  burnMode, burnAfter?, burnAt?,
  readBy: string[], destroyed: boolean,
  decryptFailed?: boolean,   // 解密失败占位
  verified?: boolean,        // 签名验证：true 通过 / false 失败 / undefined 未验证
}

RoomInfo = { id, name, createdAt, peers: string[] }
BurnConfig = { mode, burnAfter?, burnAt? }
```

## 5. 关键流程

### 5.1 发送（含离线补发）
1. UI → MessageManager → e2ee 加密 → sign 签名 → PeerManager 发送。
2. 对端在线：实时送达 → `markDelivered`。
3. 对端离线：`offlineQueue.enqueue`（pending）→ 重连后 `markSent` → 送达 `markDelivered`；超时 `expired`/`failed`。

### 5.2 阅后即焚判定（src/core/burn.ts，纯函数）
- `shouldDestroy(msg)`：`read_once` 且已读 → true；`timed`/`scheduled` 且超过 burnAfter/burnAt → true；否则 false。
- UI 层由 `BurnTimer` 组件驱动倒计时与销毁。

### 5.3 安全码核对（fingerprint）
1. 双方交换公钥（TOFU 接受）。
2. `buildFingerprint` 从双方公钥派生 15 位数字 + 7 emoji（EMOJI_TABLE 64 项）。
3. 用户带外核对 → 钉住指纹；公钥变更 → 红色警告。

## 6. 依赖与外部服务

| 依赖 | 用途 | 信任级别 |
| --- | --- | --- |
| `@trystero-p2p/mqtt` / `@trystero-p2p/torrent` | Peer 发现与建连信令 | 不信任（见威胁模型 §4.1） |
| WebRTC（浏览器） | P2P 数据通道 | 消息内容 E2EE 保护 |
| idb | IndexedDB 封装 | 信任浏览器隔离 |
| React 19 / Vite / Vitest / Oxlint | UI / 构建 / 测试 / lint | 开发与运行时依赖 |

## 7. 测试体系

- **入口**：`npm test`（Vitest），293 项，32 个测试文件（`src/__tests__/`），覆盖：crypto/e2ee/fingerprint/keyRotation(+Verifiable)/burn/db/backup/base64/id/噪声、UI 组件（BurnTimer/ConfirmDialog/ErrorBoundary/GlassCard）等。
- **配套**：`npm run typecheck`（tsc）+ `npm run lint`（oxlint），CI 门禁（GitHub Actions）。
- 安全不变量优先以测试固化（威胁模型 §9：改安全代码先对照威胁模型）。

## 8. 红线（勿动，除非先改威胁模型）

1. **E2EE 管线**：消息必须 encrypt-then-sign；验签失败不得静默展示。
2. **私钥可导出性**：生成时必须 `extractable: false`。
3. **本地加密格式**：v4 per-install 盐 + PBKDF2-600k；兼容旧版本解密不得破坏。
4. **锁屏语义**：忘记密码 = 永久不可解密（不做"找回密码"）。
5. **噪声与监控**：monitor ping/pong 明文是已知局限，改动需评估元数据泄露面。
6. **文档边界**：README/PRD/对外宣传不得声称超出 THREAT_MODEL 的能力。
