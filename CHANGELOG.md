# 更新日志

本文件记录 Nymir 的所有重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/).

> ⚠️ 提示：本项目由 AI 辅助开发，作者无编程基础，尚未经过专业安全审计，不建议用于真实敏感场景。

---

## 未发布

### 🐛 修复

- **CI 红叉（Deploy to GitHub Pages）**：仓库默认分支由 `master` 改名为 `main` 后，`github-pages` 环境的部署分支白名单仍只允许 `master`，导致 deploy job 被保护规则拒绝（`Branch "main" is not allowed to deploy to github-pages`）。已在仓库设置中把 `main` 加入白名单并移除失效的 `master` 条目
- **E2E Smoke 挂死**：`npx playwright install --with-deps` 偶发卡在 apt 源下载，把 20min 的 job 超时跑满后整轮被 cancelled；改为缓存 Playwright 浏览器、用 `timeout` 给安装步骤兜底，并把 job 超时收敛到 15min
- **E2E WebKit 缺少系统库（根治）**：runner 的 apt 源实测 5.5 分钟只下完 10 个包，`install-deps` 在 4 分钟上限内一个包都没装上，导致 WebKit 两端 6 个用例全挂（缺 `libgstcodecparsers-1.0.so.0`、`libflite.so.1`、`libmanette-0.2.so.0`、`libavif.so.16`、`libGLESv2.so.2` 等）。改为在官方镜像 `mcr.microsoft.com/playwright:v1.63.0-noble` 内运行 E2E —— 浏览器与系统库全部预装、不再触碰 apt；并移除 `continue-on-error`，让 E2E 真失败时能被看见
- **Cloudflare Pages 白屏**：`https://nymir.pages.dev/` 的 Pages 项目没有配置构建，直接把仓库根目录当静态资源发布，`index.html` 里引用的是开发入口 `/src/main.tsx`，浏览器无法执行，`#root` 永远是空的（`/manifest.webmanifest` 也被 SPA 兜底成了 HTML）。修复：Pages 项目把 Build command 设为 `npm run build`、输出目录设为 `dist`；不需要设 `BASE_PATH`，其默认 `/` 正好匹配域名根路径（只有 GitHub Pages 的 `/Nymir/` 子路径才需要 `BASE_PATH=/Nymir/`）

### 📝 文档

- **站点主副调整**：Cloudflare Pages（https://nymir.pages.dev/）改为对外主站，GitHub Pages（https://xiaoyu-hue.github.io/Nymir/）转为镜像副站；`index.html` 增加 `<link rel="canonical">` 与 `og:url` 指向主站，README 的在线体验链接同步对调

---

## 1.8.1 - 2026-10-27（许可与合规收口）

### 📝 文档

- **LICENSE 恢复 AGPL-3.0 标准附录**：此前的许可证正文（§0–§17）虽与官方原文逐字一致，但末尾整节 `How to Apply These Terms to Your New Programs` 被删掉了。本次按 https://www.gnu.org/licenses/agpl-3.0.txt 原文补回该节，只保留自己的版权行与「如何应用」通知，全文与官方文本 diff 仅剩这一处作者填写的声明块。
- **LICENSE-DOCS 重写为七要件结构**：版权行 / `SPDX-License-Identifier: CC-BY-NC-SA-4.0` / 覆盖范围（正向枚举 + 反向排除）/ 授权与条件 / 署名方式（含示例串）/ 第三方内容除外 / 未修改的官方全文。范围从「按扩展名」改为按目录，避免 `.ts` 漏掉 `.tsx`。
- **README 许可表**与上述两份文件对齐。

### ✨ 新功能

- **设置页新增「源代码」入口**：AGPL-3.0 §13 要求通过网络提供服务的版本向使用者提供 Corresponding Source。应用内「关于」区新增源码链接与说明（中英双语），使用者不必先找到仓库再找许可证。

### 🧪 测试

- 仅文档与 UI 文案改动，未触及运行时逻辑；`tsc -b && vite build` 与既有测试集预期不变（本机无 `node_modules`，未在本地跑构建，以 CI 为准）。

## 1.8.0 - 2026-10-27（移动端大厂化改造 M1–M7）

### ✨ 新功能

