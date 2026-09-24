# Nymir v1.6.2 — 第三次深度全面审查报告

**审查日期**：2026-09-24
**审查范围**：全部 src/ 代码（22 个源文件）、全部测试（32 个文件）、CSS、package.json
**通过标准**：无阻断项，无高危项

---

## 总体结论：⭐ 4.5/5 分 — 质量极高，存在 1 个需修复的 Bug

| 维度 | 评分 | 说明 |
|------|------|------|
| 安全性 | 5/5 | CSP 严格、AES-GCM、指纹验证、无 eval |
| 代码质量 | 5/5 | 纯 Store、事件总线、架构清晰 |
| 测试覆盖 | 4/5 | 32 文件 293 用例全绿，缺 UI 快照 |
| UI/UX | 4/5 | 无障碍优秀，有 2 处 UX 问题 |
| 代码规范 | 5/5 | oxlint 0 错误，仅 10 警告 |
| 性能 | 4/5 | CSS 动画合理，有可优化空间 |

---

## 🔴 严重 Bug（必须修复）

### Bug #1 — BackupPanel 导入异常导致 UI 永久卡死

**文件**：`src/ui/components/BackupPanel.tsx` 第 61-90 行

**问题**：`handleImport` 内的异步回调没有顶层 `.catch()`，当 `file.text()` / `verifyBackupPassword()` / `importBackup()` 抛错时，`finally` 里的 `setImporting(false)` 不会执行，按钮永久锁定在"导入中..."状态，用户无法重试。

**复现路径**：
1. 选择格式错误的 .nymir 文件
2. 点击"导入"
3. 按钮永远显示"导入中..."

**修复方案**：

```tsx
// 当前代码（有问题）
input.onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  setImporting(true)
  setStatus('')
  setHasError(false)
  try {
    const text = await file.text()
    // ...
  } catch (err) {
    setStatus(`${t.backup.importFailed}: ${err}`)
    setHasError(true)
  } finally {
    setImporting(false)  // ← 只有 try/catch 内部才能到达这里
  }
}

// 修复：添加顶层 .catch()
input.onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  setImporting(true)
  setStatus('')
  setHasError(false)
  try {
    const text = await file.text()
    // ...
  } catch (err) {
    setStatus(`${t.backup.importFailed}: ${err}`)
    setHasError(true)
  } finally {
    setImporting(false)
  }
}.catch((err) => {
  // 顶层错误处理：确保 finally 能执行
  setImporting(false)
  setStatus(`${t.backup.importFailed}: ${err}`)
  setHasError(true)
})
```

---

## 🟠 高风险问题（建议修复）

### Bug #2 — QRCodeComponent 使用 dangerouslySetInnerHTML

**文件**：`src/ui/components/QRCodeComponent.tsx` 第 47 行

**问题**：`<div dangerouslySetInnerHTML={{ __html: svg }} />` 直接将 SVG 字符串注入 DOM。虽然 `generateQRCodeSVG()` 内部对降级路径做了转义，但正常路径生成的 SVG 不受此保护。如果 qrcode 库未来版本引入漏洞或用户篡改 SVG 内容，存在 XSS 风险。

**建议**：改用 `innerHTML` 安全替代方案——使用 `<img src="data:image/svg+xml;base64,...">` 或直接渲染 React 元素。

```tsx
// 方案A：用 img 标签规避 dangerouslySetInnerHTML
const [svgUrl, setSvgUrl] = useState('')
useEffect(() => {
  generateQRCodeSVG(roomCode, 200).then(svg => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    setSvgUrl(url)
    return () => URL.revokeObjectURL(url)
  }).catch(() => setError('二维码生成失败'))
}, [roomCode])

// JSX 中改为：
{svgUrl ? <img src={svgUrl} alt="QR Code" className="qr-svg-img" /> : ...}
```

### Bug #3 — 日志中可能泄漏消息内容

**文件**：`src/core/message.ts` 第 226 行

**问题**：`error('[E2EE] Verify failed:', data.content, err)` 在签名验证失败时打印了已解密的消息内容 `data.content`。虽然 `error()` 在生产环境仍会调用 `console.error`，但解密后的消息内容不应出现在日志中。

