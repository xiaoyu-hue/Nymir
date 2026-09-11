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

---

## 早期变更

> 文档类变更：README 双语修订、顶部风险提示、英文版行为准则 CODE_OF_CONDUCT.en.md、双语贡献指南 CONTRIBUTING.md、威胁模型文档 THREAT_MODEL.md 同步 v3 加密格式、AGENTS.md 规范更新。