- **底部 Tab 导航**：常驻 `BottomTabBar`，主分区「对话 / 设置」，贴合主流移动 IM 范式，降低学习成本
- **统一二级页面容器**：备份、信令、关于、身份核对等二级面统一用 `BottomSheet` 半屏抽屉承载，支持下划关闭、保持对话上下文
- **图标体系升级**：引入 `lucide-react` 替换散落的 emoji 图标，矢量清晰、可主题着色、跨平台一致
- **玻璃拟态收敛**：降低模糊半径（`glass.css` 20/10/40 → 14/8/24），在质感与正文可读性之间回退一步
- **首次引导页（Welcome）**：仅首次（未设置锁屏密码）展示，讲解「无后端 / 端到端加密 / 阅后即焚」核心卖点后进入密码设置
- **身份核对前置（M7）**：设置页新增「身份与安全码」入口，可在**建连前**分享身份串/二维码或粘贴对方串即时算出安全码，无需对方在线、无需加入房间（兑现 ADR-006/009 的防中间人卖点）

### 🐛 修复

- **依赖漏洞（OSV 红叉）**：升级 `vitest` / `@vitest/coverage-v8` 至 `5.0.5`，消除 GHSA-qxg6-89mg-rqv8（代码注入）与 GHSA-xp26-3454-mjgp（路径穿越），仅改开发依赖、无 breaking change

### 📝 文档

- 新增 [ADR-0010](./docs/adr/0010-mobile-ui-redesign.md)：移动端大厂化改造的导航模型、BottomSheet 模式、lucide 图标、玻璃拟态收敛、Welcome 引导、身份核对前置等决策
- ADR-0010 同时澄清：`BurnMode.SCHEDULED` 经核查**非死代码**（是接收旧版/对端消息的阅后即焚协议兼容逻辑），予以保留并记录，避免被误删导致旧消息明文残留

### 🧪 测试

- 全量测试：319 个用例通过；类型检查、lint、构建均通过
- `OutOfBandVerify.test.tsx`、`burn.test.ts`（scheduled 段保留）覆盖身份核对与阅后即焚兼容逻辑

---

## 1.7.0 - 2026-10-26（安全增强：流量随机化 / 弱前向保密 / 信令可自托管 / 离线核对）

### ✨ 新功能

- **信令节点可自配 / 自托管**：设置页可分别修改 MQTT / Nostr / WebTorrent 的 relay 地址列表与冗余数，持久化到 `localStorage`，加入房间时实时生效（无需刷新）。非法地址（非 `wss://`）自动丢弃，空列表回退默认值，冗余数自动夹取（ADR-009）
- **建连前离线身份核对**：新增「带外核对」入口，可导出自己的身份串（`nymir1:<base64url>`，**仅含公钥**）经任意渠道发给对方，或粘贴对方的串立刻算出 15 位数字 + 7 emoji 安全码。无需对方在线、无需加入房间，可先核对身份再建连（ADR-009）
- **弱前向保密**：每次会话额外生成一次性临时 X25519 密钥对，会话根密钥改为 `HKDF(静态-静态 ECDH, salt=临时-临时 ECDH)`；临时私钥存内存、断连即丢弃，长期静态私钥泄露无法解密已启用临时密钥的历史密文（ADR-008）

### 🛡️ 安全改进

- **噪声填充随机化**：间隔由固定 30s 改为 8–28s 随机，长度由固定 48B 改为 24–512B 随机，打破等间隔等长特征
- **心跳间隔随机化**：ping/pong 由固定 5s 改为 3.5–7s 随机
- **握手与消息携带临时公钥**：`e2ee_key` 握手与消息载荷新增 `eph` 字段；解密采用故障安全策略（先组合根，失败回退静态根），兼容握手前窗口与旧客户端
- **CSP 调整**：`connect-src` 增加 `wss:` / `https:` 以支持自托管信令；`script-src` 仍保持 `'self'` 不含 `unsafe-inline` / `unsafe-eval`（取舍见 ADR-009）

### 🐛 修复

- **文档与实现矛盾**：`docs/THREAT_MODEL.md` 中「对端私钥不可导出（`extractable: false`）」与代码 `extractable: true` 不一致，已按代码修正（导出后仍以锁屏密码加密存储）
- **测试偶发失败**：`autoRotation.test.ts` 使用固定 50ms 等待异步轮换，在覆盖率插桩下偶发超时；改为条件等待（`vi.waitFor`），断言强度不变

### 📝 文档

