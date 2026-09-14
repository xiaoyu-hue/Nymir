# ADR-004：本地加密 v4 格式（per-install 随机盐 + PBKDF2-600k）

- 状态：Accepted
- 日期：2026-09-08（v1.0 开发期）
- 相关：`src/security/crypto.ts`、`src/security/manager.ts`、[THREAT_MODEL.md](../THREAT_MODEL.md) §6

## 背景

本地 IndexedDB 数据必须以用户锁屏密码派生的密钥加密。早期版本曾使用固定的全局盐：同一密码在不同安装/设备上派生相同密钥，且缺少随机盐时同一密码加密同一明文会得到相同密文，降低离线暴力破解成本并暴露重复模式。

## 决策

本地加密格式演进至 **v4**：

- **PBKDF2（SHA-256，60 万次迭代）** 从锁屏密码派生加密密钥；
- **per-install 随机盐**（每次安装/首次初始化生成并持久化），保证不同安装即使密码相同也派生不同密钥；
- **AES-256-GCM** 字段级加密；
- 保留 **v1/v2/v3 兼容**：`needsMigration` 检测旧格式，`decryptWithSalt` 支持按旧盐解密，解锁后可迁移到 v4；
- 派生密钥做会话级缓存，锁定/超时后 `clearCryptoCache` 清理。

## 后果

- **收益**：同一密码跨安装产生不同密钥；离线暴力破解成本 ×60 万次迭代；旧数据可平滑迁移。
- **代价**：解锁有可感知延迟（60 万次 PBKDF2）；忘记密码 = 永久不可解密（ADR-006 语义的一部分）；格式版本必须长期兼容维护。

## 替代方案

- Argon2id：抗 GPU 暴力破解更强，但浏览器 WebCrypto 不支持，需引入 WASM 依赖（供应链风险）。
- 无盐/固定盐：实现简单，但暴力破解与密文模式分析风险不可接受。

## 相关

[THREAT_MODEL.md](../THREAT_MODEL.md) §5.2/§6、[ARCHITECTURE.md](../ARCHITECTURE.md) §3。
