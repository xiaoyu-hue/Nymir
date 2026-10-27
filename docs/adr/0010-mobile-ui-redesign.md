# ADR-0010：移动端界面大厂化改造（M1–M7）

- 状态：Accepted
- 日期：2026-10-27
- 相关：`src/App.tsx`、`src/ui/components/BottomTabBar.tsx`、`src/ui/components/BottomSheet.tsx`、`src/ui/components/SettingsPage.tsx`、`src/ui/components/Welcome.tsx`、`src/ui/components/OutOfBandVerify.tsx`、`src/ui/styles/globals.css`、`src/core/types.ts`（`BurnMode`）

## 背景

项目此前已具备完整的端到端加密与隐私能力（ADR-004 ~ ADR-009），但界面呈现偏"技术演示"，与"大厂产品"的体感差距明显，具体问题：

1. 导航与页面切换缺乏统一的移动端范式（无底部 Tab、无一致的二级页面容器）；
2. 大量使用 emoji 作为图标，视觉不一致、在深色玻璃背景上对比度不足；
3. 玻璃拟态（glassmorphism）模糊半径过大，文字可读性下降；
4. 首次打开无引导，新用户不知"先核对身份"这一关键安全动作；
5. 安全码 / 带外核对（ADR-009）只能在聊天室内触发，无法在建连前使用，弱化了 ADR-006/009 的核心卖点。

本 ADR 记录为弥合上述差距而做的界面改造决策（M1–M7），并顺带澄清一处被误判为"死代码"的枚举项。

## 决策

### 1. 导航模型：底部 Tab + 二级页面

- 采用 `BottomTabBar` 常驻底部，主分区为「对话」(`conversation`) 与「设置」(`settings`)，与主流移动 IM 的范式一致，降低学习成本。
- 二级表面（备份、信令、关于、身份核对）统一用 `BottomSheet` 半屏抽屉承载，而非全屏页面跳转——保持上下文、手势可下划关闭，符合移动端直觉。
- 新建对话的 `+` 浮动按钮（FAB）仅在「对话」且未进房时出现，避免与 Tab 语义冲突。

### 2. 图标与视觉：lucide-react 替代 emoji

- 引入 `lucide-react` 作为唯一图标源，替换此前散落的 emoji 图标（设置项、锁屏、空态等）。
- 收益：矢量清晰、可随主题着色、尺寸统一；代价：新增一个运行时依赖（已评估体积可控，且属 dev/peer 友好的纯 SVG 组件库）。
- 玻璃拟态模糊半径收敛（`glass.css` 中 20/10/40 → 14/8/24），在"质感"与"可读性"之间回退一步，正文文字不再被高光吞没。

### 3. 首次引导：Welcome 一次性引导页

- 仅在「尚未设置锁屏密码」(`!securityManager.isSetup`) 且本次会话未 dismiss 时展示 `Welcome`，讲解"无后端 / 端到端加密 / 阅后即焚"三个核心卖点，引导用户点「开始使用」进入密码设置。
- 展示后写入本地标记，下次不再出现（`locked && !isSetup` 条件控制），不干扰已设置用户。

### 4. 身份核对前置（M7）：设置页常驻入口

- `SettingsPage` 新增「身份与安全码」入口行，点击打开 `OutOfBandVerify` 抽屉，且**不传 `peerId`**（即"建连前模式"）：仅生成"我的身份串 + 二维码"供分享，或粘贴对方串即时算出安全码，**无需对方在线、无需加入房间**。
- 这把 ADR-009 的"带外核对"从「聊天室内才可用」提升为「建连前即可用」，直接兑现 ADR-006/009 的防中间人卖点。

### 5. 保留 `BurnMode.SCHEDULED`（澄清误判）

- M8 初版计划将 `BurnMode.SCHEDULED` 列为"死代码"清理。经核查，**它不是死代码**：
  - `src/core/burn.ts` 的 `shouldDestroy()` 与 `getRemainingMs()` 对 `scheduled` 模式各有一处处理，专门用于**接收旧版 / 对端客户端发来的、携带 `burnAt` 的定时销毁消息**；
  - `src/core/message.ts` 与 `src/persistence/backup.ts` 的白名单 `VALID_BURN_MODES` 均包含 `scheduled`，保证这类消息在解析与备份还原时不被当作非法构造值丢弃；
  - 当前 UI 虽不**发送** `scheduled`（发送端只用 `persist`/`read_once`/`timed`），但接收端必须能正确焚毁旧客户端发来的 `scheduled` 消息，否则会留下永不销毁的明文残留。
- **决策：保留 `SCHEDULED` 枚举、burn 逻辑与对应测试**（`src/__tests__/burn.test.ts` 的 `scheduled mode` 段）。删除会构成功能性回退（破坏旧消息兼容），风险高于收益。同时完善 `burn.ts` 注释，明确其"接收端协议兼容"语义，避免后续再次被误判。

## 后果

- **收益**：移动端体感对齐主流 IM；图标/对比度/可读性改善；首次引导降低新用户门槛；身份核对前置让安全卖点真正可用；`SCHEDULED` 的保留决策被显式记录，杜绝重复误删。
- **代价**：引入 `lucide-react` 依赖；Welcome 增加一次性的首次交互；设置页多一项；`SCHEDULED` 作为"仅接收"的兼容分支长期存在（属有意的技术债，已文档化）。
- **明确不做**：把 `scheduled` 从接收端移除（破坏兼容）；把身份核对做成独立底部 Tab（导航变复杂、与"对话/设置"二分范式冲突）；为追求极致玻璃质感牺牲正文可读性。

## 替代方案

- **全屏路由页替代 BottomSheet**：被否——二级表面用全屏页会打断对话上下文，且移动端下划关闭手势体验更差。
- **继续用 emoji 图标**：被否——跨平台渲染不一致、深色背景下对比度差、无法主题着色。
- **删除 `SCHEDULED` 以"精简"代码**：被否——见决策第 5 点，属功能回退而非清理。

## 验证

- `npm run build` / `typecheck` / `lint` 通过；
- 全量测试（319 用例）通过，含 `OutOfBandVerify.test.tsx`、`SettingsPage.test.tsx`、`burn.test.ts`（scheduled 段保留）；
- 真机/模拟器视口（390×844）下验证：底部 Tab 切换、设置页入口、Welcome 首次引导、身份核对抽屉建连前可用。