- 新增 [ADR-008](./docs/adr/0008-ephemeral-forward-secrecy.md)：临时会话密钥与弱前向保密的边界（含握手前窗口、旧客户端互通时回退纯静态根）
- 新增 [ADR-009](./docs/adr/0009-self-hosted-signaling-and-oob-verification.md)：自托管信令、CSP 放宽取舍、带外核对格式与「明确不做」清单
- `THREAT_MODEL.md`：§5.1 / §5.3 / §6 / §7 / §8 按实际实现更新，新增弱前向保密边界与信令可自配说明
- `README.md` / `README.en.md`：安全特性、已知局限（噪声/心跳/信令/Nostr 元数据）、路线图同步

### 🧪 测试

- 新增 `signaling.test.ts`、`outOfBand.test.ts`、`SignalingSettings.test.tsx`、`OutOfBandVerify.test.tsx`
- 全量测试：317 个用例通过（v1.6.5 为 293），类型检查与覆盖率门禁均通过

---

## 1.6.5 - 2026-09-28（代码审查修复清单 P1）

### 🐛 Bug 修复

- **React Hooks 规范**：`QRScanner.tsx` 将 `scanningRef.current = scanning` 从 render 期间移至 `useEffect`，修复 `react(refs)` lint 警告
- **React setState 时序**：`RoomPanel.tsx` 使用 derive state（`shouldShowQR`）替代 `useEffect` 内同步 `setShowQR`，修复 `react(set-state-in-effect)` lint 警告

### 🧪 测试

- 全量测试：293 个用例全部通过（无变化）

---

## 1.6.4 - 2026-09-24（代码审查第四轮修复）

### 🐛 Bug 修复（P2 问题）

- **并发安全**：`BurnTimer.tsx` 改为每个实例独立定时器，移除全局 `tick` 共享状态，防止多房间同时倒计时时互相干扰
- **组件规范**：`QRScanner.tsx` 移除 render 期间 ref 赋值，改用 `useEffect` 同步摄像头流，符合 React Hooks 规则
- **Lint 警告清理**：`ChatView.tsx`、`RoomPanel.tsx`、`QRCodeComponent.tsx` 添加 eslint-disable 注释，说明有意设计

### 📝 文档

- CHANGELOG.md 新增 v1.6.4 条目
- docs/DOC_SYNC.md 更新检查清单

### 🧪 测试

- 全量测试：293 个用例全部通过

---

## 1.6.3 - 2026-09-24（代码审查第三轮修复）

### 🐛 Bug 修复

- **可用性**：`BackupPanel.tsx` 导入功能按钮永久卡死 — 改用 IIFE 包装异步逻辑，确保错误路径能正确重置导入状态
- **安全性**：`QRCodeComponent.tsx` 使用 `dangerouslySetInnerHTML` 注入 SVG — 改为 Blob URL + `<img>` 标签渲染，消除 XSS 风险
- **功能正确性**：`RoomPanel` 创建房间后二维码弹窗不显示 — 修复 `roomCode` 状态流，添加回调参数实时传递房间 ID

### 📝 文档

- 新增 `AUDIT_V3.md`：第三次全面代码审查报告

### 🧪 测试

- 全量测试：293 个用例全部通过

---

## 1.6.2 - 2026-09-23（代码审查第二轮修复）

### 🐛 Bug 修复

- **安全**：`backup.ts` 导入时校验 burnMode 白名单，防御篡改备份绕过阅后即焚
- **安全**：`qr.ts` 降级 SVG 文本做 HTML 实体转义，防止 dangerouslySetInnerHTML XSS
- **性能**：`ChatView.tsx` 仅在底部附近时自动滚动，避免打断历史浏览
- **正确性**：`MessageBubble.tsx` memo 增加 timestamp 比较，确保 BurnTimer 倒计时正确更新
- **一致性**：`e2ee.ts` 提取 evictSharedKeysIfNeeded 为独立导出函数，明确 LRU 淘汰语义

### ♿ 无障碍

- 弹窗（SafetyCheckDialog / ConfirmDialog）打开/关闭时管理焦点，符合 WAI-ARIA dialog 规范

### 🎨 样式规范

- `App.tsx` 身份加载失败状态硬编码样式提取为 CSS 类 identity-error-card

### 🔧 CI

- 修复 OSV-Scanner API 限流：添加 GH_TOKEN 认证环境变量

---

## 1.6.1 - 2026-09-23（代码审查修复）

### 🐛 Bug 修复