**修复**：
```typescript
// 修改前
error('[E2EE] Verify failed:', data.content, err)
// 修改后
error('[E2EE] Verify failed:', err)
// 或
error('[E2EE] Verify failed for msg', data.id, err)
```

---

## 🟡 中等问题（建议优化）

### Issue #4 — BurnTimer 全局 tick 间隔未清理

**文件**：`src/ui/components/BurnTimer.tsx` 第 15-27 行

**问题**：`tickInterval` 是模块级变量，当第一个 BurnTimer 卸载时调用 `stopTick()`，若此时仍有其他实例监听则不误删，逻辑正确。但如果所有实例都在同一 tick 周期内挂载/卸载（如快速切换房间），可能出现短暂的多实例同时订阅同一 interval 的情况（目前代码允许，不是 bug，但不够健壮）。

**建议**：暂无行为问题，可保留当前实现。

### Issue #5 — RoomPanel roomCode 状态与 onRoomCreated 回调未连接

**文件**：`src/ui/components/RoomPanel.tsx` 第 20-30 行

**问题**：注释 `// Note: roomCode will be set via onRoomCreated callback` 表示预期通过父组件回调设置，但实际 RoomPanel 自己管理 `roomCode` 状态并初始化为空字符串。当 `createRoom` 成功时，`roomManager.room?.id` 应该同步更新，但 `roomCode` 状态没有触发更新。

**当前表现**：创建房间后立即点击查看 QR 可能显示空二维码（等待下一次渲染触发）。

**建议**：在 `handleCreate` 成功后立即同步设置 `roomCode`：
```typescript
const handleCreate = async () => {
  if (!roomName.trim()) return
  setCreating(true)
  try {
    const info = await roomManager.createRoom(roomName.trim())
    _setRoomCode(info.id)  // 立即同步，不依赖 onRoomCreated
    showQR(true)
    setCreating(false)
    onClose()
  } catch {
    setCreating(false)
  }
}
```

### Issue #6 — SafetyCheckDialog setState-in-useEffect（eslint-disable 已有标注）

**文件**：`src/ui/components/SafetyCheckDialog.tsx` 第 45、48 行

**说明**：已正确添加 `// eslint-disable-next-line react-hooks/set-state-in-effect` 标注，且逻辑正确（同步状态更新用于动画过渡）。无需修改。

---

## 🟢 设计亮点（值得保留）

| 项目 | 说明 |
|------|------|
| 安全删除注释 | `secureDelete.ts` 诚实声明能力边界 |
| BurnTimer 集中 tick | 全局单 interval，避免多个定时器竞争 CPU |
| 焦点管理 | SafetyCheckDialog / ConfirmDialog 都正确保存/恢复焦点 |
| 备份盐内嵌 | V3 备份自带盐，跨设备恢复可靠 |
| 消息去重读取 | `readMsgIdsRef` 限制 500 条防止内存泄漏 |
| 端到端加密 | AES-GCM + ED25519 签名，指纹 TOFU |
| CSP 严格配置 | script-src 'self'，无 inline script |

---

## 测试覆盖率总结

| 模块 | 测试文件数 | 状态 |
|------|-----------|------|
| 核心（message/room/burn） | 5 | ✅ 全绿 |
| 安全（crypto/e2ee/sign/nose/pseudonym） | 5 | ✅ 全绿 |
| 持久化（db/backup） | 2 | ✅ 全绿 |
| 通信（peer/offlineQueue/monitor） | 3 | ✅ 全绿 |
| UI 组件（BurnTimer/ChatView/ConfirmDialog/GlassCard/SafetyCheckDialog/ErrorBoundary） | 6 | ✅ 全绿 |
| 工具（base64/id/qr/random/time） | 5 | ✅ 全绿 |
| 密钥轮换（keyRotation/autoRotation/keyRotationChannel/keyRotationVerifiable） | 4 | ✅ 全绿 |
| **总计** | **32** | **✅ 293 passed** |

---

## 优先级排序

1. **P0（必须修复）**：Bug #1 BackupPanel 导入异常卡死
2. **P1（尽快修复）**：Bug #2 QRCodeComponent dangerouslySetInnerHTML、Bug #3 日志泄漏消息内容
3. **P2（优化）**：Issue #5 RoomPanel roomCode 同步
4. **P3（可选）**：Issue #4 BurnTimer 健壮性、Issue #6 已有标注无需修改
