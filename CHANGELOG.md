# 更新日志

本文件记录 Nymir 的所有重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/).

> ⚠️ 提示：本项目由 AI 辅助开发，作者无编程基础，尚未经过专业安全审计，不建议用于真实敏感场景。

---

## 三轮安全审计修复 - 2026-09-11

> 包含第一轮、第二轮、第三轮安全审计发现的代码缺陷修复。每项修复均单独提交，提交前运行全量测试（179 用例全部通过）。

### 🛡️ 安全修复

#### 第一轮安全审计修复

- **fix(persistence): encryptField 禁止静默明文降级**
  > 加密失败（含锁定无密钥）时抛错，绝不静默降级为明文落盘。一旦明文写入 IndexedDB，将不再有重新加密的时机。

- **fix(core): 接收路径封堵 encrypt-then-sign 明文绕过**
  > 当 `encrypted: false` 且验签通过时，不再把 content 当明文接受，一律视为验签失败。封堵 sign-then-encrypt 旧方式的字典攻击路径。同时增加字段校验（burnMode/timestamp 枚举与类型检查），离线入队不再携带明文。

- **feat(security): PBKDF2 派生密钥缓存（v3 加密格式）**
  > 同一密码只会派生一次 600k PBKDF2，之后仅用随机 IV。固定盐使不同安装的同一密码派生出同一密钥（防彩虹表收益消失，密码强度与 600k 迭代保护不变）。旧 v1/v2 数据解密走 legacy 路径。

- **fix(security): 移除 _cachedPassword 字符串副本**
  > 一边用 Uint8Array 存密码并 fill(0) 清零，一边保存不可变 JS 字符串副本，清零操作完全失去意义。移除字符串副本，密码仅在使用时按需解码、调用后即弃。

- **fix(security): 修复共享密钥 LRU off-by-one**
  > evictOldestSharedKey() 在 sharedKeys.set() 之前调用，上限实际变成 101。改为先 set 再淘汰，上限恰为 100。

#### 第二轮安全审计修复

- **fix(security): crypto cachedKey 不存原始密码字符串，改用 SHA-256 哈希仅用于比对**
  > v3 缓存里 `cachedKey = { password, key }` 又存了一个密码字符串，和移除 _cachedPassword 的初衷矛盾。改为存密码 SHA-256 哈希（仅用于比对，不用于密钥派生），减少明文密码在 JS 堆的驻留。

- **fix(persistence): decryptField 锁定时抛错而非返回原值**
  > 原逻辑 `if (isLocked) return value`，若 value 是旧明文数据则锁定时返回明文。改为锁定时 throw Error，上层必须处理，不静默返回可能的明文。

### 🛠️ 功能修复

#### 第一轮安全审计修复

- **feat(communication): offlineQueue 新增 clearRoom(roomId)**
  > 按房间清理离线队列条目，退出房间时避免该房间 payload 残留。

- **fix(core): room.leaveRoom() 清理该房间离线队列**
  > 退出房间时调用 offlineQueue.clearRoom()，契约缺口闭合。

- **fix(communication): Channel.onMessage 返回退订函数**
  > monitor.setChannel/stop 清理旧 handler，防止重复注册泄漏。

- **fix(core): MessageManager.bindChannels/destroy 使用 onMessage 退订**
  > 房间重建不再残留旧 handler。

#### 第二轮安全审计修复

- **fix(security): needsMigration 长度检查从 >1 改为 >0**
  > 与 decrypt() 中的 v3 检测逻辑保持一致。

- **fix(security): setPassword 时调用 clearCryptoCache**
  > 防御性清理：设置新密码时清空派生密钥缓存，避免旧密码的派生密钥在内存中残留。

- **fix(communication): offlineQueue.clearRoom 移除消息后 emit expired 事件**
  > 通知 UI 同步状态，避免 UI 仍显示已被清理的离线消息。

- **fix(communication): offlineQueue.markDelivered 移除多余的 saveToStorage 调用**
  > 移除消息前无需保存一次，避免冗余写入。

- **fix(communication): offlineQueue.loadFromStorage 在 prune 过期消息后 saveToStorage**
  > 防止过期消息残留 localStorage。

### 🧹 代码清理

#### 第一轮安全审计修复