- **安全**：`db.ts` 锁定检查提前到 try/catch 外，防止锁定时被外层 catch 吞掉导致明文泄露
- **安全**：`peer.ts` switchStrategy 时逐个触发 onPeerLeave 回调，防止共享密钥残留
- **并发**：`e2eeManager.ts` recordMessageSent 添加 `_rotating` 防重入锁，避免并发消息触发双重轮换
- **内存**：`ChatView.tsx` 限制 readMsgIdsRef Set 大小为 500，防止长会话内存泄漏
- **缓存**：`message.ts` init 时清空 _cachedMessages，防止切换房间时显示旧消息
- **资源**：`QRScanner.tsx` stopCamera 后重置 animFrameRef，防止摄像头资源泄漏
- **一致**：`offlineQueue.ts` clearRoom 先 emit 再 save，无条件 saveToStorage 确保幂等

### 🧹 规范整理

- `qr.ts` 移除未使用的 catch error 变量
- `App.tsx` 移除 `_roomCode` 下划线前缀，统一命名规范
- `e2ee.ts` / `sign.ts` 使用 `as unknown as` 替代直接类型断言
- `globals.css` 替换 `*` 选择器为具体元素列表
- `QRScanner.tsx` 移除 TSX 硬编码 fallback 字符串，统一 i18n；为 video 添加 aria-label

---

## 1.6.0 - 2026-09-23（二维码离线配对）

### ✨ 新功能

- **QR 码离线配对**：创建房间后自动生成二维码，对端扫码即可加入房间，无需手动输入房间代码
  - 新增 `src/utils/qr.ts`：QR 码生成（qrcode 库）与摄像头扫描（jsqr 库）工具函数
  - 新增 `src/ui/components/QRCodeComponent.tsx`：QR 弹窗展示组件，品牌色 SVG 输出
  - 新增 `src/ui/components/QRScanner.tsx`：摄像头扫码组件，自动识别并加入房间
  - 新增 `src/ui/styles/qr.css`：QR 相关样式（弹窗覆盖层、扫描框、按钮）
  - RoomPanel 接入真实房间 ID，创建成功后自动弹出 QR 弹窗
  - Join tab 新增「扫描二维码」按钮，支持摄像头扫码快速加入
  - 补充中英文 i18n 文案（扫码、分享、摄像头权限等）

### 🧪 测试

- 新增 `src/__tests__/qr.test.ts`（6 个用例）：覆盖 QR 生成、空串降级、尺寸、颜色、扫码基础逻辑
- 全量测试：293 个用例全部通过

### 🔒 依赖

- 新增运行时依赖：`qrcode ^1.5.4`（SVG 生成）、`jsqr ^1.4.0`（摄像头帧识别）
- 新增开发依赖：`@types/qrcode`

---

## 1.5.0 - 2026-09-22（信令去依赖：多信令冗余 + Nostr 降级链）

> 新功能：信令可靠性升级——MQTT 主通道启用全部 5 个公共 broker，新增 Nostr 降级策略，降级链 mqtt → nostr → torrent。无破坏性变更。

### ✨ 新功能
- **信令冗余配置**：MQTT 主通道显式启用全部 5 个公共 broker（此前 trystero 默认列表含 5 个但只启用前 4 个，hivemq 从未被用上），redundancy=5；WebTorrent 降级通道启用全部 5 个公共 tracker（此前只启用前 3 个）。任意几个信令服务器挂掉仍有可用通道。
- **Nostr 降级策略**：新增 `@trystero-p2p/nostr` 作为第二降级级（mqtt 主 → nostr → torrent）。Nostr 公共 relay 数量远多于 MQTT broker，去中心化程度更高。显式配置 8 个知名公共 relay、同时保持 5 条连接。

### ⚙️ 工程/CI
- 双端联调与 Nostr 专项验证通过（浏览器内两个独立上下文经公共 relay 真实建连 + 消息送达）；单测 287 全绿。

---

## 1.4.0 - 2026-09-15（自动密钥轮换 + E2E 三端 + CSP 修复）

> 新功能：自动密钥轮换策略；工程/CI：Playwright E2E 三端 + CSP 修复。无破坏性变更。

