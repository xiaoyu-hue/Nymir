# 文档与版本同步规范（DOC SYNC）

> 定位：代码 / CI / 功能变化后，让"文档描述"与"代码事实"保持一致的**执行清单**。
> 与 DECISION_REVIEW（决策前审查）、ADR（决策后记录）平级配套。
>
> **唯一真源原则**：
> - 版本号以 `package.json` 为唯一真源，其他所有文档从它派生；
> - 测试数 / 文件数等数字以实际测试输出为唯一真源；
> - 功能 / 架构描述以代码实现为唯一真源，文档不得超出实现。

---

## 一、触发时机（任一发生即触发同步）

- [ ] 功能新增 / 修改 / 移除
- [ ] 安全或 CI 流程变化（扫描、门禁、workflow）
- [ ] 依赖变化（新增 / 移除 / 升级）
- [ ] 发版（bump 版本 + tag + Release）
- [ ] 新增文档 / ADR

## 二、同步清单（逐项勾选）

### A. 版本号（唯一真源：`package.json`）

| 位置 | 动作 | 校验方式 |
|------|------|---------|
| `package.json` | bump 版本 | — |
| `package-lock.json` | 顶层 + `packages[""]` 同步 | grep |
| `CHANGELOG.md` | 新版本条目（"未发布"→正式） | grep |
| `docs/PRD.md` / `docs/PRD.en.md` | 版本头 + 状态行 + 版本历史表新增行 | grep |
| `docs/ARCHITECTURE.md` / `.en.md` | 版本头 | grep |
| `README.md` / `README.en.md` | badge（动态 release 徽章自动跟 tag；静态手动改） | grep |
| `docs/AUTHOR.md` / `.en.md` | 当前版本叙述（如有） | grep |
| Release + tag | 与 package.json 一致 | API 确认 |

### B. 数字与事实（唯一真源：实际输出）

| 数据 | 真源 | 需要同步的位置 |
|------|------|---------------|
| 测试数 / 测试文件数 | `npx vitest run` 输出 | README(.en) badge 与表格、ARCHITECTURE、PRD 验收段 |
| 依赖数 / 漏洞数 | `npm audit` / OSV 扫描输出 | README 致谢区、PRD 安全段 |
| 功能 / 架构描述 | 代码实现 | README、PRD、ARCHITECTURE、THREAT_MODEL、ADR |
| 分支保护 / CI 门禁 | 仓库设置 + workflow 文件 | README 安全扫描表、CHANGELOG、PRD |

### C. 文档索引

- [ ] `docs/README.md` 补登新增文档
- [ ] `docs/adr/README.md` 补登新增 ADR

## 三、版本号规则（SemVer 判定）

| 变化类型 | 版本动作 | 例子 |
|---------|---------|------|
| 新增用户可见功能 | minor | 1.2.0 → 1.3.0 |
| 修复 bug / 安全修复 | patch | 1.3.0 → 1.3.1 |
| 仅文档 / CI / 工程变更 | patch（或不 bump） | 6.3.1 → 6.3.2 |
| 破坏性变更 | major | 1.x → 2.0.0 |

**判定口诀**：用户能感知的新东西 → minor；修了错 → patch；只是整理 → patch 或不 bump。拿不准先过 DECISION_REVIEW 的决策三问。

## 四、发布前验证（必须跑）

1. **旧版本号残留检查**：`grep -rn "旧版本号" --include="*.md" --include="*.json" .` → 结果应为空，或确认命中仅为历史记录（如 PRD 版本历史表、CHANGELOG 历史条目）。
2. **测试数核对**：跑全量测试，输出数字与 README 中声明一致（不一致必须修 README，不得改数字假装一致）。
3. **版本一致性**：`package.json` = `package-lock.json` = CHANGELOG 最新条目 = docs 头部 = tag。
4. **CHANGELOG**："未发布"条目已转正式；内容覆盖本次全部用户可见变更。

## 五、同步检查模板（发布 PR 前填写）

```markdown
## 同步检查（DOC SYNC CHECK）

- 新版本号：____（package.json 唯一真源）
- 测试数：____ / 测试文件数：____（实际输出）
- [ ] package.json + lock 一致
- [ ] CHANGELOG 已转正式
- [ ] docs 版本头已同步（PRD / ARCHITECTURE 中英）
- [ ] README badge / 表格数字已同步
- [ ] 无旧版本号残留（grep 验证）
- [ ] docs 索引已补登
- [ ] Release / tag 已创建且与版本号一致
```

## 六、与现有体系的关系

- **AGENTS.md**：引用本规范，发布前为必查项
- **DECISION_REVIEW.md**：发版前先过决策三问（尤其"破坏性变更"和"版本号策略"）
- **ADR**：重大变更先记 ADR，再同步本文档涉及的描述
- **CHANGELOG**：用户可见变更的出口，与版本号同步更新

> 一句话：**版本号问 package.json，数字问测试输出，描述问代码，发布前 grep 一遍再走。**