- **chore(communication): 删除死代码——nat.ts 整模块与 peerManager.reconnect()**
  > nat.ts 整个模块定义了从未调用；reconnect() 0 引用。

- **chore(security): 删除未使用的 clearTOFU/isTOFUPinned/getNoiseStats**
  > 均为 0 引用的死代码。

#### 第二轮安全审计修复

- **cleanup(communication): monitor 删除未使用的 pendingPings 死代码字段**
  > 定义但全程未调用，连同 stop() 中的 clear() 调用一并移除。

- **cleanup(core): room.secureReset 标记为废弃死代码**
  > 此方法从未被调用，且清理逻辑不完整（仅 leaveRoom + clearLocalStorage，未清理 IndexedDB）。完整重置请使用 securityManager.reset()。

### 📝 文档注释

#### 第二轮安全审计修复

- **docs(security): e2ee deriveMessageKey 注释移除「前向保密」表述**
  > 改为每消息密钥派生，并说明本方案是会话级静态 ECDH + 每消息 HKDF，不提供强前向保密。与 e2eeManager.ts 文件头注释及 THREAT_MODEL.md 保持一致。

#### 第三轮安全审计修复

- **chore: 删除 fileTransfer.ts 死代码（315行）**
  > 全项目 0 引用，init() 从未调用，ChatView 无文件传输 UI，整个模块未初始化。即使调用 sendFile 也会因 channel 为 null 直接抛错。删除以减少维护负担和误导。

### 🛠️ 功能修复

#### 第三轮安全审计修复

- **fix(ui): RoomPanel 房间名 input 增加 maxLength={50}**
  > 与房间码 maxLength={9} 保持一致的输入限制，防止用户输入超长房间名。

### 🛡️ 安全修复

#### 第四轮安全审计修复（sign/pseudonym/noise/backup/burn 五模块）

- **fix(security): noise 模块注释诚实降级声明能力边界**
  > 原注释声称"噪声消息格式与真实消息相同（无可识别标记）"，但实际噪声存在固定间隔、burnMode 恒为 read_once、无 sender、无 signature 等可识别特征。修改注释，诚实声明"当前噪声是基础版，目标是提高分析成本，而非完全无法区分"，符合项目"文档不得超出实现"的原则。

### 🛠️ 功能修复

#### 第四轮安全审计修复

- **fix(security): pseudonym ADJECTIVES 数组移除重复元素**
  > '温柔的' 出现两次，注释声称 40 个形容词实际只有 39 个唯一值。替换第二个 '温柔的' 为 '从容的'，确保 40 个唯一形容词。

- **fix(security): noise startNoiseGeneration 时重置 noiseCount**
  > stop 后再 start 时 noiseCount 继续累加，导致日志统计不准确。每次启动时重置为 0。

- **fix(security): noise 改用 utils/random 统一 secureRandomInt，消除重复实现**
  > noise.ts 自己实现了一遍 secureRandomInt（取模运算，有模偏差），与 utils/random.ts 重复。改为导入统一实现，消除重复代码。

- **fix(persistence): backup importBackup 导入时跳过已存在条目，避免覆盖本地新数据**
  > 原逻辑直接 saveRoom/saveMessage，同 ID 条目会被旧备份覆盖，导致本地新产生的消息丢失。改为导入前检查 getRoom/getMessage，已存在则跳过，返回实际导入数量。

- **fix(persistence): backup downloadBackup 延迟释放 blob URL**
  > URL.revokeObjectURL 在 a.click() 后立即执行，但 click 是异步触发下载，立即 revoke 可能导致下载未开始就失效。改为 setTimeout 延迟 1 秒释放。

- **feat(persistence): db 新增 getMessage(id) 函数**
  > 供备份导入时检查消息是否已存在，避免覆盖本地新数据。

### 📝 测试

#### 第四轮安全审计修复

- **test: backup 测试同步新行为**
  > db mock 新增 getRoom/getMessage；"导入到已有数据的库"测试从"同 id 覆盖"改为"同 id 跳过，保护本地新数据"，期望返回实际导入数量 0。

### 🛠️ 功能修复

#### 第五轮代码审查（i18n/utils/App/ChatView/UI组件）