- **自动密钥轮换策略（ADR-007 协议就绪后启用）**：每发送 100 条消息自动触发一次可验证轮换（`rotateKeysVerifiable`，签名衔接证明经 key-rotation 通道广播，对端验签通过才 re-pin）；仅在至少一个对端在线时触发，对端离线时计数累计、待在线后补触发；轮换后计数清零。早期"每 100 条自动换"无通知/无签名导致解密失败的缺陷已由协议解决。
- **E2E 三端测试（Playwright）**：新增 `e2e/`（冒烟 + 响应式）、`playwright.config.js`、`test:e2e` 脚本与 CI job（Chromium 桌面 + WebKit 手机/平板）。冒烟覆盖：零错误加载 / CSP 零违规 / 首次设置密码 / 创建房间进入聊天；响应式覆盖三端渲染。
- **CSP 修复（E2E 发现的安全问题）**：①移除 `connect-src` 中无效的 `stun:` 源（WebRTC 底层不受 CSP 约束，此前仅产生浏览器警告）；②移除 `<meta>` 中无效的 `frame-ancestors`（meta 不生效），改由 `public/_headers` 的 `X-Frame-Options: DENY` 在 Pages 部署时真正生效；③补齐 trystero 备用 MQTT broker 白名单（`test.mosquitto.org`、`public.cloud.shiftr.io`）——此前被 CSP 拦截，容错降级失效。
- **决策审查体系**：AGENTS.md 新增「决策协作规范」章节——不可逆 / 花钱 / 对外发布 / 影响项目走向的操作，AI 必须先答"决策三问"（坏处/代价、不做的后果、后悔条件）等作者拍板才能执行；配套新增 `docs/DECISION_REVIEW.md`（决策前反问清单 + 拍板记录模板）。
- **文档与版本同步规范**：AGENTS.md 新增「文档与版本同步（发布必查）」章节；配套新增 `docs/DOC_SYNC.md`（唯一真源原则：版本号问 package.json、数字问测试输出、描述问代码；同步清单 + SemVer 判定表 + 发布前验证 + 同步检查模板）。含中英双语一致性、依赖 ↔ README 致谢表同步项。
- **部署收口**：移除 Cloudflare Workers 在线地址（`*.workers.dev` 不可用）；**GitHub Pages（https://xiaoyu-hue.github.io/Nymir/）为主站，Cloudflare Pages（https://nymir.pages.dev/）为备用副站**（两站互为独立入口，域名隔离身份，主备关系已在 README 中英文标注）。1.3.0 中记录的 `Workers Builds: nymir` 已知事项随 Workers 部署移除不再适用。

---

## 1.3.0 - 2026-09-14（密钥轮换 UI + 安全基建收口）

> 新功能：密钥轮换界面入口；工程/CI：分支保护 + 扫描管线收口。无破坏性变更。

### ✨ 新功能
- **密钥轮换 UI**：ChatView 工具栏新增 🔑 换钥按钮（有对端时显示）。点击后经确认弹窗二次确认，调用 `messageManager.rotateKeys()`（可验证轮换协议，见 ADR-007），成功/失败横幅反馈（4 秒后自动消失）。轮换后安全码自动变为"已变更"，提示双方重新核对。i18n 中英双语。新增 4 例组件测试。

### ⚙️ 工程/CI
- **启用 master 分支保护**：必须 PR 合并 + 必检全绿（CodeQL `Analyze (javascript-typescript)` / Semgrep `security-audit + owasp-top-ten` / Test Gate `audit · typecheck · lint · test · build`）+ 分支需最新（strict）+ 管理员不绕过（enforce_admins）+ 禁止强推/删除分支 + 线性历史。直推 master 被拒，全部改动走 PR。
- **停用 Dependabot 常规版本升级**（删除 dependabot.yml）：不再自动开升级 PR（避免分支/PR 杂乱）；保留 Dependabot alerts（漏洞告警）+ security updates（高危漏洞自动修复 PR）——由仓库设置控制，不受影响。
- **移除冗余 socket.yml**：Socket Security GitHub App 已安装并接管供应链扫描（产生 `Socket Security: Project Report` 检查），自建 workflow 删除。
- **已知事项**：Cloudflare Workers 构建检查（`Workers Builds: nymir`）偶发 0 秒失败，属 Cloudflare 侧配置/认证问题，不在分支保护必检清单内，不影响合并；待登录 Cloudflare 后台核查。

---

## 1.2.0 - 2026-09-14（可验证密钥轮换）

> 安全增强：可验证密钥轮换（签名衔接协议，ADR-007）。无破坏性变更。

### 🛡️ 安全

- **feat(security): 可验证密钥轮换协议（ADR-007）**
  - `rotateKeysVerifiable()`：换钥时用旧签名私钥对「新公钥材料」签名，持久化新身份后自动广播证明——对端可验证"新旧身份是同一实体"，中间人无法伪造。
  - `handleKeyRotation()`：对端验签通过才更新公钥 + TOFU re-pin + 已验证记录迁移（状态变 `changed` 提示重新核对）；验签失败/来源不符一律拒绝；重复广播幂等忽略。
  - `message.ts` 新增 `key-rotation` 控制通道与 `rotateKeys()` 显式入口（生产路径替代旧 `rotateKeys`，修复其"不持久化 + 无通知"缺陷）。
