# ADR-005：安全码——15 位数字主验证 + emoji 视觉辅助

- 状态：Accepted
- 日期：2026-09-08（v1.0 开发期）
- 相关：`src/security/fingerprint.ts`、`src/ui/components/SafetyCheckDialog.tsx`、[README.md](../README.md)「安全码设计灵感」

## 背景

Nymir 需要给用户一个"人可核对"的身份指纹以识别中间人。行业已有成熟先例：Signal 的 Safety Number（60 位数字）、WhatsApp 的 Security Code、Matrix 的 SAS（15 位十进制数字分 3 组）、Telegram/Matrix 的 emoji 验证。核心问题：用什么形式、以哪个为主。

## 决策

- **15 位十进制数字分 3 组显示**（5-5-5）作为**唯一主验证手段**——形式参考 Matrix SAS decimal。
- **7 个 emoji 仅作"扫一眼"的视觉辅助**——灵感参考 Telegram/Matrix emoji 验证，但不作为验证依据。
- 直接吸取 **Matrix MSC4405 的教训**：提议弃用 emoji 验证，因为不同操作系统 emoji 渲染不一致，容易误导用户。因此 Nymir 不把 emoji 作为主验证。
- 派生公式与 64 个 emoji（`EMOJI_TABLE`）为**独立实现**，未复用任何上游代码或 emoji 表。

## 后果

- **收益**：数字分组可准确朗读/比对，跨平台渲染稳定；emoji 提供快速视觉对照但绝不单独决定验证结论。
- **代价**：15 位数字比 emoji 序列更"枯燥"，用户核对意愿可能降低；带外核对仍是用户可选行为（威胁模型 §4.2 残余风险）。

## 替代方案

- 60 位完整数字（Signal 风格）：更安全但几乎无法手动核对，超出目标用户负担。
- 纯 emoji 验证（Telegram 风格）：视觉友好，但渲染不一致 + 已被 MSC4405 质疑，否决。

## 相关

[THREAT_MODEL.md](../THREAT_MODEL.md) §2/§4.2、[ADR-006](./0006-tofu-pin.md)。