- **fix(ui): 4处异步操作添加错误处理，移除 scheduled 死代码**
  > App.tsx handleCreateRoom/handleJoinRoom、ChatView.tsx handleSend、MessageBubble.tsx handleRecall、LockScreen.tsx handleReset 均添加 try/catch，防止未捕获 Promise rejection。ChatView.tsx 移除 BurnConfig 中 UI 不支持的 scheduled 模式死代码。

### 📋 审查记录

#### 第五轮代码审查

- **审查范围**：i18n 国际化（3文件）、utils 工具（5文件）、App.tsx 主组件、ChatView.tsx 聊天视图、UI 组件（13个）
- **审查结果**：未发现严重安全漏洞或功能 bug。UI 组件整体安全（无 dangerouslySetInnerHTML/innerHTML/eval，无 XSS 风险）。
- **发现问题**：8个低优先级问题（4处异步操作无错误处理、1处死代码、1个正则不精确、2个小问题），已修复4处错误处理和1处死代码。

---

## 第六轮安全修复——身份持久化与备份跨设备恢复 - 2026-09-12

> 在第五轮审查基础上，用户要求全面代码自审查后发现的问题修复。每项单独提交，262 用例全过。

### 🛡️ 安全修复

- **fix(security): v4 加密格式——per-install 随机盐替代 v3 全零固定盐**
  > v3 用全零固定盐，所有用相同密码的安装派生出相同密钥，失去防彩虹表/批量破解能力。v4 首次设密码时生成 16 字节随机盐存 localStorage，旧 v1/v2/v3 数据解锁后自动迁移。

- **feat(security): 身份密钥持久化——刷新后身份不变，TOFU 长期有效**
  > 之前每次刷新都生成新密钥对，TOFU/verified 按 trystero 临时 peerId 存储，刷新后信任关系全部失效。密钥对改为 extractable:true，用锁屏密码加密后存 IndexedDB（DB_VERSION 2 新增 identity store）。TOFU key 从临时 peerId 改为对方公钥 SHA-256 哈希。

- **fix(security): 跨设备备份恢复——备份文件内嵌随机盐**
  > v4 per-install 盐导致备份导出到另一台设备后盐不同、解密失败（v3 全零盐时代可工作）。备份格式升级到 V3（NYMIR_ENC_V3），备份文件自带 16 字节随机盐，盐跟着文件走，到哪台设备都能解开。旧 V2 备份仍可导入（仅同设备）。

- **feat(security): 最小密码长度 6→10 位**
  > 6 位纯数字离线破解约 28 小时，10 位要几十年。统一常量 MIN_PASSWORD_LENGTH=10，i18n 和 BackupPanel 同步更新。

### 🐛 Bug 修复

- **fix(security): 解锁后等待身份密钥加载完成再进主界面**
  > 之前 onLockChange 回调里 fire-and-forget 调 loadIdentity()，慢设备上用户可能在密钥未就绪时进房发消息。改为 async 等待完成，加载期间显示过渡屏，失败显示错误提示。

- **fix(test): 修 peer.test mock 类型 + ConfirmDialog unhandled errors**
  > peer.test 的 vi.fn mock 类型从 `vi.fn(() => room)` 改为 `vi.fn((..._args: unknown[]) => room)` 解决 oxlint no-explicit-any 报错；ConfirmDialog 测试补 cleanup 避免未处理错误。

- **docs(security): 诚实降级注释——移除残留的"前向保密"表述**
  > e2eeManager 文件头注释仍声称"前向保密"，与实际实现（会话级静态 ECDH + 每消息 HKDF）不符。改为诚实描述。

### 🧹 代码清理

- **refactor: 收紧 offlineQueue payload 类型**
  > QueuedMessage.payload 从 Record<string, unknown> 改为 Record<string, never>，从类型层面禁止塞明文，防止未来误改导致 localStorage 泄露。
- **burn.ts scheduled 分支加注释**：协议兼容层（接收旧版客户端消息），当前 UI 不发送。

### 📝 文档

- **docs(threat-model): 记录 ping/pong 监控消息不加密的元数据泄露**
- **docs(readme): 双语 README 同步更新安全特性、已知局限、路线图、测试数**

---

## 早期变更

> 文档类变更：README 双语修订、顶部风险提示、英文版行为准则 CODE_OF_CONDUCT.en.md、双语贡献指南 CONTRIBUTING.md、威胁模型文档 THREAT_MODEL.md 同步 v3 加密格式、AGENTS.md 规范更新。