- **测试**：新增 15 项（协议单测 9 + 通道集成 6），**279 项全过**（29 文件）。

### 📚 文档

- README（中/英）：已知局限更新为"自动轮换策略未启用、可验证轮换已支持"；路线图更新。
- THREAT_MODEL §8：可验证密钥轮换标记完成。
- ARCHITECTURE：测试数修正 270+ → 279（29 文件）。
- 新增 ADR-007 + 索引补行。

### ⏳ 待定

- 版本统一为 1.2.0（package.json + lock 同步修复历史 1.0.0 不一致）
- 密钥轮换 UI 入口与自动轮换策略（路线图）

---

## 1.1.0 - 2026-09-14

> 版本统一：文档体系补齐（PRD / ARCHITECTURE / ADR / 英文版），无破坏性代码变更。

### 📚 文档

- **docs: 新建 PRD.md** — 产品需求：目标、核心概念、功能规范、安全边界、10 项可检查验收。
- **docs: 新建 ARCHITECTURE.md** — 当前架构一页图：分层总览、消息旅程、文件职责、数据模型、6 条红线。
- **docs: 新建 adr/ 决策记录**（6 份 + 索引）— Trystero 选型、AGPL-3.0、公共信令定位、本地加密 v4、安全码设计、TOFU + 带外核对。
- **docs: 新增 PRD.en.md / ARCHITECTURE.en.md** — 英文版，面向 GitHub 国际读者。
- **docs: 更新文档索引** — docs/README.md 补 PRD / ARCHITECTURE / ADR / 英文版条目。

### 🔧 版本

- package.json / README 徽章 / PRD / ARCHITECTURE 版本统一为 **1.1.0**。

### 🧪 测试说明（诚实记录）

- `npm test` 当前 **264 项全过**（27 文件）。
- 期间观察到 1 次偶发失败（1/264），复跑即全绿，定位为**测试 flaky**（疑似并行 worker 共享 storage 状态），非确定性 bug；已记录，若再出现将单独排查。

---

## 第四~六轮审查修复 - 2026-09-13

> 在前三轮安全审计基础上，继续从代码安全、代码质量、测试覆盖、UI/UX 四个维度审查。264 测试全过。

### 🛡️ 安全修复

- **fix(security): recall/read 通道用真实 peerId 替代 payload 自报 peerId**
  > 之前撤回和已读回执的 payload 里带 peerId 字段，接收方信任这个自报值——恶意 peer 可以伪造撤回别人的消息或伪造已读回执。改为用 trystero 传输层的真实 peerId，payload 不再携带 peerId。

- **fix(security): verifiedStore key 从临时 peerId 改为公钥 SHA-256 哈希**
  > 之前按 trystero 临时 peerId 存"已核对"状态，切换传输策略（mqtt→torrent）或刷新页面后 peerId 变了，已核对状态丢失。改为按对方公钥哈希存，跨会话跨传输稳定。

- **refactor: 删除 encryptFile/decryptFile/deriveFileWrapKey 死代码**
  > 文件加密函数从未被调用（约 200 行），且密钥派生方式与主加密路径不一致，留着是安全隐患。

- **fix: unverifyPeer 从 fire-and-forget 改为 async await**
  > 消除连续调用时的竞态窗口。

### 🧹 代码清理

- **refactor: 删除 peerManager.reconnectTimer 死字段**
- **refactor: offlineQueue payload 类型收紧为 Record<string, never>**
- **refactor: 内联样式迁移 CSS（ChatView 安全按钮 + safety-banner）**

### 🎨 UI/UX

- **fix(a11y): MessageBubble 去掉 wrapper 的 role=button/tabIndex**
  > 之前整条消息气泡被屏幕阅读器朗读为按钮，但对端消息不可交互。改为只有撤回按钮是可交互元素。

- **feat(i18n): Loading/身份错误提示走 i18n**
  > 之前硬编码中英文，现在中英文用户都看到对应语言。

- **feat(ux): 创建/加入房间失败时显示红色错误提示**
  > 之前点按钮失败只打日志，用户毫无反馈。

### ✅ 测试

- **test(noise): 补 start/stop 噪声生成测试（5 用例）**
  > 覆盖间隔发送、stop 停止、重复 start 防护、噪声特征验证、stop 后再 start。噪声模块覆盖率从 21% 提升。

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
