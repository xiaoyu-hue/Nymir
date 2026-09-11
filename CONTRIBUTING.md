# 贡献指南

感谢你对 Nymir 的关注！本文档说明如何为这个项目做出贡献。

Nymir 是一个由 AI 辅助开发的隐私优先 P2P 匿名聊天工具，作者为零编程基础的个人开发者。项目的核心价值观是**诚实、安全、克制**——所有贡献都应遵循这一原则。

---

## 行为准则

参与本项目即表示你同意遵守 [贡献者行为准则](./CODE_OF_CONDUCT.md)。请确保所有互动都尊重、包容、专业。

---

## 如何贡献

### 1. 报告 Bug

如果你发现了 bug，请通过 [GitHub Issues](https://github.com/xiaoyu-hue/Nymir/issues) 报告，并包含以下信息：

- **标题**：简洁描述问题
- **复现步骤**：一步步说明如何触发问题
- **预期行为**：你认为应该发生什么
- **实际行为**：实际发生了什么
- **环境信息**：浏览器版本、操作系统、Nymir 版本
- **截图/录屏**：如适用，请附上

### 2. 提出功能建议

欢迎通过 [GitHub Issues](https://github.com/xiaoyu-hue/Nymir/issues) 提出功能建议。请说明：

- 这个功能解决什么问题？
- 你期望的行为是什么？
- 有没有替代方案？

### 3. 提交 Pull Request

#### 前置检查

在提交 PR 之前，请确保：

- [ ] 你已经阅读了 [AGENTS.md](./AGENTS.md)（项目 AI 协作规则，也适用于人类贡献者）
- [ ] 你的代码通过了所有测试：`npm run test`
- [ ] 你的代码通过了类型检查：`npx tsc -b`
- [ ] 你的代码通过了 lint：`npm run lint`
- [ ] 你已经为新增功能编写了测试
- [ ] 你已经更新了相关文档（README、THREAT_MODEL 等）

#### PR 流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature-name`
3. 提交更改：`git commit -m 'feat: 添加xxx功能'`
4. 推送到分支：`git push origin feature/your-feature-name`
5. 创建 Pull Request

#### PR 描述模板

```
## 变更内容
简要说明这个 PR 做了什么。

## 变更原因
为什么需要这个变更？解决了什么问题？

## 测试说明
- [ ] 新增测试覆盖了变更内容
- [ ] 所有现有测试通过
- [ ] 手动测试了相关功能

## 安全影响
这个变更是否触及安全相关代码（src/security/、加密、密钥等）？如果是，请说明：
- 改的是哪一层？
- 攻击者能因此多知道什么？
- 哪个测试证明它没变坏？

## 关联 Issue
Closes #123
```

---

## 开发环境设置

### 环境要求

- Node.js 18+
- npm 9+

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/xiaoyu-hue/Nymir.git
cd Nymir

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm run test

# 类型检查
npx tsc -b

# 代码检查
npm run lint

# 构建生产版本
npm run build
```

### 项目结构

```
src/
├── ui/            # UI 层（React 组件）
├── core/          # 业务逻辑
├── communication/ # P2P 通信
├── persistence/   # IndexedDB 存储
└── security/      # 加密与安全
```

---

## 代码规范

### 提交信息规范

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**
- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档变更
- `style`：代码格式（不影响功能）
- `refactor`：重构（既不修复 bug 也不添加功能）
- `perf`：性能优化
- `test`：添加或修正测试
- `chore`：构建过程或辅助工具的变动

**示例：**
```
feat(security): 添加 PBKDF2 派生密钥缓存

fix(core): 修复离线队列明文存储问题

docs: 更新 README 致谢部分
```

### 分层提交原则

- **一次提交只改一层**，禁止 UI + 通信 + 加密 + CSS 混在同一提交
- 涉及 `src/security/` 的改动必须**先写测试，再改实现**
- 提交信息必须说清：改了什么、为什么、怎么验证的

### 代码风格

- TypeScript 严格模式
- 函数名、变量名使用英文，语义清晰
- 避免过度设计：只在至少 2-3 处真实重复时才抽公共模块
- 禁止引入：状态管理库、路由库、UI 组件库、ORM、DI 容器

---

## 测试要求

### 测试纪律

- **现有测试是安全网**，不得因"更干净""重构需要"而删除
- 禁止先改测试再改实现来逃避失败
- 新增功能必须同时新增测试
- 涉及 `src/communication/` 的改动必须有**行为级测试**，不能只测纯函数

### 运行测试

```bash
# 全量测试
npm run test

# 运行单个测试文件
npx vitest run src/__tests__/your-test.test.ts

# 监听模式
npx vitest
```

---

## 安全相关贡献

Nymir 是隐私优先项目，安全是最高优先级。涉及安全的贡献有额外要求：

### 安全红线

- 禁止把明文（消息内容、密钥、私钥、密码）写入日志、IndexedDB、localStorage
- 禁止用"应该安全""理论上不可破解"描述实现。能力边界必须写清楚
- README 声明的每一项安全能力，代码里必须有对应实现。文档不得超出实现

### 安全相关提交

涉及 `src/security/` 的提交必须在提交信息中回答三个问题：

1. 改的是哪一层？
2. 攻击者能因此多知道什么？
3. 哪个测试证明它没变坏？

### 报告安全漏洞

**请勿通过公开 GitHub Issue 报告安全漏洞。**

如果你发现了安全漏洞，请通过以下方式私密报告：

- 开启 [GitHub Security Advisory](https://github.com/xiaoyu-hue/Nymir/security/advisories)
- 或通过项目维护者的私密联系方式

请包含：
- 漏洞描述
- 复现步骤
- 潜在影响
- 修复建议（如有）

---

## 文档贡献

文档和代码同样重要。欢迎贡献：

- 修正文档中的错误或过时信息
- 改进文档的清晰度和完整性
- 添加使用示例和教程
- 翻译文档（中英文对照）

文档变更同样需要提交 PR，并通过审查。

---

## 常见问题

### Q: 我可以添加新的依赖库吗？

A: 请先在 Issue 中讨论。项目遵循克制原则，第一版禁止引入状态管理库、路由库、UI 组件库、ORM、DI 容器。其他依赖需要评估必要性。

### Q: 我的 PR 多久会被审查？

A: 这是个人项目，维护者时间有限。通常会在一周内回复，但不保证时间。请耐心等待。

### Q: 我可以重写某个模块吗？

A: **禁止 Big Bang Rewrite**。只允许：改一个模块 → 跑全量测试 → 再改下一个。大规模重构请先在 Issue 中讨论方案。

---

## 致谢

感谢所有为 Nymir 做出贡献的人。你的每一个 Issue、每一个 PR、每一次测试都在让这个项目变得更好。

---

*Nymir — 让秘密只属于你。能力有边界，诚实是底线。*
