# 架构决策记录（ADR）索引

本目录记录 Nymir 的关键架构决策（Architecture Decision Records）。每条 ADR 回答"为什么这样做"，与 [ARCHITECTURE.md](../ARCHITECTURE.md)（当前是什么）互补。

## 维护约定

- 新决策先写 ADR 再实现；实现改变决策时先改 ADR。
- 编号递增（ADR-00N），一旦分配不复用。
- 状态：`Accepted`（已接受）/ `Superseded`（被替代）/ `Deprecated`（已弃用）。
- 每篇 ADR 应包含：背景、决策、后果、替代方案、相关文档。

## 目录

| ADR | 主题 | 状态 |
| --- | --- | --- |
| [ADR-001](./0001-trystero-p2p.md) | 采用 Trystero 作为 P2P 信令与连接层 | Accepted |
| [ADR-002](./0002-agpl-license.md) | 采用 AGPL-3.0 开源协议 | Accepted |
| [ADR-003](./0003-public-signaling.md) | 依赖公共信令，定位"非完全去中心化" | Accepted |
| [ADR-004](./0004-local-encryption-v4.md) | 本地加密 v4 格式（per-install 盐 + PBKDF2-600k） | Accepted |
| [ADR-005](./0005-safety-code.md) | 安全码：15 位数字主验证 + emoji 视觉辅助 | Accepted |
| [ADR-006](./0006-tofu-pin.md) | TOFU + 带外安全码核对，不做自动防中间人 | Accepted |

---

*Nymir — 让秘密只属于你。决策有记录，边界有诚实。*
